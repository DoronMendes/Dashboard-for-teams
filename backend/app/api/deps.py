"""Reusable FastAPI dependencies.

Routers depend on services, services on repositories, repositories on the
session. Everything is wired here, so overriding one provider in a test swaps
the whole layer beneath it.
"""

from typing import Annotated

from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.access import is_email_allowed
from app.core.security import InvalidAccessTokenError, decode_access_token
from app.db.session import get_db_session
from app.models.user import User
from app.repositories.collaboration import CollaborationRepository
from app.repositories.engagement import ActivityRepository, NotificationRepository, VisitRepository
from app.repositories.link import LinkRepository
from app.repositories.project import ProjectRepository
from app.repositories.taxonomy import BookmarkRepository, TagRepository
from app.repositories.user import UserRepository
from app.services.auth import AuthService
from app.services.collaboration import CollaborationService
from app.services.engagement import EngagementService
from app.services.link import LinkService
from app.services.link_health import LinkHealthService
from app.services.oauth import OAuthService
from app.services.project import ProjectService

DBSession = Annotated[AsyncSession, Depends(get_db_session)]


def get_project_repository(session: DBSession) -> ProjectRepository:
    return ProjectRepository(session)


def get_link_repository(session: DBSession) -> LinkRepository:
    return LinkRepository(session)


def get_user_repository(session: DBSession) -> UserRepository:
    return UserRepository(session)


def get_tag_repository(session: DBSession) -> TagRepository:
    return TagRepository(session)


def get_bookmark_repository(session: DBSession) -> BookmarkRepository:
    return BookmarkRepository(session)


def get_activity_repository(session: DBSession) -> ActivityRepository:
    return ActivityRepository(session)


def get_visit_repository(session: DBSession) -> VisitRepository:
    return VisitRepository(session)


def get_notification_repository(session: DBSession) -> NotificationRepository:
    return NotificationRepository(session)


def get_collaboration_repository(session: DBSession) -> CollaborationRepository:
    return CollaborationRepository(session)


ProjectRepo = Annotated[ProjectRepository, Depends(get_project_repository)]
LinkRepo = Annotated[LinkRepository, Depends(get_link_repository)]
UserRepo = Annotated[UserRepository, Depends(get_user_repository)]
TagRepo = Annotated[TagRepository, Depends(get_tag_repository)]
BookmarkRepo = Annotated[BookmarkRepository, Depends(get_bookmark_repository)]
ActivityRepo = Annotated[ActivityRepository, Depends(get_activity_repository)]
VisitRepo = Annotated[VisitRepository, Depends(get_visit_repository)]
NotificationRepo = Annotated[NotificationRepository, Depends(get_notification_repository)]
CollaborationRepo = Annotated[CollaborationRepository, Depends(get_collaboration_repository)]

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    users: UserRepo,
    collaboration: CollaborationRepo,
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing access token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise unauthorized
    try:
        user_id = decode_access_token(credentials.credentials)
    except InvalidAccessTokenError as exc:
        raise unauthorized from exc
    user = await users.get_user(user_id)
    if user is None:
        raise unauthorized
    if not is_email_allowed(user.email) and not await collaboration.memberships(user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is not authorized to use the application",
        )
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_project_service(
    projects: ProjectRepo, activities: ActivityRepo, collaboration: CollaborationRepo
) -> ProjectService:
    return ProjectService(projects, activities, collaboration)


def get_link_service(
    links: LinkRepo,
    projects: ProjectRepo,
    tags: TagRepo,
    bookmarks: BookmarkRepo,
    activities: ActivityRepo,
    collaboration: CollaborationRepo,
) -> LinkService:
    return LinkService(links, projects, tags, bookmarks, activities, collaboration)


def get_link_health_service(links: LinkRepo) -> LinkHealthService:
    return LinkHealthService(links)


def get_engagement_service(
    activities: ActivityRepo,
    visits: VisitRepo,
    notifications: NotificationRepo,
    links: LinkRepo,
    projects: ProjectRepo,
) -> EngagementService:
    return EngagementService(activities, visits, notifications, links, projects)


def get_collaboration_service(
    repo: CollaborationRepo, users: UserRepo, notifications: NotificationRepo
) -> CollaborationService:
    return CollaborationService(repo, users, notifications)


def get_auth_service(users: UserRepo, collaboration: CollaborationRepo) -> AuthService:
    return AuthService(users, collaboration)


def get_oauth_service() -> OAuthService:
    return OAuthService()


ProjectSvc = Annotated[ProjectService, Depends(get_project_service)]
LinkSvc = Annotated[LinkService, Depends(get_link_service)]
LinkHealthSvc = Annotated[LinkHealthService, Depends(get_link_health_service)]
AuthSvc = Annotated[AuthService, Depends(get_auth_service)]
OAuthSvc = Annotated[OAuthService, Depends(get_oauth_service)]
EngagementSvc = Annotated[EngagementService, Depends(get_engagement_service)]
CollaborationSvc = Annotated[CollaborationService, Depends(get_collaboration_service)]


class Pagination:
    """Shared skip/limit parsing, so every list endpoint behaves identically."""

    def __init__(
        self,
        skip: Annotated[int, Query(ge=0, description="Rows to skip")] = 0,
        limit: Annotated[int, Query(ge=1, le=200, description="Max rows to return")] = 50,
    ) -> None:
        self.skip = skip
        self.limit = limit


PageParams = Annotated[Pagination, Depends(Pagination)]
