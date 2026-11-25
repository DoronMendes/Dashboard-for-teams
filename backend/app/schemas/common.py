"""Shared schema building blocks."""

import uuid
from datetime import datetime
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class ORMModel(BaseModel):
    """Base for anything read out of SQLAlchemy."""

    model_config = ConfigDict(from_attributes=True)


class IdentifiedModel(ORMModel):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class Page(BaseModel, Generic[T]):
    """Envelope for list endpoints, so pagination can grow without breaking clients."""

    items: list[T]
    total: int = Field(ge=0)
    skip: int = Field(ge=0)
    limit: int = Field(ge=1)


class HealthStatus(BaseModel):
    status: str
    service: str
    version: str
    environment: str


class DatabaseHealthStatus(HealthStatus):
    database: str
    latency_ms: float | None = None
