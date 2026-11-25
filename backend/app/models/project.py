import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint, false
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:  # pragma: no cover
    from app.models.link import Link
    from app.models.user import User


class Project(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "projects"
    __table_args__ = (
        UniqueConstraint(
            "owner_id",
            "name",
            name="uq_projects_owner_id_name",
        ),
    )

    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    team_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("teams.id", ondelete="SET NULL"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    icon: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_pinned: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=false(),
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    owner: Mapped["User"] = relationship(back_populates="projects")

    links: Mapped[list["Link"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,  # let Postgres ON DELETE CASCADE do the work
        lazy="selectin",
        order_by="Link.position",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Project id={self.id} owner_id={self.owner_id} name={self.name!r}>"
