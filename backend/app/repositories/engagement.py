from datetime import datetime
from uuid import UUID

from sqlalchemy import distinct, func, select

from app.models.collaboration import WorkspaceMembership
from app.models.engagement import ActivityEvent, LinkVisit, Notification
from app.models.link import Link
from app.models.project import Project
from app.models.user import User
from app.repositories.base import SQLAlchemyRepository


class ActivityRepository(SQLAlchemyRepository[ActivityEvent]):
    model = ActivityEvent

    async def recent(self, user_id: UUID, limit: int = 20) -> list[ActivityEvent]:
        result = await self.session.execute(
            select(ActivityEvent)
            .where(ActivityEvent.user_id == user_id)
            .order_by(ActivityEvent.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())


class VisitRepository(SQLAlchemyRepository[LinkVisit]):
    model = LinkVisit

    async def count_for_owner(self, owner_id: UUID, since: datetime | None = None) -> int:
        accessible_workspaces = select(WorkspaceMembership.workspace_id).where(
            WorkspaceMembership.user_id == owner_id
        )
        stmt = (
            select(func.count())
            .select_from(LinkVisit)
            .join(Link)
            .join(Project)
            .where(Project.workspace_id.in_(accessible_workspaces))
        )
        if since:
            stmt = stmt.where(LinkVisit.created_at >= since)
        return int((await self.session.execute(stmt)).scalar_one())

    async def most_visited(self, owner_id: UUID) -> tuple[Link, int] | None:
        accessible_workspaces = select(WorkspaceMembership.workspace_id).where(
            WorkspaceMembership.user_id == owner_id
        )
        result = await self.session.execute(
            select(LinkVisit.link_id, func.count(LinkVisit.id).label("visits"))
            .join(Link, Link.id == LinkVisit.link_id)
            .join(Project, Project.id == Link.project_id)
            .where(Project.workspace_id.in_(accessible_workspaces))
            .group_by(LinkVisit.link_id)
            .order_by(func.count(LinkVisit.id).desc(), LinkVisit.link_id.asc())
            .limit(1)
        )
        row = result.first()
        if row is None:
            return None
        link_result = await self.session.execute(select(Link).where(Link.id == row.link_id))
        return link_result.scalars().unique().one(), int(row.visits)

    def _accessible_workspaces(self, user_id: UUID):
        return select(WorkspaceMembership.workspace_id).where(
            WorkspaceMembership.user_id == user_id
        )

    async def timestamps(self, user_id: UUID, since: datetime) -> list[datetime]:
        result = await self.session.execute(
            select(LinkVisit.created_at)
            .join(Link, Link.id == LinkVisit.link_id)
            .join(Project, Project.id == Link.project_id)
            .where(
                Project.workspace_id.in_(self._accessible_workspaces(user_id)),
                LinkVisit.created_at >= since,
            )
            .order_by(LinkVisit.created_at.asc())
        )
        return list(result.scalars().all())

    async def distinct_users(
        self, user_id: UUID, since: datetime | None, until: datetime | None = None
    ) -> int:
        stmt = (
            select(func.count(distinct(LinkVisit.user_id)))
            .join(Link, Link.id == LinkVisit.link_id)
            .join(Project, Project.id == Link.project_id)
            .where(Project.workspace_id.in_(self._accessible_workspaces(user_id)))
        )
        if since is not None:
            stmt = stmt.where(LinkVisit.created_at >= since)
        if until is not None:
            stmt = stmt.where(LinkVisit.created_at < until)
        return int((await self.session.execute(stmt)).scalar_one())

    async def top_projects(self, user_id: UUID, limit: int) -> list[dict]:
        result = await self.session.execute(
            select(
                Project.id,
                Project.name,
                User.name.label("creator_name"),
                User.email.label("creator_email"),
                func.count(distinct(Link.id)).label("links_count"),
                func.count(LinkVisit.id).label("clicks"),
                func.count(distinct(LinkVisit.user_id)).label("unique_visitors"),
            )
            .join(User, User.id == Project.owner_id)
            .outerjoin(Link, Link.project_id == Project.id)
            .outerjoin(LinkVisit, LinkVisit.link_id == Link.id)
            .where(Project.workspace_id.in_(self._accessible_workspaces(user_id)))
            .group_by(Project.id, Project.name, User.name, User.email)
            .order_by(func.count(LinkVisit.id).desc(), Project.name.asc())
            .limit(limit)
        )
        return [dict(row._mapping) for row in result.all()]


class NotificationRepository(SQLAlchemyRepository[Notification]):
    model = Notification

    async def recent(self, user_id: UUID, limit: int = 20) -> list[Notification]:
        result = await self.session.execute(
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def unread_count(self, user_id: UUID) -> int:
        return await self.count(user_id=user_id, is_read=False)
