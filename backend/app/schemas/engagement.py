from pydantic import UUID4, BaseModel

from app.schemas.common import IdentifiedModel
from app.schemas.link import CreatorResponse


class ActivityResponse(IdentifiedModel):
    action: str
    entity_type: str
    entity_id: UUID4 | None
    project_id: UUID4 | None
    details: dict
    user: CreatorResponse


class NotificationResponse(IdentifiedModel):
    kind: str
    message: str
    target_path: str | None
    is_read: bool


class MostVisited(BaseModel):
    id: UUID4
    title: str
    url: str
    visits: int


class AnalyticsResponse(BaseModel):
    total_projects: int
    total_links: int
    total_visits: int
    weekly_visits: int
    most_visited: MostVisited | None


class VisitResponse(BaseModel):
    url: str


class ClickTrendPoint(BaseModel):
    date: str
    clicks: int


class ActiveUsersResponse(BaseModel):
    active_users: int
    previous_period_users: int | None
    delta_percent: float | None
    dau: int


class TopProjectResponse(BaseModel):
    id: UUID4
    name: str
    creator_name: str
    creator_email: str
    links_count: int
    clicks: int
    unique_visitors: int
    traffic_share: float
