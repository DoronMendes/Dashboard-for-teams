import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import LinkCategory

if TYPE_CHECKING:  # pragma: no cover
    from app.models.project import Project
    from app.models.taxonomy import Bookmark, Tag
    from app.models.user import User


class Link(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "links"
    __table_args__ = (
        # The dashboard's main read pattern: "all links of a project, grouped".
        Index("ix_links_project_id_category", "project_id", "category"),
    )

    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    creator_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    category: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default=LinkCategory.OTHER,
        server_default=LinkCategory.OTHER.value,
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    project: Mapped["Project"] = relationship(back_populates="links")
    creator: Mapped["User"] = relationship(back_populates="created_links", lazy="joined")
    tags: Mapped[list["Tag"]] = relationship(secondary="link_tags", back_populates="links", lazy="selectin")
    bookmarks: Mapped[list["Bookmark"]] = relationship(back_populates="link", cascade="all, delete-orphan", passive_deletes=True, lazy="selectin")

    @property
    def tag_names(self) -> list[str]:
        return [tag.name for tag in self.tags]

    @property
    def is_bookmarked(self) -> bool:
        return bool(self.bookmarks)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Link id={self.id} title={self.title!r} category={self.category}>"
