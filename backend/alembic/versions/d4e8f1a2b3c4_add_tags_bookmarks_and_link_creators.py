"""add tags, bookmarks and link creators

Revision ID: d4e8f1a2b3c4
Revises: a7f25b39c6d1
"""
from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa

revision: str = "d4e8f1a2b3c4"
down_revision: str | None = "a7f25b39c6d1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

def upgrade() -> None:
    op.add_column("links", sa.Column("creator_id", sa.Uuid(), nullable=True))
    op.execute("UPDATE links SET creator_id = (SELECT owner_id FROM projects WHERE projects.id = links.project_id)")
    op.alter_column("links", "creator_id", nullable=False)
    op.create_index("ix_links_creator_id", "links", ["creator_id"])
    op.create_foreign_key("fk_links_creator_id_users", "links", "users", ["creator_id"], ["id"], ondelete="CASCADE")
    op.create_table("tags", sa.Column("owner_id", sa.Uuid(), nullable=False), sa.Column("name", sa.String(64), nullable=False), sa.Column("id", sa.Uuid(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"), sa.PrimaryKeyConstraint("id"), sa.UniqueConstraint("owner_id", "name", name="uq_tags_owner_id_name"))
    op.create_index("ix_tags_owner_id", "tags", ["owner_id"])
    op.create_index("ix_tags_id", "tags", ["id"])
    op.create_table("link_tags", sa.Column("link_id", sa.Uuid(), nullable=False), sa.Column("tag_id", sa.Uuid(), nullable=False), sa.ForeignKeyConstraint(["link_id"], ["links.id"], ondelete="CASCADE"), sa.ForeignKeyConstraint(["tag_id"], ["tags.id"], ondelete="CASCADE"), sa.PrimaryKeyConstraint("link_id", "tag_id"))
    op.create_table("bookmarks", sa.Column("user_id", sa.Uuid(), nullable=False), sa.Column("link_id", sa.Uuid(), nullable=False), sa.Column("id", sa.Uuid(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.ForeignKeyConstraint(["link_id"], ["links.id"], ondelete="CASCADE"), sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"), sa.PrimaryKeyConstraint("id"), sa.UniqueConstraint("user_id", "link_id", name="uq_bookmarks_user_id_link_id"))
    op.create_index("ix_bookmarks_user_id", "bookmarks", ["user_id"])
    op.create_index("ix_bookmarks_link_id", "bookmarks", ["link_id"])
    op.create_index("ix_bookmarks_id", "bookmarks", ["id"])

def downgrade() -> None:
    op.drop_table("bookmarks")
    op.drop_table("link_tags")
    op.drop_table("tags")
    op.drop_constraint("fk_links_creator_id_users", "links", type_="foreignkey")
    op.drop_index("ix_links_creator_id", table_name="links")
    op.drop_column("links", "creator_id")
