"""Link business rules."""

from uuid import UUID

from app.core.exceptions import EntityNotFoundError
from app.models.link import Link
from app.models.enums import LinkHealthStatus
from app.repositories.link import LinkRepository
from app.repositories.project import ProjectRepository
from app.repositories.taxonomy import BookmarkRepository, TagRepository
from app.repositories.engagement import ActivityRepository
from app.repositories.collaboration import CollaborationRepository
from app.schemas.link import LinkCreate, LinkUpdate


class LinkService:
    def __init__(self, links: LinkRepository, projects: ProjectRepository, tags: TagRepository, bookmarks: BookmarkRepository, activities: ActivityRepository, collaboration: CollaborationRepository) -> None:
        self.links = links
        self.projects = projects
        self.tags = tags
        self.bookmarks = bookmarks
        self.activities = activities
        self.collaboration = collaboration

    async def _ensure_can_edit(self, project_id: UUID, user_id: UUID, admin_only: bool = False) -> None:
        project = await self.projects.get_for_owner(project_id, user_id)
        if project is None: raise EntityNotFoundError("Project does not exist")
        membership = await self.collaboration.membership(project.workspace_id, user_id)
        allowed = {"owner", "admin"} if admin_only else {"owner", "admin", "editor"}
        if membership is None or membership.role not in allowed: raise EntityNotFoundError("Insufficient permission")

    async def _ensure_project_exists(self, project_id: UUID, owner_id: UUID) -> None:
        """Fail with 404 rather than letting the FK raise a 500 on insert."""
        if await self.projects.get_for_owner(project_id, owner_id) is None:
            raise EntityNotFoundError(f"Project {project_id} does not exist")

    async def get(self, link_id: UUID, owner_id: UUID) -> Link:
        link = await self.links.get_for_owner(link_id, owner_id)
        if link is None:
            raise EntityNotFoundError(f"Link {link_id} does not exist")
        return link

    async def list_for_project(
        self,
        project_id: UUID,
        owner_id: UUID,
        *,
        category: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Link]:
        await self._ensure_project_exists(project_id, owner_id)
        return await self.links.list_by_project(
            project_id, category=category, skip=skip, limit=limit
        )

    async def create_for_project(
        self,
        project_id: UUID,
        payload: LinkCreate,
        owner_id: UUID,
    ) -> Link:
        await self._ensure_project_exists(project_id, owner_id)
        await self._ensure_can_edit(project_id, owner_id)
        data = payload.model_dump(exclude={"tags"})
        link = await self.links.create(
            {
                **data,
                "project_id": project_id,
                "creator_id": owner_id,
                "position": await self.links.next_position(project_id),
            }
        )
        link.tags = await self.tags.resolve(owner_id, payload.tags)
        await self.links.session.flush()
        await self.activities.create({"user_id": owner_id, "action": "created", "entity_type": "link", "entity_id": link.id, "project_id": project_id, "details": {"title": link.title}})
        return await self.get(link.id, owner_id)

    async def reorder_for_project(
        self,
        project_id: UUID,
        ordered_ids: list[UUID],
        owner_id: UUID,
    ) -> None:
        await self._ensure_project_exists(project_id, owner_id)
        await self._ensure_can_edit(project_id, owner_id)
        if not await self.links.reorder(project_id, ordered_ids):
            raise EntityNotFoundError("One or more links do not belong to this project")

    async def update(self, link_id: UUID, payload: LinkUpdate, owner_id: UUID) -> Link:
        link = await self.get(link_id, owner_id)
        await self._ensure_can_edit(link.project_id, owner_id)
        changes = payload.model_dump(exclude_unset=True, exclude={"tags"})
        if "url" in changes and changes["url"] != link.url:
            changes.update(
                status_code=None,
                health_status=LinkHealthStatus.CHECKING,
                last_checked_at=None,
                response_time_ms=None,
            )
        if payload.tags is not None:
            link.tags = await self.tags.resolve(owner_id, payload.tags)
        if not changes:
            return link
        updated = await self.links.update(link, changes)
        await self.activities.create({"user_id": owner_id, "action": "updated", "entity_type": "link", "entity_id": link.id, "project_id": link.project_id, "details": {"title": updated.title}})
        return updated

    async def set_bookmark(self, link_id: UUID, owner_id: UUID, enabled: bool) -> Link:
        link = await self.get(link_id, owner_id)
        bookmark = await self.bookmarks.get_for_user_link(owner_id, link_id)
        if enabled and bookmark is None:
            await self.bookmarks.create({"user_id": owner_id, "link_id": link_id})
        elif not enabled and bookmark is not None:
            await self.bookmarks.delete(bookmark)
        return await self.get(link_id, owner_id)

    async def delete(self, link_id: UUID, owner_id: UUID) -> None:
        link = await self.get(link_id, owner_id)
        await self._ensure_can_edit(link.project_id, owner_id, admin_only=True)
        await self.activities.create({"user_id": owner_id, "action": "deleted", "entity_type": "link", "entity_id": None, "project_id": link.project_id, "details": {"title": link.title}})
        await self.links.delete(link)
