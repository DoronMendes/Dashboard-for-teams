"""Aggregates every v1 router.

New feature areas are registered here; main.py does not change.
"""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    collaboration,
    engagement,
    health,
    imports,
    issues,
    links,
    projects,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(links.router, prefix="/links", tags=["links"])
api_router.include_router(engagement.router, tags=["engagement"])
api_router.include_router(collaboration.router, tags=["collaboration"])
api_router.include_router(imports.router, prefix="/imports", tags=["imports"])
api_router.include_router(issues.router, prefix="/issue-reports", tags=["issue reports"])
