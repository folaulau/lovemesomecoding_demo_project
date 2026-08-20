"""Password hashing, and the JWT that FastAPI signs and Hasura verifies.

This module is the whole reason one login works across two services. FastAPI mints the token;
Hasura is handed the same secret in docker-compose.yml and validates the signature itself. There is
no auth webhook, no second login, and no shared session store.
"""

from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# bcrypt, deliberately. It is slow by design, which is the point for a password hash.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Hasura reads its claims out of this exact namespace key. It is configurable
# (HASURA_GRAPHQL_JWT_SECRET's `claims_namespace`), but this is the default and changing it buys
# nothing.
HASURA_CLAIMS_NAMESPACE = "https://hasura.io/jwt/claims"


def hash_password(plain: str) -> str:
    # bcrypt silently truncates at 72 BYTES. Rejecting long passwords instead would surprise users;
    # truncating is what every bcrypt implementation does, so be explicit that it happens.
    return pwd_context.hash(plain[:72])


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain[:72], hashed)


def hasura_roles(role: str, is_host: bool) -> tuple[str, list[str]]:
    """Map a StayHub user onto the Hasura roles they are allowed to act as.

    `allowed_roles` is a list because one person is several things at once: a host is also a guest,
    and everyone can see what an anonymous visitor sees. The frontend picks which one a given query
    runs as with the `x-hasura-role` header; Hasura rejects anything not in this list.
    """
    if role == "ADMIN":
        return "admin", ["admin", "host", "customer", "anonymous"]
    if is_host:
        return "host", ["host", "customer", "anonymous"]
    return "customer", ["customer", "anonymous"]


def create_access_token(*, user_public_id: str, role: str, is_host: bool) -> str:
    default_role, allowed = hasura_roles(role, is_host)
    now = datetime.now(UTC)

    payload = {
        "sub": user_public_id,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
        HASURA_CLAIMS_NAMESPACE: {
            "x-hasura-default-role": default_role,
            "x-hasura-allowed-roles": allowed,
            # ⚠️ Every x-hasura-* claim must be a STRING, including ids. Hasura compares session
            # variables as text and a JSON number here fails with a type error deep inside a
            # permission check, pointing at the table rather than at the token.
            "x-hasura-user-id": user_public_id,
            "x-hasura-is-host": str(is_host).lower(),
        },
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict | None:
    """Returns the claims, or None for anything invalid — expired, tampered with, or malformed.

    The caller turns None into a 401. Distinguishing *why* a token is bad would tell an attacker
    which half of their guess was right.
    """
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
