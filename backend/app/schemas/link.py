from pydantic import UUID4, AnyUrl, BaseModel, ConfigDict, Field, field_validator

from app.models.enums import LinkCategory
from app.schemas.common import IdentifiedModel


class LinkFieldRules(BaseModel):
    """Validation shared by the create and update schemas.

    check_fields=False lets the same rules attach to LinkUpdate, where the
    fields are optional and may be absent.
    """

    @field_validator("url", check_fields=False)
    @classmethod
    def _validate_url(cls, value: str | None) -> str | None:
        """Validate the shape with AnyUrl but persist the caller's own string."""
        if value is None:
            return None
        cleaned = value.strip()
        AnyUrl(cleaned)
        return cleaned

    @field_validator("title", check_fields=False)
    @classmethod
    def _strip_title(cls, value: str | None) -> str | None:
        return value.strip() if value is not None else None


class LinkBase(LinkFieldRules):
    title: str = Field(min_length=1, max_length=255)
    url: str = Field(min_length=1, max_length=2048)
    category: LinkCategory = LinkCategory.OTHER
    tags: list[str] = Field(default_factory=list, max_length=20)

    @field_validator("tags")
    @classmethod
    def _clean_tags(cls, values: list[str]) -> list[str]:
        cleaned: list[str] = []
        for value in values:
            name = value.strip().lstrip("#")[:64]
            if name and name.casefold() not in {item.casefold() for item in cleaned}:
                cleaned.append(name)
        return cleaned


class LinkCreate(LinkBase):
    """project_id comes from the path, so the body never carries it."""


class LinkUpdate(LinkFieldRules):
    """Every field optional -> callers send only what changes."""

    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=255)
    url: str | None = Field(default=None, min_length=1, max_length=2048)
    category: LinkCategory | None = None
    tags: list[str] | None = Field(default=None, max_length=20)

    @field_validator("tags")
    @classmethod
    def _clean_update_tags(cls, values: list[str] | None) -> list[str] | None:
        return LinkBase._clean_tags(values) if values is not None else None


class CreatorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID4
    name: str
    email: str


class LinkResponse(IdentifiedModel):
    project_id: UUID4
    title: str
    url: str
    category: LinkCategory
    position: int
    tags: list[str] = Field(validation_alias="tag_names")
    creator: CreatorResponse
    is_bookmarked: bool
