"""Import surface for Alembic.

Alembic needs every model imported before it reads Base.metadata, otherwise
autogenerate will happily write a migration that drops your tables.
Import new models HERE and nowhere else for this purpose.
"""

from app.db.base_class import Base  # noqa: F401
from app.models.link import Link  # noqa: F401
from app.models.engagement import ActivityEvent, LinkVisit, Notification  # noqa: F401
from app.models.collaboration import Team, Workspace, WorkspaceInvitation, WorkspaceMembership  # noqa: F401
from app.models.project import Project  # noqa: F401
from app.models.taxonomy import Bookmark, Tag, link_tags  # noqa: F401
from app.models.user import User  # noqa: F401

__all__ = ["ActivityEvent", "Base", "Bookmark", "Link", "LinkVisit", "Notification", "Project", "Tag", "Team", "User", "Workspace", "WorkspaceInvitation", "WorkspaceMembership", "link_tags"]
