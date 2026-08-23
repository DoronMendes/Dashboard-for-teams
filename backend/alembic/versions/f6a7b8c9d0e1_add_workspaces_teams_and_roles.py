"""add workspaces teams and roles

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
"""
from collections.abc import Sequence
import uuid
from alembic import op
import sqlalchemy as sa
revision: str = "f6a7b8c9d0e1"
down_revision: str | None = "e5f6a7b8c9d0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

def upgrade() -> None:
    op.create_table("workspaces", sa.Column("name", sa.String(255), nullable=False), sa.Column("id", sa.Uuid(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.PrimaryKeyConstraint("id")); op.create_index("ix_workspaces_id", "workspaces", ["id"])
    op.create_table("workspace_memberships", sa.Column("workspace_id", sa.Uuid(), nullable=False), sa.Column("user_id", sa.Uuid(), nullable=False), sa.Column("role", sa.String(16), nullable=False), sa.Column("id", sa.Uuid(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"), sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"), sa.PrimaryKeyConstraint("id"), sa.UniqueConstraint("workspace_id", "user_id", name="uq_workspace_memberships_workspace_id_user_id")); op.create_index("ix_workspace_memberships_workspace_id", "workspace_memberships", ["workspace_id"]); op.create_index("ix_workspace_memberships_user_id", "workspace_memberships", ["user_id"]); op.create_index("ix_workspace_memberships_id", "workspace_memberships", ["id"])
    op.create_table("teams", sa.Column("workspace_id", sa.Uuid(), nullable=False), sa.Column("name", sa.String(255), nullable=False), sa.Column("id", sa.Uuid(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"), sa.PrimaryKeyConstraint("id"), sa.UniqueConstraint("workspace_id", "name", name="uq_teams_workspace_id_name")); op.create_index("ix_teams_workspace_id", "teams", ["workspace_id"]); op.create_index("ix_teams_id", "teams", ["id"])
    op.add_column("projects", sa.Column("workspace_id", sa.Uuid(), nullable=True)); op.add_column("projects", sa.Column("team_id", sa.Uuid(), nullable=True))
    bind = op.get_bind()
    for user_id, name in bind.execute(sa.text("SELECT id, name FROM users")):
        workspace_id, membership_id = uuid.uuid4(), uuid.uuid4()
        bind.execute(sa.text("INSERT INTO workspaces (id, name) VALUES (:id, :name)"), {"id": workspace_id, "name": f"{name} Workspace"})
        bind.execute(sa.text("INSERT INTO workspace_memberships (id, workspace_id, user_id, role) VALUES (:id, :workspace_id, :user_id, 'owner')"), {"id": membership_id, "workspace_id": workspace_id, "user_id": user_id})
        bind.execute(sa.text("UPDATE projects SET workspace_id = :workspace_id WHERE owner_id = :user_id"), {"workspace_id": workspace_id, "user_id": user_id})
    op.alter_column("projects", "workspace_id", nullable=False); op.create_index("ix_projects_workspace_id", "projects", ["workspace_id"]); op.create_index("ix_projects_team_id", "projects", ["team_id"]); op.create_foreign_key("fk_projects_workspace_id_workspaces", "projects", "workspaces", ["workspace_id"], ["id"], ondelete="CASCADE"); op.create_foreign_key("fk_projects_team_id_teams", "projects", "teams", ["team_id"], ["id"], ondelete="SET NULL")

def downgrade() -> None:
    op.drop_constraint("fk_projects_team_id_teams", "projects", type_="foreignkey"); op.drop_constraint("fk_projects_workspace_id_workspaces", "projects", type_="foreignkey"); op.drop_column("projects", "team_id"); op.drop_column("projects", "workspace_id"); op.drop_table("teams"); op.drop_table("workspace_memberships"); op.drop_table("workspaces")
