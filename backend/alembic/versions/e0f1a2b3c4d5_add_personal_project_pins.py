"""add personal project pins

Revision ID: e0f1a2b3c4d5
Revises: d9e0f1a2b3c4
"""

from alembic import op
import sqlalchemy as sa

revision = "e0f1a2b3c4d5"
down_revision = "d9e0f1a2b3c4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "project_pins",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "project_id", name="uq_project_pins_user_id_project_id"),
    )
    op.create_index(op.f("ix_project_pins_user_id"), "project_pins", ["user_id"], unique=False)
    op.create_index(op.f("ix_project_pins_project_id"), "project_pins", ["project_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_project_pins_project_id"), table_name="project_pins")
    op.drop_index(op.f("ix_project_pins_user_id"), table_name="project_pins")
    op.drop_table("project_pins")
