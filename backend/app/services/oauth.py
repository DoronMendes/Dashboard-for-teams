"""Provider-specific OAuth 2.0 authorization-code exchanges."""

import base64
import hashlib
import secrets
from dataclasses import dataclass
from urllib.parse import urlencode

import httpx

from app.core.config import settings
from app.core.exceptions import OAuthConfigurationError, OAuthProviderError

GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"

MICROSOFT_GRAPH_ME_URL = "https://graph.microsoft.com/v1.0/me"


@dataclass(frozen=True, slots=True)
class OAuthProfile:
    provider: str
    provider_id: str
    email: str
    name: str


def create_oauth_challenge() -> tuple[str, str, str]:
    """Return state, PKCE verifier, and S256 challenge."""
    state = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(64)
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return state, verifier, challenge


class OAuthService:
    _timeout = httpx.Timeout(10.0)

    @staticmethod
    def _require_configuration(provider: str) -> None:
        if provider == "google":
            configured = settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET
        elif provider == "microsoft":
            configured = settings.MICROSOFT_CLIENT_ID and settings.MICROSOFT_CLIENT_SECRET
        else:
            configured = False
        if not configured:
            raise OAuthConfigurationError(f"{provider.title()} OAuth is not configured")

    def authorization_url(self, provider: str, *, state: str, challenge: str) -> str:
        self._require_configuration(provider)
        if provider == "google":
            base_url = GOOGLE_AUTHORIZE_URL
            params = {
                "client_id": settings.GOOGLE_CLIENT_ID,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "response_type": "code",
                "scope": "openid email profile",
                "state": state,
                "code_challenge": challenge,
                "code_challenge_method": "S256",
                "access_type": "online",
            }
        elif provider == "microsoft":
            base_url = (
                f"https://login.microsoftonline.com/{settings.MICROSOFT_TENANT}"
                "/oauth2/v2.0/authorize"
            )
            params = {
                "client_id": settings.MICROSOFT_CLIENT_ID,
                "redirect_uri": settings.MICROSOFT_REDIRECT_URI,
                "response_type": "code",
                "response_mode": "query",
                "scope": "openid profile email User.Read",
                "state": state,
                "code_challenge": challenge,
                "code_challenge_method": "S256",
            }
        else:
            raise ValueError(f"Unsupported OAuth provider: {provider}")
        return f"{base_url}?{urlencode(params)}"

    async def exchange_code(self, provider: str, *, code: str, verifier: str) -> str:
        self._require_configuration(provider)
        if provider == "google":
            token_url = GOOGLE_TOKEN_URL
            data = {
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "code": code,
                "code_verifier": verifier,
                "grant_type": "authorization_code",
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            }
        elif provider == "microsoft":
            token_url = (
                f"https://login.microsoftonline.com/{settings.MICROSOFT_TENANT}"
                "/oauth2/v2.0/token"
            )
            data = {
                "client_id": settings.MICROSOFT_CLIENT_ID,
                "client_secret": settings.MICROSOFT_CLIENT_SECRET,
                "code": code,
                "code_verifier": verifier,
                "grant_type": "authorization_code",
                "redirect_uri": settings.MICROSOFT_REDIRECT_URI,
                "scope": "openid profile email User.Read",
            }
        else:
            raise ValueError(f"Unsupported OAuth provider: {provider}")

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.post(token_url, data=data)
                response.raise_for_status()
                access_token = response.json().get("access_token")
        except httpx.HTTPStatusError as exc:
            # OAuth providers return a small, standardized JSON error body. Keep
            # tokens and request data private, but expose the provider's error
            # code/description so configuration problems can actually be fixed.
            try:
                error_body = exc.response.json()
            except ValueError:
                error_body = {}
            error_code = str(error_body.get("error", "provider_error"))
            error_description = str(error_body.get("error_description", "")).strip()
            detail = f"{provider.title()} token exchange failed: {error_code}"
            if error_description:
                detail = f"{detail} — {error_description}"
            raise OAuthProviderError(detail) from exc
        except (httpx.HTTPError, ValueError) as exc:
            raise OAuthProviderError(
                f"{provider.title()} token exchange failed: {type(exc).__name__}"
            ) from exc
        if not access_token:
            raise OAuthProviderError(f"{provider.title()} returned no access token")
        return str(access_token)

    async def fetch_profile(self, provider: str, access_token: str) -> OAuthProfile:
        headers = {"Authorization": f"Bearer {access_token}"}
        url = GOOGLE_USERINFO_URL if provider == "google" else MICROSOFT_GRAPH_ME_URL
        params = (
            None
            if provider == "google"
            else {"$select": "id,displayName,mail,userPrincipalName"}
        )
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.get(url, headers=headers, params=params)
                response.raise_for_status()
                data = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise OAuthProviderError(f"{provider.title()} profile request failed") from exc

        if provider == "google":
            if data.get("email_verified") is not True:
                raise OAuthProviderError("Google did not return a verified email address")
            provider_id = data.get("sub")
            email = data.get("email")
            name = data.get("name")
        elif provider == "microsoft":
            provider_id = data.get("id")
            email = data.get("mail") or data.get("userPrincipalName")
            name = data.get("displayName")
        else:
            raise ValueError(f"Unsupported OAuth provider: {provider}")

        if not provider_id or not email:
            raise OAuthProviderError(f"{provider.title()} profile is missing an id or email")
        return OAuthProfile(
            provider=provider,
            provider_id=str(provider_id),
            email=str(email).strip().lower(),
            name=str(name or email).strip(),
        )
