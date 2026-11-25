from typing import Literal

from pydantic import UUID4, BaseModel, Field

from app.schemas.common import IdentifiedModel


class IssueReportCreate(BaseModel):
    workspace_id: UUID4
    title: str = Field(min_length=3, max_length=160)
    description: str = Field(min_length=10, max_length=5000)
    category: Literal["display", "link", "permissions", "login", "other"]
    urgency: Literal["low", "normal", "high"] = "normal"
    page_url: str | None = Field(default=None, max_length=1024)


class IssueReportResponse(IdentifiedModel):
    workspace_id: UUID4
    reporter_id: UUID4
    title: str
    description: str
    category: str
    urgency: str
    page_url: str | None
    status: str


class IssueReportDetailResponse(IssueReportResponse):
    reporter_name: str
    reporter_email: str
    workspace_name: str
