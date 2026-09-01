"""allow uploaded project icons

Revision ID: c8d9e0f1a2b3
Revises: b7c8d9e0f1a2
"""

from alembic import op
import sqlalchemy as sa


revision: str = "c8d9e0f1a2b3"
down_revision: str | None = "b7c8d9e0f1a2"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.alter_column("projects", "icon", existing_type=sa.String(length=32), type_=sa.Text(), existing_nullable=True)


def downgrade() -> None:
    op.alter_column("projects", "icon", existing_type=sa.Text(), type_=sa.String(length=32), existing_nullable=True)
