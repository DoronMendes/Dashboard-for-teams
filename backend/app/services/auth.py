"""OAuth account lookup, creation, and safe provider linking."""

from datetime import UTC, datetime

from app.core.access import is_email_allowed
from app.core.exceptions import (
    AccountAccessDeniedError,
    AccountLinkError,
)
from app.core.security import create_access_token
from app.models.user import User
from app.repositories.collaboration import CollaborationRepository
from app.repositories.user import UserRepository
from app.services.oauth import OAuthProfile


class AuthService:
    def __init__(
        self, users: UserRepository, collaboration: CollaborationRepository | None = None
    ) -> None:
        self.users = users
        self.collaboration = collaboration

    async def find_or_create_user(self, profile: OAuthProfile) -> User:
        invitations = (
            await self.collaboration.invitations_for_email(profile.email)
            if self.collaboration
            else []
        )
        if not is_email_allowed(profile.email) and not invitations and self.collaboration is None:
            raise AccountAccessDeniedError()
        provider_user = await self.users.get_by_provider_id(profile.provider, profile.provider_id)
        email_user = await self.users.get_by_email(profile.email)
        known_user = provider_user or email_user
        existing_memberships = (
            await self.collaboration.memberships(known_user.id)
            if self.collaboration and known_user is not None
            else []
        )
        if not is_email_allowed(profile.email) and not invitations and not existing_memberships:
            raise AccountAccessDeniedError()

        provider_field = f"{profile.provider}_id"
        user = provider_user

        if user is not None:
            changes: dict[str, str] = {"name": profile.name}
            if user.email.lower() != profile.email:
                email_owner = await self.users.get_by_email(profile.email)
                if email_owner is not None and email_owner.id != user.id:
                    raise AccountLinkError()
                changes["email"] = profile.email
            user = await self.users.update(user, changes)
            return await self._accept_invitations(user, invitations)

        user = email_user
        if user is not None:
            linked_id = getattr(user, provider_field)
            if linked_id is not None and linked_id != profile.provider_id:
                raise AccountLinkError()
            user = await self.users.update(
                user,
                {provider_field: profile.provider_id, "name": profile.name},
            )
            return await self._accept_invitations(user, invitations)

        user = await self.users.create(
            {
                "email": profile.email,
                "name": profile.name,
                provider_field: profile.provider_id,
            }
        )
        return await self._accept_invitations(user, invitations)

    @staticmethod
    def create_session_token(user: User) -> str:
        """Create the local session after provider identity has been verified."""
        return create_access_token(
            user_id=user.id,
            email=user.email,
            token_version=user.token_version,
        )

    async def revoke_sessions(self, user: User) -> None:
        """Immediately invalidate every application JWT issued for this user."""
        await self.users.increment_token_version(user)

    async def _accept_invitations(self, user: User, invitations: list) -> User:
        if not self.collaboration:
            return user
        for invitation in invitations:
            await self.collaboration.add_member(invitation.workspace_id, user.id, invitation.role)
            invitation.accepted_at = datetime.now(UTC)
        await self.collaboration.session.flush()
        return user
