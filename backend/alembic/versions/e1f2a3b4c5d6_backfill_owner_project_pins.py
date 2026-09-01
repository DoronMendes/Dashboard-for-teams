"""backfill old global pins for project owners

Revision ID: e1f2a3b4c5d6
Revises: e0f1a2b3c4d5
"""

from alembic import op

revision = "e1f2a3b4c5d6"
down_revision = "e0f1a2b3c4d5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO project_pins (id, user_id, project_id, created_at, updated_at)
        SELECT gen_random_uuid(), owner_id, id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        FROM projects
        WHERE is_pinned = TRUE
        ON CONFLICT (user_id, project_id) DO NOTHING
        """
    )


def downgrade() -> None:
    pass
