"""Application-level access policy helpers."""

from app.core.config import settings


def is_email_allowed(email: str) -> bool:
    return email.strip().casefold() in settings.ALLOWED_EMAILS
