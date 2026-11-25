"""add engagement tracking

Revision ID: e5f6a7b8c9d0
Revises: d4e8f1a2b3c4
"""
from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa
revision: str = "e5f6a7b8c9d0"
down_revision: str | None = "d4e8f1a2b3c4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

def upgrade() -> None:
    op.create_table("link_visits", sa.Column("link_id", sa.Uuid(), nullable=False), sa.Column("user_id", sa.Uuid(), nullable=False), sa.Column("id", sa.Uuid(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.ForeignKeyConstraint(["link_id"], ["links.id"], ondelete="CASCADE"), sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"), sa.PrimaryKeyConstraint("id"))
    op.create_index("ix_link_visits_link_id", "link_visits", ["link_id"]); op.create_index("ix_link_visits_user_id", "link_visits", ["user_id"]); op.create_index("ix_link_visits_id", "link_visits", ["id"])
    op.create_table("activity_events", sa.Column("user_id", sa.Uuid(), nullable=False), sa.Column("action", sa.String(64), nullable=False), sa.Column("entity_type", sa.String(32), nullable=False), sa.Column("entity_id", sa.Uuid(), nullable=True), sa.Column("project_id", sa.Uuid(), nullable=True), sa.Column("details", sa.JSON(), nullable=False), sa.Column("id", sa.Uuid(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"), sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"), sa.PrimaryKeyConstraint("id"))
    op.create_index("ix_activity_events_user_id", "activity_events", ["user_id"]); op.create_index("ix_activity_events_project_id", "activity_events", ["project_id"]); op.create_index("ix_activity_events_id", "activity_events", ["id"])
    op.create_table("notifications", sa.Column("user_id", sa.Uuid(), nullable=False), sa.Column("kind", sa.String(64), nullable=False), sa.Column("message", sa.Text(), nullable=False), sa.Column("target_path", sa.String(512), nullable=True), sa.Column("is_read", sa.Boolean(), server_default=sa.false(), nullable=False), sa.Column("id", sa.Uuid(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"), sa.PrimaryKeyConstraint("id"))
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"]); op.create_index("ix_notifications_id", "notifications", ["id"])

def downgrade() -> None:
    op.drop_table("notifications"); op.drop_table("activity_events"); op.drop_table("link_visits")
