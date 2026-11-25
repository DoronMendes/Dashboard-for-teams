"""Test fixtures.

Runs against a throwaway SQLite file by default (no setup, fast, CI-friendly).
Point TEST_DATABASE_URL at Postgres to exercise the real engine, e.g.

    $env:TEST_DATABASE_URL="postgresql+asyncpg://dashboard:dashboard_dev_pw@localhost:5433/dashboard_test"

SQLite needs `PRAGMA foreign_keys=ON` or ON DELETE CASCADE is silently ignored,
which would make the cascade tests pass for the wrong reason.
"""

import asyncio
import os
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api.deps import get_current_user
from app.db.base import Base
from app.db.session import get_db_session
from app.main import app
from app.models.user import User

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "sqlite+aiosqlite:///./test_dashboard.db")
IS_SQLITE = TEST_DATABASE_URL.startswith("sqlite")


def make_test_engine():
    engine = create_async_engine(TEST_DATABASE_URL, future=True)
    if IS_SQLITE:

        @event.listens_for(engine.sync_engine, "connect")
        def _enable_foreign_keys(dbapi_connection, _record):  # noqa: ANN001
            dbapi_connection.execute("PRAGMA foreign_keys=ON")

    return engine


@pytest.fixture
def client() -> Iterator[TestClient]:
    """Fresh schema per test -> tests never depend on each other's data."""
    engine = make_test_engine()
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def _create_schema() -> None:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.drop_all)
            await connection.run_sync(Base.metadata.create_all)

    async def _drop_schema() -> None:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.drop_all)
        await engine.dispose()

    asyncio.run(_create_schema())

    async def _seed_user() -> User:
        async with session_factory() as session:
            user = User(
                email="test@example.com",
                name="Test User",
                google_id="google-test-user",
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
            return user

    test_user = asyncio.run(_seed_user())

    async def _override_session():
        async with session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db_session] = _override_session

    async def _override_current_user() -> User:
        return test_user

    app.dependency_overrides[get_current_user] = _override_current_user
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        asyncio.run(_drop_schema())
        if IS_SQLITE and os.path.exists("./test_dashboard.db"):
            os.remove("./test_dashboard.db")


@pytest.fixture
def project(client: TestClient) -> dict:
    """A persisted project to hang links off."""
    response = client.post(
        "/api/v1/projects",
        json={"name": "Payments API", "description": "Core billing service"},
    )
    assert response.status_code == 201, response.text
    return response.json()
