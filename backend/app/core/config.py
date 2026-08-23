"""Application settings.

Single source of truth for configuration. Everything is read from the
environment (or the root .env file), never hardcoded in the modules that use it,
so swapping environments never requires touching application code.
"""

from functools import lru_cache
from typing import Annotated, Any, Literal

from pydantic import computed_field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # Looked up relative to the CWD. "../.env" covers `uvicorn` started from
        # backend/, ".env" covers running from the repo root or a container.
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # --- Application ---
    PROJECT_NAME: str = "Project Dashboard API"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: Literal["local", "staging", "production"] = "local"
    DEBUG: bool = True

    # --- Postgres ---
    POSTGRES_USER: str = "dashboard"
    POSTGRES_PASSWORD: str = "dashboard"
    POSTGRES_DB: str = "dashboard"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432

    # Connection pool
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_ECHO: bool = False

    # --- Application JWT ---
    JWT_SECRET_KEY: str = "replace-with-a-long-random-secret"
    JWT_ALGORITHM: Literal["HS256", "HS384", "HS512"] = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # --- OAuth 2.0 / OpenID Connect ---
    OAUTH_COOKIE_SECURE: bool = False
    OAUTH_STATE_TTL_SECONDS: int = 600
    FRONTEND_AUTH_CALLBACK_URL: str = "http://localhost:5173/auth/callback"
    ALLOWED_EMAILS: Annotated[list[str], NoDecode] = []

    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = (
        "http://127.0.0.1:8010/api/v1/auth/google/callback"
    )

    MICROSOFT_CLIENT_ID: str = ""
    MICROSOFT_CLIENT_SECRET: str = ""
    MICROSOFT_TENANT: str = "common"
    MICROSOFT_REDIRECT_URI: str = (
        "http://127.0.0.1:8010/api/v1/auth/microsoft/callback"
    )

    # --- CORS ---
    # NoDecode stops pydantic-settings from JSON-parsing the raw env value, so
    # the validator below can accept a plain comma-separated string.
    BACKEND_CORS_ORIGINS: Annotated[list[str], NoDecode] = [
        "http://localhost:3000",
        "http://localhost:5173",
    ]

    @field_validator("BACKEND_CORS_ORIGINS", "ALLOWED_EMAILS", mode="before")
    @classmethod
    def _split_comma_separated_values(cls, value: Any) -> Any:
        """Accept a comma-separated string, a JSON array, or a real list."""
        if isinstance(value, str):
            stripped = value.strip()
            if stripped.startswith("["):
                import json

                return json.loads(stripped)
            return [origin.strip() for origin in stripped.split(",") if origin.strip()]
        return value

    @field_validator("ALLOWED_EMAILS", mode="after")
    @classmethod
    def _normalize_allowed_emails(cls, value: list[str]) -> list[str]:
        return sorted({email.strip().casefold() for email in value if email.strip()})

    @computed_field  # type: ignore[prop-decorator]
    @property
    def DATABASE_URL(self) -> str:
        """Async DSN used by the application at runtime."""
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def DATABASE_URL_SYNC(self) -> str:
        """Sync DSN. Handy for psql-style tooling and one-off scripts."""
        return (
            f"postgresql+psycopg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )


@lru_cache
def get_settings() -> Settings:
    """Cached accessor so the .env file is parsed exactly once per process."""
    return Settings()


settings = get_settings()
