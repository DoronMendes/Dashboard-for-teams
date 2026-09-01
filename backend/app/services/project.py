"""Project business rules.

Services own the rules; repositories own persistence; routers own HTTP. Keeping
them apart means a rule change never touches a query, and neither touches a
route signature. Services raise domain errors -- they never import fastapi.
"""

from __future__ import annotations

from uuid import UUID

from app.core.exceptions import DuplicateEntityError, EntityNotFoundError
from app.models.project import Project
from app.repositories.project import ProjectRepository
from app.repositories.engagement import ActivityRepository
from app.repositories.collaboration import CollaborationRepository
from app.schemas.project import ProjectCreate, ProjectUpdate


class ProjectService:
    def __init__(self, projects: ProjectRepository, activities: ActivityRepository, collaboration: CollaborationRepository) -> None:
        self.projects = projects
        self.activities = activities
        self.collaboration = collaboration

    async def get(self, project_id: UUID, owner_id: UUID) -> Project:
        project = await self.projects.get_for_owner(project_id, owner_id)
        if project is None:
            raise EntityNotFoundError(f"Project {project_id} does not exist")
        return project

    async def list(
        self,
        owner_id: UUID,
        *,
        q: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Project]:
        return await self.projects.search(owner_id, q, skip=skip, limit=limit)

    async def create(self, payload: ProjectCreate, owner_id: UUID) -> Project:
        membership = await self.collaboration.ensure_default(owner_id, "My") if payload.workspace_id is None else await self.collaboration.membership(payload.workspace_id, owner_id)
        if membership is None or membership.role not in {"owner", "admin", "editor"}:
            raise EntityNotFoundError("Workspace not found or insufficient permission")
        if await self.projects.name_taken(membership.workspace_id, payload.name):
            raise DuplicateEntityError(f"A project named {payload.name!r} already exists")
        project = await self.projects.create(
            {
                **payload.model_dump(exclude={"workspace_id", "team_id"}),
                "owner_id": owner_id,
                "workspace_id": membership.workspace_id,
                "team_id": payload.team_id,
                "position": await self.projects.next_position(membership.workspace_id),
            }
        )
        await self.activities.create({"user_id": owner_id, "action": "created", "entity_type": "project", "entity_id": project.id, "project_id": project.id, "details": {"name": project.name}})
        return project

    async def reorder(self, ordered_ids: list[UUID], owner_id: UUID) -> None:
        if ordered_ids:
            project = await self.get(ordered_ids[0], owner_id)
            membership = await self.collaboration.membership(project.workspace_id, owner_id)
            if membership is None or membership.role not in {"owner", "admin", "editor"}:
                raise EntityNotFoundError("Insufficient permission")
        if not await self.projects.reorder(owner_id, ordered_ids):
            raise EntityNotFoundError("One or more projects do not exist")

    async def update(
        self,
        project_id: UUID,
        payload: ProjectUpdate,
        owner_id: UUID,
    ) -> Project:
        project = await self.get(project_id, owner_id)
        membership = await self.collaboration.membership(project.workspace_id, owner_id)
        if membership is None or membership.role not in {"owner", "admin", "editor"}:
            raise EntityNotFoundError("Project not found or insufficient permission")
        # exclude_unset -> an omitted field is left alone, an explicit null clears it
        changes = payload.model_dump(exclude_unset=True)
        personal_pin = changes.pop("is_pinned", None)
        if personal_pin is not None:
            await self.projects.set_pin(owner_id, project_id, personal_pin)
            from sqlalchemy.orm.attributes import set_committed_value
            set_committed_value(project, "is_pinned", personal_pin)
        if not changes:
            return project
        new_name = changes.get("name")
        if new_name and await self.projects.name_taken(
            project.workspace_id,
            new_name,
            exclude_id=project_id,
        ):
            raise DuplicateEntityError(f"A project named {new_name!r} already exists")
        updated = await self.projects.update(project, changes)
        await self.activities.create({"user_id": owner_id, "action": "updated", "entity_type": "project", "entity_id": project.id, "project_id": project.id, "details": {"name": updated.name}})
        return updated

    async def delete(self, project_id: UUID, owner_id: UUID) -> None:
        project = await self.get(project_id, owner_id)
        membership = await self.collaboration.membership(project.workspace_id, owner_id)
        if membership is None or membership.role not in {"owner", "admin"}:
            raise EntityNotFoundError("Project not found or insufficient permission")
        await self.activities.create({"user_id": owner_id, "action": "deleted", "entity_type": "project", "entity_id": None, "project_id": None, "details": {"name": project.name}})
        # Links go with it: ON DELETE CASCADE on the FK, delete-orphan in the ORM.
        await self.projects.delete(project)
