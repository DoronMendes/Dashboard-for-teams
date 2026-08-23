from datetime import UTC, datetime, timedelta
from uuid import UUID

from app.core.exceptions import EntityNotFoundError
from app.models.engagement import ActivityEvent, Notification
from app.repositories.engagement import ActivityRepository, NotificationRepository, VisitRepository
from app.repositories.link import LinkRepository
from app.repositories.project import ProjectRepository


class EngagementService:
    def __init__(
        self,
        activities: ActivityRepository,
        visits: VisitRepository,
        notifications: NotificationRepository,
        links: LinkRepository,
        projects: ProjectRepository,
    ) -> None:
        self.activities, self.visits, self.notifications = activities, visits, notifications
        self.links, self.projects = links, projects

    async def record_activity(
        self,
        user_id: UUID,
        action: str,
        entity_type: str,
        entity_id: UUID | None,
        project_id: UUID | None,
        details: dict,
    ) -> ActivityEvent:
        return await self.activities.create(
            {
                "user_id": user_id,
                "action": action,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "project_id": project_id,
                "details": details,
            }
        )

    async def recent_activity(self, user_id: UUID) -> list[ActivityEvent]:
        return await self.activities.recent(user_id)

    async def record_visit(self, link_id: UUID, user_id: UUID) -> str:
        link = await self.links.get_for_owner(link_id, user_id)
        if link is None:
            raise EntityNotFoundError(f"Link {link_id} does not exist")
        await self.visits.create({"link_id": link_id, "user_id": user_id})
        return link.url

    async def analytics(self, user_id: UUID) -> dict:
        projects = await self.projects.search(user_id, limit=200)
        top = await self.visits.most_visited(user_id)
        return {
            "total_projects": len(projects),
            "total_links": sum(len(p.links) for p in projects),
            "total_visits": await self.visits.count_for_owner(user_id),
            "weekly_visits": await self.visits.count_for_owner(
                user_id, datetime.now(UTC) - timedelta(days=7)
            ),
            "most_visited": (
                {"id": top[0].id, "title": top[0].title, "url": top[0].url, "visits": top[1]}
                if top
                else None
            ),
        }

    async def clicks_trend(self, user_id: UUID, interval: str, days: int) -> list[dict]:
        now = datetime.now(UTC)
        start = (now - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
        timestamps = await self.visits.timestamps(user_id, start)

        def bucket(value: datetime) -> datetime:
            value = value.astimezone(UTC)
            if interval == "weekly":
                return (value - timedelta(days=value.weekday())).replace(
                    hour=0, minute=0, second=0, microsecond=0
                )
            if interval == "monthly":
                return value.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            return value.replace(hour=0, minute=0, second=0, microsecond=0)

        counts: dict[datetime, int] = {}
        for timestamp in timestamps:
            key = bucket(timestamp)
            counts[key] = counts.get(key, 0) + 1

        points: list[dict] = []
        cursor = bucket(start)
        end = bucket(now)
        while cursor <= end:
            points.append({"date": cursor.date().isoformat(), "clicks": counts.get(cursor, 0)})
            if interval == "monthly":
                cursor = (cursor.replace(day=28) + timedelta(days=4)).replace(day=1)
            else:
                cursor += timedelta(days=7 if interval == "weekly" else 1)
        return points

    async def active_users(self, user_id: UUID, days: int | None) -> dict:
        now = datetime.now(UTC)
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        if days is None:
            total = await self.visits.distinct_users(user_id, None)
            previous = None
        else:
            current_start = now - timedelta(days=days)
            previous_start = current_start - timedelta(days=days)
            total = await self.visits.distinct_users(user_id, current_start)
            previous = await self.visits.distinct_users(user_id, previous_start, current_start)
        dau = await self.visits.distinct_users(user_id, today)
        delta = (
            None
            if previous is None
            else (
                0.0
                if previous == 0 and total == 0
                else 100.0
                if previous == 0
                else round((total - previous) / previous * 100, 1)
            )
        )
        return {
            "active_users": total,
            "previous_period_users": previous,
            "delta_percent": delta,
            "dau": dau,
        }

    async def top_projects(self, user_id: UUID, limit: int) -> list[dict]:
        rows = await self.visits.top_projects(user_id, limit)
        total_clicks = await self.visits.count_for_owner(user_id)
        for row in rows:
            row["traffic_share"] = (
                round(row["clicks"] / total_clicks * 100, 1) if total_clicks else 0.0
            )
        return rows

    async def recent_notifications(self, user_id: UUID) -> list[Notification]:
        return await self.notifications.recent(user_id)

    async def unread_count(self, user_id: UUID) -> int:
        return await self.notifications.unread_count(user_id)

    async def mark_all_read(self, user_id: UUID) -> None:
        for item in await self.notifications.recent(user_id, limit=200):
            item.is_read = True
        await self.notifications.session.flush()
