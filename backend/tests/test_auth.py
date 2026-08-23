import asyncio
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.api.deps import get_current_user, get_oauth_service
from app.core.config import settings
from app.core.exceptions import AccountAccessDeniedError
from app.core.security import create_access_token, decode_access_token
from app.main import app
from app.models.link import Link
from app.models.project import Project
from app.models.user import User
from app.models.collaboration import Workspace, WorkspaceMembership
from app.services.auth import AuthService
from app.services.oauth import OAuthProfile
from tests.conftest import make_test_engine


def test_access_token_round_trip() -> None:
    import uuid

    user_id = uuid.uuid4()
    token = create_access_token(user_id=user_id, email="test@example.com")
    assert decode_access_token(token) == user_id


def test_protected_route_rejects_missing_token(client: TestClient) -> None:
    override = app.dependency_overrides.pop(get_current_user)
    try:
        response = client.get("/api/v1/projects")
    finally:
        app.dependency_overrides[get_current_user] = override

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_me_returns_authenticated_user(client: TestClient) -> None:
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 200
    assert response.json()["email"] == "test@example.com"


def test_google_frontend_flow_redirects_with_application_token(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "ALLOWED_EMAILS", ["test@example.com"])

    class FakeOAuthService:
        def authorization_url(self, provider: str, *, state: str, challenge: str) -> str:
            assert provider == "google"
            assert challenge
            return f"https://accounts.google.test/authorize?state={state}"

        async def exchange_code(self, provider: str, *, code: str, verifier: str) -> str:
            assert (provider, code) == ("google", "provider-code")
            assert verifier
            return "provider-token"

        async def fetch_profile(self, provider: str, access_token: str) -> OAuthProfile:
            assert (provider, access_token) == ("google", "provider-token")
            return OAuthProfile(
                provider="google",
                provider_id="google-test-user",
                email="test@example.com",
                name="Test User",
            )

    app.dependency_overrides[get_oauth_service] = FakeOAuthService
    try:
        login = client.get(
            "/api/v1/auth/google/login?frontend=true",
            follow_redirects=False,
        )
        state = parse_qs(urlparse(login.headers["location"]).query)["state"][0]
        callback = client.get(
            f"/api/v1/auth/google/callback?code=provider-code&state={state}",
            follow_redirects=False,
        )
    finally:
        app.dependency_overrides.pop(get_oauth_service, None)

    assert callback.status_code == 302
    redirect = urlparse(callback.headers["location"])
    assert f"{redirect.scheme}://{redirect.netloc}{redirect.path}" == (
        "http://localhost:5173/auth/callback"
    )
    fragment = parse_qs(redirect.fragment)
    assert fragment["token_type"] == ["bearer"]
    assert decode_access_token(fragment["access_token"][0])


@pytest.mark.asyncio
async def test_oauth_rejects_an_email_outside_the_allowlist(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "ALLOWED_EMAILS", ["allowed@example.com"])
    service = AuthService(object())  # type: ignore[arg-type]
    profile = OAuthProfile(
        provider="google",
        provider_id="google-denied-user",
        email="denied@example.com",
        name="Denied User",
    )

    with pytest.raises(AccountAccessDeniedError):
        await service.find_or_create_user(profile)


def test_user_cannot_access_another_users_project_or_link(client: TestClient) -> None:
    async def _seed_other_users_data() -> tuple[str, str]:
        engine = make_test_engine()
        session_factory = async_sessionmaker(
            engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )
        try:
            async with session_factory() as session:
                other_user = User(
                    email="other@example.com",
                    name="Other User",
                    microsoft_id="microsoft-other-user",
                )
                session.add(other_user)
                await session.flush()
                workspace = Workspace(name="Other Workspace")
                session.add(workspace)
                await session.flush()
                session.add(WorkspaceMembership(workspace_id=workspace.id, user_id=other_user.id, role="owner"))
                project = Project(name="Private", owner_id=other_user.id, workspace_id=workspace.id)
                session.add(project)
                await session.flush()
                link = Link(
                    project_id=project.id,
                    creator_id=other_user.id,
                    title="Secret",
                    url="https://private.example.com",
                )
                session.add(link)
                await session.commit()
                return str(project.id), str(link.id)
        finally:
            await engine.dispose()

    project_id, link_id = asyncio.run(_seed_other_users_data())
    assert client.get(f"/api/v1/projects/{project_id}").status_code == 404
    assert client.get(f"/api/v1/links/{link_id}").status_code == 404
