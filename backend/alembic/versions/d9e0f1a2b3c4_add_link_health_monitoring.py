"""add link health monitoring

Revision ID: d9e0f1a2b3c4
Revises: c8d9e0f1a2b3
"""

from alembic import op
import sqlalchemy as sa


revision: str = "d9e0f1a2b3c4"
down_revision: str | None = "c8d9e0f1a2b3"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column("links", sa.Column("status_code", sa.Integer(), nullable=True))
    op.add_column(
        "links",
        sa.Column("health_status", sa.String(length=20), server_default="checking", nullable=False),
    )
    op.add_column("links", sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("links", sa.Column("response_time_ms", sa.Integer(), nullable=True))
    op.create_index("ix_links_health_status", "links", ["health_status"])


def downgrade() -> None:
    op.drop_index("ix_links_health_status", table_name="links")
    op.drop_column("links", "response_time_ms")
    op.drop_column("links", "last_checked_at")
    op.drop_column("links", "health_status")
    op.drop_column("links", "status_code")
