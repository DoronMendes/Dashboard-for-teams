"""Domain exceptions + their HTTP translation.

Business code raises domain errors and stays HTTP-agnostic; the handlers
registered in main.py map them to responses. New error types are added by
subclassing -- existing handlers keep working.
"""

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse


class AppError(Exception):
    """Base class for expected, domain-level failures."""

    status_code: int = status.HTTP_400_BAD_REQUEST
    message: str = "Application error"

    def __init__(self, message: str | None = None) -> None:
        self.message = message or self.message
        super().__init__(self.message)


class EntityNotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    message = "Resource not found"


class DuplicateEntityError(AppError):
    status_code = status.HTTP_409_CONFLICT
    message = "Resource already exists"


class OAuthConfigurationError(AppError):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    message = "OAuth provider is not configured"


class OAuthProviderError(AppError):
    status_code = status.HTTP_502_BAD_GATEWAY
    message = "OAuth provider request failed"


class AccountLinkError(AppError):
    status_code = status.HTTP_409_CONFLICT
    message = "This email is already linked to another provider account"


class AccountAccessDeniedError(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    message = "This account is not authorized to use the application"


async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message, "type": type(exc).__name__},
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, app_error_handler)  # type: ignore[arg-type]
