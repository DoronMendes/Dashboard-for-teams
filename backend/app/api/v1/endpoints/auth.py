"""Google and Microsoft OAuth 2.0 entry points and callbacks."""

import secrets

from fastapi import APIRouter, HTTPException, Query, Request, Response, status
from fastapi.responses import RedirectResponse

from app.api.deps import AuthSvc, CurrentUser, OAuthSvc, UserRepo
from app.core.config import settings
from app.core.exceptions import AccountAccessDeniedError
from app.schemas.auth import AvatarUpdate, SessionResponse, UserPreferencesUpdate, UserResponse
from app.services.oauth import create_oauth_challenge

router = APIRouter()


def _session_max_age() -> int:
    return settings.SESSION_TOKEN_EXPIRE_DAYS * 24 * 60 * 60


def _set_session_cookie(response: Response, token: str) -> None:
    response.headers["Cache-Control"] = "no-store, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=token,
        max_age=_session_max_age(),
        httponly=True,
        secure=settings.SESSION_COOKIE_SECURE,
        samesite=settings.SESSION_COOKIE_SAMESITE,
        path=settings.SESSION_COOKIE_PATH,
        domain=settings.SESSION_COOKIE_DOMAIN,
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.SESSION_COOKIE_NAME,
        httponly=True,
        secure=settings.SESSION_COOKIE_SECURE,
        samesite=settings.SESSION_COOKIE_SAMESITE,
        path=settings.SESSION_COOKIE_PATH,
        domain=settings.SESSION_COOKIE_DOMAIN,
    )


def _cookie_name(provider: str, kind: str) -> str:
    return f"oauth_{provider}_{kind}"


def _cookie_path(provider: str) -> str:
    return f"{settings.API_V1_PREFIX}/auth/{provider}"


def _set_oauth_cookie(response: Response, provider: str, kind: str, value: str) -> None:
    response.set_cookie(
        key=_cookie_name(provider, kind),
        value=value,
        max_age=settings.OAUTH_STATE_TTL_SECONDS,
        httponly=True,
        secure=settings.OAUTH_COOKIE_SECURE,
        samesite="lax",
        path=_cookie_path(provider),
    )


def _delete_oauth_cookies(response: Response, provider: str) -> None:
    for kind in ("state", "verifier", "response_mode"):
        response.delete_cookie(
            _cookie_name(provider, kind),
            path=_cookie_path(provider),
            secure=settings.OAUTH_COOKIE_SECURE,
            httponly=True,
            samesite="lax",
        )


def _start_login(provider: str, oauth: OAuthSvc, *, frontend: bool) -> RedirectResponse:
    state_value, verifier, challenge = create_oauth_challenge()
    authorization_url = oauth.authorization_url(
        provider,
        state=state_value,
        challenge=challenge,
    )
    response = RedirectResponse(authorization_url, status_code=status.HTTP_302_FOUND)
    response.headers["Cache-Control"] = "no-store, max-age=0"
    response.headers["Pragma"] = "no-cache"
    _set_oauth_cookie(response, provider, "state", state_value)
    _set_oauth_cookie(response, provider, "verifier", verifier)
    _set_oauth_cookie(
        response,
        provider,
        "response_mode",
        "frontend" if frontend else "json",
    )
    return response


async def _finish_login(
    provider: str,
    *,
    request: Request,
    response: Response,
    oauth: OAuthSvc,
    auth: AuthSvc,
    code: str | None,
    state_value: str | None,
    provider_error: str | None,
) -> SessionResponse | RedirectResponse:
    expected_state = request.cookies.get(_cookie_name(provider, "state"))
    verifier = request.cookies.get(_cookie_name(provider, "verifier"))
    if (
        not expected_state
        or not state_value
        or not secrets.compare_digest(expected_state, state_value)
        or not verifier
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OAuth state",
        )
    if provider_error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"OAuth authorization failed: {provider_error}",
        )
    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OAuth callback did not include an authorization code",
        )

    provider_token = await oauth.exchange_code(provider, code=code, verifier=verifier)
    profile = await oauth.fetch_profile(provider, provider_token)
    try:
        user = await auth.find_or_create_user(profile)
    except AccountAccessDeniedError:
        if request.cookies.get(_cookie_name(provider, "response_mode")) == "frontend":
            redirect = RedirectResponse(
                f"{settings.FRONTEND_AUTH_CALLBACK_URL}?error=access_denied",
                status_code=status.HTTP_302_FOUND,
            )
            _delete_oauth_cookies(redirect, provider)
            return redirect
        raise
    # The provider token is used only to fetch identity during this callback.
    access_token = auth.create_session_token(user)
    session_response = SessionResponse(
        expires_in=_session_max_age(),
        user=UserResponse.model_validate(user),
    )
    if request.cookies.get(_cookie_name(provider, "response_mode")) == "frontend":
        redirect = RedirectResponse(
            settings.FRONTEND_AUTH_CALLBACK_URL,
            status_code=status.HTTP_302_FOUND,
        )
        _set_session_cookie(redirect, access_token)
        _delete_oauth_cookies(redirect, provider)
        return redirect

    _set_session_cookie(response, access_token)
    _delete_oauth_cookies(response, provider)
    return session_response


@router.get("/google/login", summary="Start Google login")
async def google_login(
    oauth: OAuthSvc,
    frontend: bool = Query(default=False),
    nonce: str | None = Query(default=None, max_length=128),
) -> RedirectResponse:
    del nonce  # cache-busting only; it is deliberately not part of OAuth state
    return _start_login("google", oauth, frontend=frontend)


@router.get("/google/callback", response_model=SessionResponse, summary="Complete Google login")
async def google_callback(
    request: Request,
    response: Response,
    oauth: OAuthSvc,
    auth: AuthSvc,
    code: str | None = Query(default=None),
    state_value: str | None = Query(default=None, alias="state"),
    error: str | None = Query(default=None),
) -> SessionResponse | RedirectResponse:
    return await _finish_login(
        "google",
        request=request,
        response=response,
        oauth=oauth,
        auth=auth,
        code=code,
        state_value=state_value,
        provider_error=error,
    )


@router.get("/microsoft/login", summary="Start Microsoft login")
async def microsoft_login(
    oauth: OAuthSvc,
    frontend: bool = Query(default=False),
) -> RedirectResponse:
    return _start_login("microsoft", oauth, frontend=frontend)


@router.get(
    "/microsoft/callback",
    response_model=SessionResponse,
    summary="Complete Microsoft login",
)
async def microsoft_callback(
    request: Request,
    response: Response,
    oauth: OAuthSvc,
    auth: AuthSvc,
    code: str | None = Query(default=None),
    state_value: str | None = Query(default=None, alias="state"),
    error: str | None = Query(default=None),
) -> SessionResponse | RedirectResponse:
    return await _finish_login(
        "microsoft",
        request=request,
        response=response,
        oauth=oauth,
        auth=auth,
        code=code,
        state_value=state_value,
        provider_error=error,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, summary="Log out")
async def logout(response: Response, current_user: CurrentUser, auth: AuthSvc) -> Response:
    await auth.revoke_sessions(current_user)
    _clear_session_cookie(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("/me", response_model=UserResponse, summary="Get the authenticated user")
async def get_me(current_user: CurrentUser) -> UserResponse:
    return UserResponse.model_validate(current_user)


@router.put("/me/avatar", response_model=UserResponse, summary="Update profile avatar")
async def update_avatar(
    payload: AvatarUpdate, current_user: CurrentUser, users: UserRepo
) -> UserResponse:
    updated = await users.update(current_user, {"avatar": payload.avatar})
    return UserResponse.model_validate(updated)


@router.put(
    "/me/preferences",
    response_model=UserResponse,
    summary="Update personal UI preferences",
)
async def update_preferences(
    payload: UserPreferencesUpdate,
    current_user: CurrentUser,
    users: UserRepo,
) -> UserResponse:
    updated = await users.update(current_user, payload.model_dump(exclude_none=True))
    return UserResponse.model_validate(updated)
