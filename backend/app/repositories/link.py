from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import with_loader_criteria

from app.models.link import Link
from app.models.project import Project
from app.models.collaboration import WorkspaceMembership
from app.models.taxonomy import Bookmark
from app.repositories.base import SQLAlchemyRepository


class LinkRepository(SQLAlchemyRepository[Link]):
    model = Link

    async def get_for_owner(self, link_id: UUID, owner_id: UUID) -> Link | None:
        result = await self.session.execute(
            select(Link)
            .options(with_loader_criteria(Bookmark, Bookmark.user_id == owner_id))
            .join(Project, Project.id == Link.project_id)
            .where(Link.id == link_id, Project.workspace_id.in_(select(WorkspaceMembership.workspace_id).where(WorkspaceMembership.user_id == owner_id))),
            execution_options=self._READ_OPTIONS,
        )
        return result.scalar_one_or_none()

    async def list_for_owner(self, owner_id: UUID) -> list[Link]:
        result = await self.session.execute(
            select(Link)
            .options(with_loader_criteria(Bookmark, Bookmark.user_id == owner_id))
            .join(Project, Project.id == Link.project_id)
            .where(
                Project.workspace_id.in_(
                    select(WorkspaceMembership.workspace_id).where(
                        WorkspaceMembership.user_id == owner_id
                    )
                )
            )
            .order_by(Link.created_at.asc())
        )
        return list(result.scalars().unique().all())

    async def health_summary(self, owner_id: UUID) -> dict[str, int]:
        result = await self.session.execute(
            select(Link.health_status, func.count(Link.id))
            .join(Project, Project.id == Link.project_id)
            .where(
                Project.workspace_id.in_(
                    select(WorkspaceMembership.workspace_id).where(
                        WorkspaceMembership.user_id == owner_id
                    )
                )
            )
            .group_by(Link.health_status)
        )
        counts = {status: int(count) for status, count in result.all()}
        return {key: counts.get(key, 0) for key in ("healthy", "warning", "error")}

    async def list_by_project(
        self,
        project_id: UUID,
        *,
        category: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Link]:
        stmt = select(Link).where(Link.project_id == project_id)
        if category is not None:
            stmt = stmt.where(Link.category == category)
        stmt = stmt.order_by(Link.position.asc(), Link.created_at.asc()).offset(skip).limit(limit)
        result = await self.session.execute(
            stmt,
            execution_options=self._READ_OPTIONS,
        )
        return list(result.scalars().all())

    async def next_position(self, project_id: UUID) -> int:
        result = await self.session.execute(
            select(func.coalesce(func.max(Link.position), -1) + 1).where(
                Link.project_id == project_id
            )
        )
        return int(result.scalar_one())

    async def reorder(self, project_id: UUID, ordered_ids: list[UUID]) -> bool:
        result = await self.session.execute(
            select(Link).where(
                Link.project_id == project_id,
                Link.id.in_(ordered_ids),
            )
        )
        links = list(result.scalars().all())
        if len(links) != len(ordered_ids):
            return False

        by_id = {link.id: link for link in links}
        slots = sorted(link.position for link in links)
        for link_id, position in zip(ordered_ids, slots, strict=True):
            by_id[link_id].position = position
        await self.session.flush()
        return True

    async def count_by_project(self, project_id: UUID) -> int:
        return await self.count(project_id=project_id)

    async def delete_by_project(self, project_id: UUID) -> int:
        """The FK already cascades; this exists for explicit bulk operations."""
        result = await self.session.execute(select(Link).where(Link.project_id == project_id))
        links = list(result.scalars().all())
        for link in links:
            await self.session.delete(link)
        await self.session.flush()
        return len(links)
