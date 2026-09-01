"""add user UI preferences

Revision ID: e4f5a6b7c8d9
Revises: e3f4a5b6c7d8
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "e4f5a6b7c8d9"
down_revision: str | None = "e3f4a5b6c7d8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("theme", sa.String(length=16), server_default="light", nullable=False),
    )
    op.add_column(
        "users",
        sa.Column("direction", sa.String(length=8), server_default="rtl", nullable=False),
    )
    op.add_column(
        "users",
        sa.Column("view_mode", sa.String(length=16), server_default="grid", nullable=False),
    )
    op.add_column(
        "users",
        sa.Column(
            "sidebar_collapsed", sa.Boolean(), server_default=sa.false(), nullable=False
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "sidebar_collapsed")
    op.drop_column("users", "view_mode")
    op.drop_column("users", "direction")
    op.drop_column("users", "theme")
