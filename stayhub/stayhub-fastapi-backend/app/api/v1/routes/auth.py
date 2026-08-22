from fastapi import APIRouter, status

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
