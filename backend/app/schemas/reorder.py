from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ReorderRequest(BaseModel):
    """An ordered, duplicate-free subset of resources in the caller's scope."""

    model_config = ConfigDict(extra="forbid")

    ids: list[UUID] = Field(min_length=1)

    @field_validator("ids")
    @classmethod
    def ids_must_be_unique(cls, value: list[UUID]) -> list[UUID]:
        if len(value) != len(set(value)):
            raise ValueError("ids must not contain duplicates")
        return value
