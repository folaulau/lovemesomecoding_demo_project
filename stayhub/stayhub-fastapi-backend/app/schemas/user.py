from datetime import datetime
from uuid import UUID

from pydantic import EmailStr, Field

from app.schemas.common import ApiModel


class UserRegisterRequest(ApiModel):
    email: EmailStr
    # 8 is the floor, not the goal. Length beats character-class rules — "correct horse battery
    # staple" is stronger than "P@ss1!" and far easier to remember.
    password: str = Field(min_length=8, max_length=128)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    # A guest can declare up front that they intend to host. Note what is NOT here: `role`.
    # Accepting a role from a registration body is how an API hands out admin accounts.
    become_host: bool = False


class UserLoginRequest(ApiModel):
    email: EmailStr
    password: str


class UserResponse(ApiModel):
    public_id: UUID
    email: EmailStr
    first_name: str
    last_name: str
    full_name: str
    role: str
    is_host: bool
    avatar_url: str | None = None
    host_bio: str | None = None
    created_at: datetime


class AuthResponse(ApiModel):
    """What both frontends store after a successful sign-in.

    The token is returned in the body rather than set as a cookie because Hasura needs it in an
    `Authorization` header on every GraphQL request, and JavaScript cannot read an HttpOnly cookie
    to put it there. That trade is real: a body token lives somewhere XSS can reach it. A
    production build would use an HttpOnly refresh cookie plus a short-lived in-memory access
    token; this demo keeps the simpler shape so the auth snippet stays readable.
    """

    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class BecomeHostRequest(ApiModel):
    host_bio: str | None = Field(default=None, max_length=1000)
