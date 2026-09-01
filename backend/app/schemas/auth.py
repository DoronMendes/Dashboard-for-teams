import base64
import binascii
import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator

from app.schemas.common import IdentifiedModel


class UserResponse(IdentifiedModel):
    model_config = ConfigDict(from_attributes=True)

    email: str
    name: str
    avatar: str | None = None
    theme: Literal["light", "dark"]
    direction: Literal["rtl", "ltr"]
    view_mode: Literal["grid", "list"]
    sidebar_collapsed: bool


class UserPreferencesUpdate(BaseModel):
    theme: Literal["light", "dark"] | None = None
    direction: Literal["rtl", "ltr"] | None = None
    view_mode: Literal["grid", "list"] | None = None
    sidebar_collapsed: bool | None = None


class AvatarUpdate(BaseModel):
    avatar: str | None

    @field_validator("avatar")
    @classmethod
    def validate_avatar(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        value = value.strip()
        if not value.startswith("data:"):
            if len(value) > 16:
                raise ValueError("Avatar character is too long")
            return value
        match = re.fullmatch(r"data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)", value)
        if match is None:
            raise ValueError("Avatar must be a PNG, JPEG, or WebP image")
        try:
            image = base64.b64decode(match.group(2), validate=True)
        except (binascii.Error, ValueError) as exc:
            raise ValueError("Avatar image is invalid") from exc
        if len(image) > 512 * 1024:
            raise ValueError("Avatar image may be at most 512 KB")
        return value


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse
