"""Liveness and readiness probes."""

import time

from fastapi import APIRouter, status
from sqlalchemy import text

from app.core.config import settings
from app.db.session import engine
from app.schemas.common import DatabaseHealthStatus, HealthStatus

router = APIRouter(tags=["health"])

API_VERSION = "0.1.0"


@router.get("/health", response_model=HealthStatus, summary="Liveness probe")
async def health() -> HealthStatus:
    """Cheap check: the process is up and serving. Touches no dependencies."""
    return HealthStatus(
        status="ok",
        service=settings.PROJECT_NAME,
        version=API_VERSION,
        environment=settings.ENVIRONMENT,
    )


@router.get(
    "/health/db",
    response_model=DatabaseHealthStatus,
    summary="Readiness probe",
    responses={status.HTTP_503_SERVICE_UNAVAILABLE: {"model": DatabaseHealthStatus}},
)
async def health_db() -> DatabaseHealthStatus:
    """Readiness check: can we actually reach Postgres?"""
    started = time.perf_counter()
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
        database_state = "connected"
        overall = "ok"
    except Exception:
        database_state = "unavailable"
        overall = "degraded"

    return DatabaseHealthStatus(
        status=overall,
        service=settings.PROJECT_NAME,
        version=API_VERSION,
        environment=settings.ENVIRONMENT,
        database=database_state,
        latency_ms=round((time.perf_counter() - started) * 1000, 2),
    )
