"""FastAPI application factory and entry point."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.endpoints import health
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.db.session import engine

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
# Link health checks can generate hundreds of successful outbound HTTP log
# entries. Keep application-level INFO messages while only surfacing warnings
# and errors from the low-level HTTP client.
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
# Uvicorn otherwise prints one line for every browser poll and API request.
# Preserve startup/error output while keeping the terminal readable.
logging.getLogger("uvicorn.access").disabled = True
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    logger.info("Starting %s (env=%s)", settings.PROJECT_NAME, settings.ENVIRONMENT)
    yield
    await engine.dispose()  # close pooled connections cleanly
    logger.info("Shutdown complete")


def create_app() -> FastAPI:
    """Factory keeps startup wiring testable and importable."""
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version="0.1.0",
        description="Internal link-management portal, organised by project.",
        openapi_url=f"{settings.API_V1_PREFIX}/openapi.json" if settings.DEBUG else None,
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url="/redoc" if settings.DEBUG else None,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Total-Count"],
    )

    register_exception_handlers(app)

    # Unversioned probes for infrastructure (Docker/K8s/uptime checks)...
    app.include_router(health.router)
    # ...and the versioned API surface for clients.
    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    return app


app = create_app()


@app.get("/", tags=["meta"], include_in_schema=False)
async def root() -> dict[str, str]:
    return {"service": settings.PROJECT_NAME, "docs": "/docs", "health": "/health"}
