from uuid import UUID
from sqlalchemy import select
from app.models.taxonomy import Bookmark, Tag
from app.repositories.base import SQLAlchemyRepository

class TagRepository(SQLAlchemyRepository[Tag]):
    model = Tag
    async def resolve(self, owner_id: UUID, names: list[str]) -> list[Tag]:
        if not names:
            return []
        result = await self.session.execute(select(Tag).where(Tag.owner_id == owner_id, Tag.name.in_(names)))
        existing = {tag.name.casefold(): tag for tag in result.scalars().all()}
        resolved: list[Tag] = []
        for name in names:
            tag = existing.get(name.casefold())
            if tag is None:
                tag = Tag(owner_id=owner_id, name=name)
                self.session.add(tag)
                existing[name.casefold()] = tag
            resolved.append(tag)
        await self.session.flush()
        return resolved

class BookmarkRepository(SQLAlchemyRepository[Bookmark]):
    model = Bookmark
    async def get_for_user_link(self, user_id: UUID, link_id: UUID) -> Bookmark | None:
        result = await self.session.execute(select(Bookmark).where(Bookmark.user_id == user_id, Bookmark.link_id == link_id))
        return result.scalar_one_or_none()
