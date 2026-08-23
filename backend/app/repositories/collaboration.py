from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.collaboration import Team, Workspace, WorkspaceInvitation, WorkspaceMembership
from app.repositories.base import SQLAlchemyRepository


class CollaborationRepository(SQLAlchemyRepository[Workspace]):
    model = Workspace

    async def memberships(self, user_id: UUID) -> list[WorkspaceMembership]:
        result = await self.session.execute(
            select(WorkspaceMembership)
            .options(selectinload(WorkspaceMembership.workspace).selectinload(Workspace.teams))
            .where(WorkspaceMembership.user_id == user_id)
        )
        return list(result.scalars().all())

    async def ensure_default(self, user_id: UUID, user_name: str) -> WorkspaceMembership:
        memberships = await self.memberships(user_id)
        if memberships:
            return memberships[0]
        workspace = Workspace(name=f"{user_name} Workspace")
        self.session.add(workspace)
        await self.session.flush()
        membership = WorkspaceMembership(workspace_id=workspace.id, user_id=user_id, role="owner")
        self.session.add(membership)
        await self.session.flush()
        return membership

    async def membership(self, workspace_id: UUID, user_id: UUID) -> WorkspaceMembership | None:
        result = await self.session.execute(
            select(WorkspaceMembership).where(
                WorkspaceMembership.workspace_id == workspace_id,
                WorkspaceMembership.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def create_team(self, workspace_id: UUID, name: str) -> Team:
        team = Team(workspace_id=workspace_id, name=name.strip())
        self.session.add(team)
        await self.session.flush()
        await self.session.refresh(team)
        return team

    async def add_member(self, workspace_id: UUID, user_id: UUID, role: str) -> WorkspaceMembership:
        existing = await self.membership(workspace_id, user_id)
        if existing:
            existing.role = role
            await self.session.flush()
            return existing
        member = WorkspaceMembership(workspace_id=workspace_id, user_id=user_id, role=role)
        self.session.add(member)
        await self.session.flush()
        return member

    async def invitations_for_email(
        self, email: str, pending_only: bool = True
    ) -> list[WorkspaceInvitation]:
        stmt = select(WorkspaceInvitation).where(
            WorkspaceInvitation.email == email.strip().casefold()
        )
        if pending_only:
            stmt = stmt.where(WorkspaceInvitation.accepted_at.is_(None))
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create_invitation(
        self, workspace_id: UUID, email: str, role: str, invited_by_id: UUID
    ) -> WorkspaceInvitation:
        normalized = email.strip().casefold()
        result = await self.session.execute(
            select(WorkspaceInvitation).where(
                WorkspaceInvitation.workspace_id == workspace_id,
                WorkspaceInvitation.email == normalized,
            )
        )
        invitation = result.scalar_one_or_none()
        if invitation is None:
            invitation = WorkspaceInvitation(
                workspace_id=workspace_id, email=normalized, role=role, invited_by_id=invited_by_id
            )
            self.session.add(invitation)
        else:
            invitation.role, invitation.invited_by_id, invitation.accepted_at = (
                role,
                invited_by_id,
                None,
            )
        await self.session.flush()
        await self.session.refresh(invitation)
        return invitation
