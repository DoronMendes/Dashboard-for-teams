from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload, with_loader_criteria
from sqlalchemy.orm.attributes import set_committed_value
from sqlalchemy.sql import Select

from app.models.project import Project
from app.models.link import Link
from app.models.taxonomy import Bookmark, ProjectPin, Tag
from app.models.collaboration import WorkspaceMembership
from app.repositories.base import SQLAlchemyRepository


class ProjectRepository(SQLAlchemyRepository[Project]):
    """Project reads always carry their links; adds name search/lookup."""

    model = Project

    def _base_query(self, owner_id: UUID) -> Select[tuple[Project]]:
        # selectinload issues one extra query for all links in the result set,
        # so listing N projects stays at 2 queries rather than N+1.
        return select(Project).options(
            selectinload(Project.links),
            with_loader_criteria(Bookmark, Bookmark.user_id == owner_id),
        )

    async def _apply_personal_pins(self, projects: list[Project], owner_id: UUID) -> list[Project]:
        if not projects:
            return projects
        result = await self.session.execute(
            select(ProjectPin.project_id).where(
                ProjectPin.user_id == owner_id,
                ProjectPin.project_id.in_([project.id for project in projects]),
            )
        )
        pinned_ids = set(result.scalars().all())
        for project in projects:
            set_committed_value(project, "is_pinned", project.id in pinned_ids)
        return sorted(projects, key=lambda project: (not project.is_pinned, project.position, project.created_at))

    async def set_pin(self, owner_id: UUID, project_id: UUID, enabled: bool) -> None:
        result = await self.session.execute(select(ProjectPin).where(ProjectPin.user_id == owner_id, ProjectPin.project_id == project_id))
        pin = result.scalar_one_or_none()
        if enabled and pin is None:
            self.session.add(ProjectPin(user_id=owner_id, project_id=project_id))
        elif not enabled and pin is not None:
            await self.session.delete(pin)
        await self.session.flush()

    async def search(
        self,
        owner_id: UUID,
        query: str | None = None,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Project]:
        """Case-insensitive partial match on name or description."""
        stmt = self._base_query(owner_id).where(Project.workspace_id.in_(select(WorkspaceMembership.workspace_id).where(WorkspaceMembership.user_id == owner_id)))
        if query:
            pattern = f"%{query.strip()}%"
            stmt = stmt.where(
                or_(
                    Project.name.ilike(pattern),
                    Project.description.ilike(pattern),
                    Project.links.any(or_(Link.title.ilike(pattern), Link.url.ilike(pattern))),
                    Project.links.any(Link.tags.any(Tag.name.ilike(pattern))),
                )
            )
        stmt = (
            stmt.order_by(
                Project.position.asc(),
                Project.created_at.asc(),
            )
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(stmt, execution_options=self._READ_OPTIONS)
        return await self._apply_personal_pins(list(result.scalars().unique().all()), owner_id)

    async def get_for_owner(self, project_id: UUID, owner_id: UUID) -> Project | None:
        result = await self.session.execute(
            self._base_query(owner_id).where(
                Project.id == project_id,
                Project.workspace_id.in_(select(WorkspaceMembership.workspace_id).where(WorkspaceMembership.user_id == owner_id)),
            ),
            execution_options=self._READ_OPTIONS,
        )
        project = result.scalars().unique().one_or_none()
        if project is not None:
            await self._apply_personal_pins([project], owner_id)
        return project

    async def next_position(self, workspace_id: UUID) -> int:
        result = await self.session.execute(
            select(func.coalesce(func.max(Project.position), -1) + 1).where(
                Project.workspace_id == workspace_id
            )
        )
        return int(result.scalar_one())

    async def reorder(self, owner_id: UUID, ordered_ids: list[UUID]) -> bool:
        """Reorder a scoped subset while preserving every omitted row's slot."""
        result = await self.session.execute(
            select(Project).where(
                Project.workspace_id.in_(select(WorkspaceMembership.workspace_id).where(WorkspaceMembership.user_id == owner_id)),
                Project.id.in_(ordered_ids),
            )
        )
        projects = list(result.scalars().all())
        if len(projects) != len(ordered_ids):
            return False

        by_id = {project.id: project for project in projects}
        slots = sorted(project.position for project in projects)
        for project_id, position in zip(ordered_ids, slots, strict=True):
            by_id[project_id].position = position
        await self.session.flush()
        return True

    async def get_by_name(self, workspace_id: UUID, name: str) -> Project | None:
        result = await self.session.execute(
            self._base_query(workspace_id).where(
                Project.workspace_id == workspace_id,
                Project.name == name,
            ),
            execution_options=self._READ_OPTIONS,
        )
        return result.scalars().unique().one_or_none()

    async def name_taken(
        self,
        workspace_id: UUID,
        name: str,
        *,
        exclude_id: UUID | None = None,
    ) -> bool:
        """Uniqueness check that ignores the row being updated."""
        stmt = select(Project.id).where(
            Project.workspace_id == workspace_id,
            Project.name == name,
        )
        if exclude_id is not None:
            stmt = stmt.where(Project.id != exclude_id)
        result = await self.session.execute(stmt)
        return result.first() is not None
