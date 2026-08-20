"""Registration, sign-in, and becoming a host."""

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictException, UnauthorizedException
from app.core.security import create_access_token, hash_password, verify_password
from app.models.enums import UserRole
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.user import AuthResponse, UserRegisterRequest, UserResponse


class AuthService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.users = UserRepository(db)

    def register(self, payload: UserRegisterRequest) -> AuthResponse:
        email = payload.email.strip().lower()
        if self.users.email_exists(email):
            # Registration is the ONE place where "this email is taken" has to be said out loud —
            # the user cannot proceed otherwise. It does leak that the address has an account,
            # which is why sign-in below is deliberately vague instead.
            raise ConflictException("An account with that email already exists.")

        user = User(
            email=email,
            password_hash=hash_password(payload.password),
            first_name=payload.first_name.strip(),
            last_name=payload.last_name.strip(),
            # ⚠️ HARDCODED. Registration always creates a CUSTOMER. If this ever reads a role off
            # the request body, anyone can POST themselves an admin account.
            role=UserRole.CUSTOMER,
            # Hosting is a mode, not a role, so it IS safe to take from the body (D1).
            is_host=payload.become_host,
        )
        self.users.add(user)
        self.db.commit()
        return self._auth_response(user)

    def login(self, email: str, password: str) -> AuthResponse:
        user = self.users.get_by_email(email)

        # ⚠️ One message for both "no such user" and "wrong password". Distinguishing them turns
        # the login form into an account-enumeration oracle: try an email, and the error tells you
        # whether it is registered.
        if user is None or not verify_password(password, user.password_hash):
            raise UnauthorizedException("Email or password is incorrect.")

        return self._auth_response(user)

    def become_host(self, user: User, host_bio: str | None) -> AuthResponse:
        """Flip the host flag — and re-issue the token.

        ⚠️ Re-issuing is not optional. The Hasura roles are baked into the JWT at sign-in, so a
        user who becomes a host while holding an old token still carries
        `allowed_roles: [customer, anonymous]`. Every host GraphQL query then fails with a
        permission error that looks like a broken Hasura config rather than a stale token.
        """
        user.is_host = True
        if host_bio is not None:
            user.host_bio = host_bio
        self.db.commit()
        return self._auth_response(user)

    def _auth_response(self, user: User) -> AuthResponse:
        token = create_access_token(
            user_public_id=str(user.public_id), role=user.role, is_host=user.is_host
        )
        return AuthResponse(access_token=token, user=UserResponse.model_validate(user))
