from datetime import datetime

from pydantic import UUID4, BaseModel, Field

from app.schemas.common import IdentifiedModel


class TeamResponse(IdentifiedModel):
    workspace_id: UUID4
    name: str


class MemberResponse(BaseModel):
    id: UUID4
    name: str
    email: str
    role: str


class WorkspaceResponse(IdentifiedModel):
    name: str
    role: str
    teams: list[TeamResponse]
    members: list[MemberResponse]


class TeamCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class MemberCreate(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    role: str = Field(pattern="^(admin|editor|viewer)$")


class InvitationResponse(IdentifiedModel):
    workspace_id: UUID4
    email: str
    role: str
    accepted_at: datetime | None
