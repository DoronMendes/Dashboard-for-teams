"""Generic persistence contract + its SQLAlchemy implementation.

Why this exists (Open/Closed + Dependency Inversion):

* Endpoints and services depend on ``AbstractRepository``, never on SQLAlchemy.
  Swapping the storage engine, or faking it in tests, means writing a new
  implementation -- not editing the callers.
* New entities are added by *extending* ``SQLAlchemyRepository`` with a new
  ``model``; the CRUD code below is never modified.
* Repositories never commit. The request-scoped session owns the transaction
  (see ``app.db.session.get_db_session``) so several repositories can take part
  in one atomic unit of work.
"""

from abc import ABC, abstractmethod
from typing import Any, Generic, TypeVar
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Select

from app.db.base_class import Base

ModelType = TypeVar("ModelType", bound=Base)


class AbstractRepository(ABC, Generic[ModelType]):
    """Storage-agnostic contract every repository honours."""

    @abstractmethod
    async def get(self, entity_id: UUID) -> ModelType | None: ...

    @abstractmethod
    async def list(self, *, skip: int = 0, limit: int = 100, **filters: Any) -> list[ModelType]: ...

    @abstractmethod
    async def count(self, **filters: Any) -> int: ...

    @abstractmethod
    async def create(self, data: dict[str, Any]) -> ModelType: ...

    @abstractmethod
    async def update(self, entity: ModelType, data: dict[str, Any]) -> ModelType: ...

    @abstractmethod
    async def delete(self, entity: ModelType) -> None: ...


class SQLAlchemyRepository(AbstractRepository[ModelType], Generic[ModelType]):
    """Reusable async CRUD over a single mapped model.

    Subclasses set ``model`` and may add query methods; they should not need to
    override anything here.
    """

    model: type[ModelType]

    # `populate_existing` makes reads overwrite objects already in the identity
    # map. Without it, an entity loaded earlier in the same request keeps its
    # stale relationship collections -- e.g. a Project fetched after links were
    # added through LinkRepository would still report zero links.
    _READ_OPTIONS = {"populate_existing": True}

    def __init__(self, session: AsyncSession) -> None:
        if getattr(self, "model", None) is None:
            raise NotImplementedError(f"{type(self).__name__} must define a `model` attribute")
        self.session = session

    # -- hooks -------------------------------------------------------------
    def _base_query(self) -> Select[tuple[ModelType]]:
        """Override in a subclass to add eager loading or default scoping."""
        return select(self.model)

    def _apply_filters(self, stmt: Select[Any], filters: dict[str, Any]) -> Select[Any]:
        """Equality filters on mapped columns; unknown keys are ignored."""
        for field, value in filters.items():
            if value is None:
                continue
            column = getattr(self.model, field, None)
            if column is not None:
                stmt = stmt.where(column == value)
        return stmt

    # -- contract ----------------------------------------------------------
    async def get(self, entity_id: UUID) -> ModelType | None:
        stmt = self._base_query().where(self.model.id == entity_id)
        result = await self.session.execute(stmt, execution_options=self._READ_OPTIONS)
        return result.scalars().unique().one_or_none()

    async def list(self, *, skip: int = 0, limit: int = 100, **filters: Any) -> list[ModelType]:
        stmt = self._apply_filters(self._base_query(), filters)
        stmt = stmt.order_by(self.model.created_at.desc()).offset(skip).limit(limit)
        result = await self.session.execute(stmt, execution_options=self._READ_OPTIONS)
        return list(result.scalars().unique().all())

    async def count(self, **filters: Any) -> int:
        stmt = self._apply_filters(select(func.count()).select_from(self.model), filters)
        result = await self.session.execute(stmt)
        return int(result.scalar_one())

    async def create(self, data: dict[str, Any]) -> ModelType:
        entity = self.model(**data)
        self.session.add(entity)
        await self.session.flush()  # populates defaults/ids without committing
        await self.session.refresh(entity)
        return entity

    async def update(self, entity: ModelType, data: dict[str, Any]) -> ModelType:
        for field, value in data.items():
            setattr(entity, field, value)
        self.session.add(entity)
        await self.session.flush()
        await self.session.refresh(entity)
        return entity

    async def delete(self, entity: ModelType) -> None:
        await self.session.delete(entity)
        await self.session.flush()
