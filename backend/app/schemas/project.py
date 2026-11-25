import base64
import binascii
import re

from pydantic import UUID4, BaseModel, ConfigDict, Field, field_validator

from app.schemas.common import IdentifiedModel
from app.schemas.link import LinkResponse


class ProjectFieldRules(BaseModel):
    """Validation shared by the create and update schemas."""

    @field_validator("name", check_fields=False)
    @classmethod
    def _strip_name(cls, value: str | None) -> str | None:
        return value.strip() if value is not None else None

    @field_validator("icon", check_fields=False)
    @classmethod
    def _normalize_icon(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            return None
        if not normalized.startswith("data:"):
            if len(normalized) > 32:
                raise ValueError("Emoji icons may contain at most 32 characters")
            return normalized

        match = re.fullmatch(
            r"data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)",
            normalized,
        )
        if match is None:
            raise ValueError("Uploaded icons must be PNG, JPEG, or WebP images")
        try:
            image_bytes = base64.b64decode(match.group(2), validate=True)
        except (binascii.Error, ValueError) as exc:
            raise ValueError("Uploaded icon data is invalid") from exc
        if len(image_bytes) > 512 * 1024:
            raise ValueError("Uploaded icons may be at most 512 KB")
        return normalized


class ProjectBase(ProjectFieldRules):
    name: str = Field(min_length=1, max_length=255)
    icon: str | None = None
    description: str | None = Field(default=None, max_length=5000)
    is_pinned: bool = False


class ProjectCreate(ProjectBase):
    workspace_id: UUID4 | None = None
    team_id: UUID4 | None = None


class ProjectUpdate(ProjectFieldRules):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=255)
    icon: str | None = None
    description: str | None = Field(default=None, max_length=5000)
    is_pinned: bool | None = None
    team_id: UUID4 | None = None


class ProjectResponse(IdentifiedModel, ProjectBase):
    """Always carries its links -- the dashboard renders them together."""

    position: int
    workspace_id: UUID4
    team_id: UUID4 | None
    links: list[LinkResponse] = []
