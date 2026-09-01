"""add project icons

Revision ID: b7c8d9e0f1a2
Revises: a1b2c3d4e5f6
"""

from alembic import op
import sqlalchemy as sa


revision: str = "b7c8d9e0f1a2"
down_revision: str | None = "a1b2c3d4e5f6"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("icon", sa.String(length=32), nullable=True))


def downgrade() -> None:
    op.drop_column("projects", "icon")
