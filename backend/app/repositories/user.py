from uuid import UUID

from sqlalchemy import func, select, update

from app.models.user import User
from app.repositories.base import SQLAlchemyRepository


class UserRepository(SQLAlchemyRepository[User]):
    model = User

    async def get_by_email(self, email: str) -> User | None:
        result = await self.session.execute(
            select(User).where(func.lower(User.email) == email.strip().lower())
        )
        return result.scalar_one_or_none()

    async def get_by_provider_id(self, provider: str, provider_id: str) -> User | None:
        field = {
            "google": User.google_id,
            "microsoft": User.microsoft_id,
        }.get(provider)
        if field is None:
            raise ValueError(f"Unsupported OAuth provider: {provider}")
        result = await self.session.execute(select(User).where(field == provider_id))
        return result.scalar_one_or_none()

    async def get_user(self, user_id: UUID) -> User | None:
        return await self.get(user_id)

    async def increment_token_version(self, user: User) -> User:
        await self.session.execute(
            update(User).where(User.id == user.id).values(token_version=User.token_version + 1)
        )
        await self.session.flush()
        await self.session.refresh(user)
        return user
