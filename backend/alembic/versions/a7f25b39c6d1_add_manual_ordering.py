"""add manual ordering

Revision ID: a7f25b39c6d1
Revises: c91d2e7a4b10
Create Date: 2026-08-16
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "a7f25b39c6d1"
down_revision: str | None = "c91d2e7a4b10"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("position", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "links",
        sa.Column("position", sa.Integer(), server_default="0", nullable=False),
    )

    op.execute(
        """
        WITH ranked AS (
            SELECT id, ROW_NUMBER() OVER (
                PARTITION BY owner_id ORDER BY created_at ASC, id ASC
            ) - 1 AS position
            FROM projects
        )
        UPDATE projects
        SET position = ranked.position
        FROM ranked
        WHERE projects.id = ranked.id
        """
    )
    op.execute(
        """
        WITH ranked AS (
            SELECT id, ROW_NUMBER() OVER (
                PARTITION BY project_id ORDER BY created_at ASC, id ASC
            ) - 1 AS position
            FROM links
        )
        UPDATE links
        SET position = ranked.position
        FROM ranked
        WHERE links.id = ranked.id
        """
    )


def downgrade() -> None:
    op.drop_column("links", "position")
    op.drop_column("projects", "position")
