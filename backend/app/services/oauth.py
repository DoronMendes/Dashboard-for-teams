"""Provider-specific OAuth 2.0 authorization-code exchanges."""

import base64
import hashlib
import secrets
from dataclasses import dataclass
from urllib.parse import urlencode

import httpx
import jwt

from app.core.config import settings
from app.core.exceptions import OAuthConfigurationError, OAuthProviderError

GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}

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
                "access_type": "online",
                "prompt": "select_account",
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
                token_data = response.json()
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
        token_field = "id_token" if provider == "google" else "access_token"
        provider_token = token_data.get(token_field)
        if not provider_token:
            raise OAuthProviderError(f"{provider.title()} returned no {token_field}")
        return str(provider_token)

    async def fetch_profile(self, provider: str, access_token: str) -> OAuthProfile:
        if provider == "google":
            return await self._verify_google_id_token(access_token)

        headers = {"Authorization": f"Bearer {access_token}"}
        url = MICROSOFT_GRAPH_ME_URL
        params = {"$select": "id,displayName,mail,userPrincipalName"}
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.get(url, headers=headers, params=params)
                response.raise_for_status()
                data = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise OAuthProviderError(f"{provider.title()} profile request failed") from exc

        if provider == "microsoft":
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

    async def _verify_google_id_token(self, id_token: str) -> OAuthProfile:
        """Verify Google's signature and all identity-defining OIDC claims."""
        try:
            header = jwt.get_unverified_header(id_token)
            if header.get("alg") != "RS256" or not header.get("kid"):
                raise OAuthProviderError("Google ID token uses an unexpected signing key")
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.get(GOOGLE_JWKS_URL)
                response.raise_for_status()
                keys = response.json().get("keys", [])
            jwk_data = next((key for key in keys if key.get("kid") == header["kid"]), None)
            if jwk_data is None:
                raise OAuthProviderError("Google ID token signing key was not found")
            signing_key = jwt.PyJWK.from_dict(jwk_data, algorithm="RS256").key
            claims = jwt.decode(
                id_token,
                signing_key,
                algorithms=["RS256"],
                audience=settings.GOOGLE_CLIENT_ID,
                issuer=list(GOOGLE_ISSUERS),
                options={"require": ["aud", "iss", "exp", "sub", "email"]},
            )
        except OAuthProviderError:
            raise
        except (httpx.HTTPError, jwt.PyJWTError, KeyError, TypeError, ValueError) as exc:
            raise OAuthProviderError("Google ID token validation failed") from exc

        if claims.get("email_verified") is not True:
            raise OAuthProviderError("Google did not return a verified email address")
        email = str(claims["email"]).strip().lower()
        return OAuthProfile(
            provider="google",
            provider_id=str(claims["sub"]),
            email=email,
            name=str(claims.get("name") or email).strip(),
        )
