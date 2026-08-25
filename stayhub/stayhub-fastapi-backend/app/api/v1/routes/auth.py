from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm

from app.core.deps import CurrentUser, DbSession, LoginRateLimit
from app.schemas.user import (
    AuthResponse,
    BecomeHostRequest,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegisterRequest, db: DbSession) -> AuthResponse:
    """Create an account and sign in immediately.

    The response carries a JWT that Hasura also accepts — one login for both APIs.
    """
    return AuthService(db).register(payload)


@router.post("/login", response_model=AuthResponse, dependencies=[LoginRateLimit])
def login(payload: UserLoginRequest, db: DbSession) -> AuthResponse:
    """Sign in. Rate limited — see `limit_login` in core/deps.py.

    ⚠️ The limiter is a `dependencies=[...]` entry rather than a parameter because this route does
    not USE its result. A parameter that is never read is a parameter someone deletes as unused,
    taking the limit with it.
    """
    return AuthService(db).login(payload.email, payload.password)


@router.post("/token", response_model=AuthResponse, dependencies=[LoginRateLimit])
def token(
    form: Annotated[OAuth2PasswordRequestForm, Depends()], db: DbSession
) -> AuthResponse:
    """The same sign-in as `/login`, in the shape OAuth2 specifies. Both are supported.

    This exists so the `Authorize` button on `/docs` works. `OAuth2PasswordBearer` in
    `core/deps.py` names this URL as its `tokenUrl`, and Swagger UI posts to it — but only in the
    exact form the spec describes: `application/x-www-form-urlencoded`, with the fields named
    `username` and `password`. `/login` takes JSON with an `email` field, because its callers are
    two React apps, so the button could never have worked against it.

    ⚠️ `username` carries an email here. The field name is fixed by the spec and cannot be
    renamed; `OAuth2PasswordRequestForm` is a dependency, not a Pydantic model, so there is no
    alias to set. Document it and move on.

    ⚠️ Form parsing needs `python-multipart` installed. Without it FastAPI raises at IMPORT time
    with "Form data requires python-multipart to be installed" — the whole app refuses to start
    over one endpoint, which is at least a loud failure rather than a quiet one.

    On the flow itself: this is OAuth2's *password grant*, and OAuth 2.1 removes it. It requires
    the client to handle the password, which is precisely what the rest of OAuth2 exists to avoid.
    It is fine for a first-party login on your own server — this one — and wrong for anything
    third-party, which is what `/auth/oauth/{provider}` is for.
    """
    return AuthService(db).login(form.username, form.password)


@router.get("/me", response_model=UserResponse)
def me(user: CurrentUser) -> UserResponse:
    """Who the current token belongs to. The frontends call this on boot to revive a session."""
    return UserResponse.model_validate(user)


@router.post("/become-host", response_model=AuthResponse)
def become_host(payload: BecomeHostRequest, user: CurrentUser, db: DbSession) -> AuthResponse:
    """Turn a guest account into a host account.

    Returns a NEW token — the old one does not carry the `host` Hasura role, so the frontend must
    replace it or every /hosts GraphQL query will be denied.
    """
    return AuthService(db).become_host(user, payload.host_bio)
