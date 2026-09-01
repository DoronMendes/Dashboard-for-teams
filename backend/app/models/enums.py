"""Domain enums.

LinkCategory is deliberately persisted as a VARCHAR rather than a native
PostgreSQL ENUM: adding a category then costs a one-line code change instead of
an ALTER TYPE migration. Validation happens at the Pydantic boundary.
"""

from enum import StrEnum


class LinkCategory(StrEnum):
    ENVIRONMENT = "environment"
    DOCS = "docs"
    CODE = "code"
    LOGS = "logs"
    MONITORING = "monitoring"
    OTHER = "other"


class LinkHealthStatus(StrEnum):
    HEALTHY = "healthy"
    WARNING = "warning"
    ERROR = "error"
    CHECKING = "checking"
