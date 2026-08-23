from pydantic import BaseModel, ConfigDict

from app.schemas.common import IdentifiedModel


class UserResponse(IdentifiedModel):
    model_config = ConfigDict(from_attributes=True)

    email: str
    name: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse
