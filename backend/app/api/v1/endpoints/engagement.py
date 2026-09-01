from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, EngagementSvc
from app.schemas.engagement import (
    ActiveUsersResponse,
    ActivityResponse,
    AnalyticsResponse,
    ClickTrendPoint,
    NotificationResponse,
    TopProjectResponse,
    HealthSummaryResponse,
    VisitResponse,
)

router = APIRouter()


@router.get("/activity", response_model=list[ActivityResponse])
async def activity(service: EngagementSvc, current_user: CurrentUser):
    return [
        ActivityResponse.model_validate(item)
        for item in await service.recent_activity(current_user.id)
    ]


@router.get("/analytics", response_model=AnalyticsResponse)
async def analytics(service: EngagementSvc, current_user: CurrentUser):
    return await service.analytics(current_user.id)


@router.get("/analytics/health-summary", response_model=HealthSummaryResponse)
async def health_summary(service: EngagementSvc, current_user: CurrentUser):
    return await service.health_summary(current_user.id)


@router.get("/analytics/clicks-trend", response_model=list[ClickTrendPoint])
async def clicks_trend(
    service: EngagementSvc,
    current_user: CurrentUser,
    interval: Literal["daily", "weekly", "monthly"] = "daily",
    range: Literal["30d", "90d", "365d"] = "30d",
):
    return await service.clicks_trend(current_user.id, interval, int(range[:-1]))


@router.get("/analytics/active-users", response_model=ActiveUsersResponse)
async def active_users(
    service: EngagementSvc, current_user: CurrentUser, range: Literal["7d", "30d", "all"] = "7d"
):
    return await service.active_users(current_user.id, None if range == "all" else int(range[:-1]))


@router.get("/analytics/top-projects", response_model=list[TopProjectResponse])
async def top_projects(
    service: EngagementSvc, current_user: CurrentUser, limit: int = Query(5, ge=1, le=20)
):
    return await service.top_projects(current_user.id, limit)


@router.post("/links/{link_id}/visit", response_model=VisitResponse)
async def visit(link_id: UUID, service: EngagementSvc, current_user: CurrentUser):
    return {"url": await service.record_visit(link_id, current_user.id)}


@router.get("/notifications", response_model=list[NotificationResponse])
async def notifications(service: EngagementSvc, current_user: CurrentUser):
    return [
        NotificationResponse.model_validate(item)
        for item in await service.recent_notifications(current_user.id)
    ]


@router.get("/notifications/unread-count")
async def unread_count(service: EngagementSvc, current_user: CurrentUser):
    return {"count": await service.unread_count(current_user.id)}


@router.put("/notifications/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_read(service: EngagementSvc, current_user: CurrentUser):
    await service.mark_all_read(current_user.id)
