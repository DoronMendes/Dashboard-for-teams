"""JWT creation and validation for application access tokens."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt

from app.core.config import settings


class InvalidAccessTokenError(ValueError):
    """Raised when an application JWT is invalid or expired."""


@dataclass(frozen=True, slots=True)
class SessionClaims:
    user_id: UUID
    email: str
    token_version: int


def create_access_token(*, user_id: UUID, email: str, token_version: int) -> str:
    """Mint an application session JWT independent of the OAuth provider token."""
    now = datetime.now(UTC)
    expires_at = now + timedelta(days=settings.SESSION_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": str(user_id),
        "email": email,
        "token_version": token_version,
        "type": "access",
        "iat": now,
        "exp": expires_at,
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> SessionClaims:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            options={"require": ["sub", "email", "token_version", "exp", "iat", "type"]},
        )
        if payload.get("type") != "access":
            raise InvalidAccessTokenError("Unexpected token type")
        token_version = payload["token_version"]
        if not isinstance(token_version, int) or isinstance(token_version, bool):
            raise InvalidAccessTokenError("Invalid token version")
        return SessionClaims(
            user_id=UUID(payload["sub"]),
            email=str(payload["email"]),
            token_version=token_version,
        )
    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError) as exc:
        raise InvalidAccessTokenError("Invalid or expired access token") from exc
