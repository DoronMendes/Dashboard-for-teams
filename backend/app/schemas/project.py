from pydantic import UUID4, BaseModel, ConfigDict, Field, field_validator

from app.schemas.common import IdentifiedModel
from app.schemas.link import LinkResponse


class ProjectFieldRules(BaseModel):
    """Validation shared by the create and update schemas."""

    @field_validator("name", check_fields=False)
    @classmethod
    def _strip_name(cls, value: str | None) -> str | None:
        return value.strip() if value is not None else None


class ProjectBase(ProjectFieldRules):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    is_pinned: bool = False


class ProjectCreate(ProjectBase):
    workspace_id: UUID4 | None = None
    team_id: UUID4 | None = None


class ProjectUpdate(ProjectFieldRules):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    is_pinned: bool | None = None
    team_id: UUID4 | None = None


class ProjectResponse(IdentifiedModel, ProjectBase):
    """Always carries its links -- the dashboard renders them together."""

    position: int
    workspace_id: UUID4
    team_id: UUID4 | None
    links: list[LinkResponse] = []
