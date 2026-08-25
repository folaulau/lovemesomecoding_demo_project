"""What StayHub does with a claim from a provider.

`core/oauth.py` ends with an `OAuthIdentity`: Google says this browser belongs to
alex@example.com, subject 11029…, and that the address is verified. This module answers the only
question that matters next — **which StayHub account is that, and may we hand over its token?**

Three outcomes, in this order, and the order is the security:

1. **We have seen this (provider, subject) before.** Sign that user in. Nothing else is consulted;
   in particular the email on the identity is not used to find anybody, because a provider account
   whose address changed is still the same account.

2. **A StayHub account already uses that email address.** Link them — but ONLY if the provider
   says the address is verified. See the ⚠️ below; this is where the account takeover lives.

3. **Nobody has that address.** Create an account.
"""

import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import ForbiddenException
from app.core.oauth import OAuthIdentity
from app.core.security import create_access_token, hash_password
from app.models.enums import UserRole
from app.models.oauth_account import OAuthAccount
from app.models.user import User
from app.schemas.user import AuthResponse, UserResponse


class OAuthService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def sign_in(self, identity: OAuthIdentity) -> AuthResponse:
        user = self._find_linked(identity)
        if user is None:
            user = self._link_or_create(identity)
        self.db.commit()

        token = create_access_token(
            user_public_id=str(user.public_id), role=user.role, is_host=user.is_host
        )
        return AuthResponse(access_token=token, user=UserResponse.model_validate(user))

    def _find_linked(self, identity: OAuthIdentity) -> User | None:
        link = self.db.execute(
            select(OAuthAccount).where(
                OAuthAccount.provider == identity.provider,
                OAuthAccount.subject == identity.subject,
            )
        ).scalar_one_or_none()
        return link.user if link else None

    def _link_or_create(self, identity: OAuthIdentity) -> User:
        # ⚠️ THE account takeover, and it is one `if`.
        #
        # Without it: register a provider account using someone else's address, click "Sign in
        # with <provider>", and the branch below matches an existing StayHub user by email and
        # hands you their account — bookings, saved cards, trip history. Some providers will
        # happily issue you an account on an address you have not proven you own; that is exactly
        # what `email_verified` is telling you.
        #
        # Refusing outright, rather than falling through to "create a new account", is deliberate:
        # creating one would put a second, unverified row on an address that already belongs to
        # somebody, and the support ticket that follows is unanswerable.
        if not identity.email or not identity.email_verified:
            raise ForbiddenException(
                "Your provider has not verified that email address, so we cannot sign you in "
                "with it. Verify it with them, or sign in with your password."
            )

        user = self.db.execute(
            select(User).where(User.email == identity.email, User.deleted.is_(False))
        ).scalar_one_or_none()

        if user is None:
            user = User(
                email=identity.email,
                # ⚠️ A RANDOM hash, not a sentinel like "" or "!". The obvious move is a value
                # that could never be a hash — and then `POST /auth/login` on that address reaches
                # `verify_password`, passlib cannot identify the string as any known scheme, and
                # it raises. The endpoint 500s instead of returning "email or password is
                # incorrect", and the crash is reachable by anyone who guesses the address.
                #
                # Hashing 32 random bytes costs one bcrypt round at signup and makes the password
                # path answer correctly and unremarkably: no password matches, ever.
                password_hash=hash_password(secrets.token_urlsafe(32)),
                first_name=identity.first_name or identity.email.split("@")[0],
                last_name=identity.last_name or "",
                avatar_url=identity.avatar_url,
                # Same rule as `AuthService.register`: hardcoded. A provider does not get to say
                # what role somebody has here.
                role=UserRole.CUSTOMER,
                is_host=False,
            )
            self.db.add(user)
            self.db.flush()

        self.db.add(
            OAuthAccount(
                user_id=user.id,
                provider=identity.provider,
                subject=identity.subject,
                email=identity.email,
            )
        )
        return user
