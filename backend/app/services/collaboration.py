from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select

from app.core.exceptions import EntityNotFoundError
from app.models.collaboration import WorkspaceMembership
from app.repositories.collaboration import CollaborationRepository
from app.repositories.engagement import NotificationRepository
from app.repositories.user import UserRepository


class CollaborationService:
    def __init__(
        self,
        repo: CollaborationRepository,
        users: UserRepository,
        notifications: NotificationRepository,
    ) -> None:
        self.repo, self.users, self.notifications = repo, users, notifications

    async def list_workspaces(self, user_id: UUID, user_name: str) -> list[dict]:
        await self.repo.ensure_default(user_id, user_name)
        results = []
        for membership in await self.repo.memberships(user_id):
            members_result = await self.repo.session.execute(
                select(WorkspaceMembership).where(
                    WorkspaceMembership.workspace_id == membership.workspace_id
                )
            )
            members = list(members_result.scalars().all())
            results.append(
                {
                    "id": membership.workspace.id,
                    "name": membership.workspace.name,
                    "created_at": membership.workspace.created_at,
                    "updated_at": membership.workspace.updated_at,
                    "role": membership.role,
                    "teams": membership.workspace.teams,
                    "members": [
                        {
                            "id": m.user.id,
                            "name": m.user.name,
                            "email": m.user.email,
                            "role": m.role,
                        }
                        for m in members
                    ],
                }
            )
        return results

    async def create_team(self, workspace_id: UUID, name: str, user_id: UUID):
        membership = await self.repo.membership(workspace_id, user_id)
        if membership is None or membership.role not in {"owner", "admin"}:
            raise EntityNotFoundError("Workspace not found or insufficient permission")
        return await self.repo.create_team(workspace_id, name)

    async def add_member(self, workspace_id: UUID, email: str, role: str, actor_id: UUID):
        actor = await self.repo.membership(workspace_id, actor_id)
        if actor is None or actor.role not in {"owner", "admin"}:
            raise EntityNotFoundError("Workspace not found or insufficient permission")
        user = await self.users.get_by_email(email)
        if user is None:
            raise EntityNotFoundError("User must sign in before being added")
        member = await self.repo.add_member(workspace_id, user.id, role)
        workspace = await self.repo.get(workspace_id)
        await self.notifications.create(
            {
                "user_id": user.id,
                "kind": "workspace_membership",
                "message": f"You were added to {workspace.name}",
                "target_path": "/",
                "is_read": False,
            }
        )
        return {"id": user.id, "name": user.name, "email": user.email, "role": member.role}

    async def invite(self, workspace_id: UUID, email: str, role: str, actor_id: UUID):
        actor = await self.repo.membership(workspace_id, actor_id)
        if actor is None or actor.role not in {"owner", "admin"}:
            raise EntityNotFoundError("Workspace not found or insufficient permission")
        invitation = await self.repo.create_invitation(workspace_id, email, role, actor_id)
        user = await self.users.get_by_email(email)
        if user is not None:
            await self.repo.add_member(workspace_id, user.id, role)
            invitation.accepted_at = datetime.now(UTC)
            workspace = await self.repo.get(workspace_id)
            await self.notifications.create(
                {
                    "user_id": user.id,
                    "kind": "workspace_membership",
                    "message": f"You were added to {workspace.name}",
                    "target_path": "/",
                    "is_read": False,
                }
            )
            await self.repo.session.flush()
        return invitation
