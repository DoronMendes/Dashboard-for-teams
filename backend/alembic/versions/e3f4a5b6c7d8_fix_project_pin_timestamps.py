"""fix project pin timestamp defaults

Revision ID: e3f4a5b6c7d8
Revises: e2f3a4b5c6d7
"""

from alembic import op
import sqlalchemy as sa

revision = "e3f4a5b6c7d8"
down_revision = "e2f3a4b5c6d7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("project_pins", "created_at", server_default=sa.text("CURRENT_TIMESTAMP"))
    op.alter_column("project_pins", "updated_at", server_default=sa.text("CURRENT_TIMESTAMP"))


def downgrade() -> None:
    op.alter_column("project_pins", "updated_at", server_default=None)
    op.alter_column("project_pins", "created_at", server_default=None)
