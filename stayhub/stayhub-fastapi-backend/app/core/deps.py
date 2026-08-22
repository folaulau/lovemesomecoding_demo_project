"""FastAPI dependencies: who is calling, and are they allowed to.

A dependency is FastAPI's answer to a middleware/filter chain, with one big advantage — it is a
plain function with type hints, so it is unit-testable on its own and shows up in the OpenAPI
schema. `Depends(require_host)` on a route is both the enforcement and the documentation.
"""

from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import rate_limit
from app.core.config import settings
from app.core.exceptions import ForbiddenException, UnauthorizedException
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.user import User

# auto_error=False so an ABSENT header reaches our code as None rather than FastAPI raising its
# own 403 with a different body shape. Every error the frontends see should come from
# core/exceptions.py — one error parser, not two.
bearer_scheme = HTTPBearer(auto_error=False)

DbSession = Annotated[Session, Depends(get_db)]
Credentials = Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)]


def get_current_user(db: DbSession, credentials: Credentials) -> User:
    if credentials is None:
        raise UnauthorizedException("Sign in to continue.")

    claims = decode_access_token(credentials.credentials)
    if claims is None or not claims.get("sub"):
        raise UnauthorizedException("Your session has expired. Please sign in again.")

    # ⚠️ The user is re-read from the database on every request, not trusted from the token. A
    # token issued an hour ago says nothing about whether the account has since been deleted or
    # demoted. The token proves WHO; the database says what they currently are.
    user = db.execute(
        select(User).where(User.public_id == claims["sub"], User.deleted.is_(False))
    ).scalar_one_or_none()

    if user is None:
        raise UnauthorizedException("Your account is no longer active.")
    return user


def get_optional_user(db: DbSession, credentials: Credentials) -> User | None:
    """For routes that behave differently when signed in but do not require it.

    An invalid token here is treated as "anonymous", not as an error — a stale token in
    localStorage should not stop someone browsing listings.
    """
    if credentials is None:
        return None
    claims = decode_access_token(credentials.credentials)
    if claims is None or not claims.get("sub"):
        return None
    return db.execute(
        select(User).where(User.public_id == claims["sub"], User.deleted.is_(False))
    ).scalar_one_or_none()


CurrentUser = Annotated[User, Depends(get_current_user)]
OptionalUser = Annotated[User | None, Depends(get_optional_user)]


def require_host(user: CurrentUser) -> User:
    """Gate for everything under /hosts. Note it checks the flag, not a role (decision D1)."""
    if not user.is_host:
        raise ForbiddenException("You need a host account to do that.")
    return user


def require_admin(user: CurrentUser) -> User:
    if user.role != UserRole.ADMIN:
        # 403 rather than 404 here, deliberately breaking the rule used elsewhere: the admin API
        # is a known, documented surface, so its existence is not a secret worth protecting.
        raise ForbiddenException("Staff access only.")
    return user


HostUser = Annotated[User, Depends(require_host)]
AdminUser = Annotated[User, Depends(require_admin)]


# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------
#
# Expressed as dependencies rather than as middleware, and that is a real choice.
#
# Middleware sees every request, which sounds like the right place for a limiter and makes it hard
# to give different endpoints different limits — you end up with a path-prefix table inside the
# middleware, which is a router badly reimplemented. It also means the limiter runs before FastAPI
# has worked out who is calling, so it can only ever limit by IP.
#
# A dependency runs after authentication, so it can limit the ACCOUNT (see `rate_limit.identify`),
# it sits on exactly the routes that need it, and it shows up in the OpenAPI document. The cost is
# that a new expensive endpoint is unprotected until someone adds the dependency — which is the
# same trade as every other `Depends(require_host)` in this file.
#
# ⚠️ In production a coarse limit belongs at the EDGE as well — the load balancer or the CDN —
# because a request refused there never costs a worker, a database connection or a log line. This
# is the fine-grained layer behind that, not a replacement for it.

LOGIN_RULE = rate_limit.Rule(
    name="login",
    capacity=settings.rate_limit_login_capacity,
    per_seconds=settings.rate_limit_login_seconds,
)

SEARCH_RULE = rate_limit.Rule(
    name="search",
    capacity=settings.rate_limit_search_capacity,
    per_seconds=settings.rate_limit_search_seconds,
)


def limit_login(request: Request) -> None:
    """Guards `POST /auth/login` against password guessing.

    Keyed on the IP, necessarily: there is no authenticated user yet, and keying on the submitted
    EMAIL would let an attacker lock a victim out of their own account by failing logins on their
    address — a limiter that becomes a denial-of-service tool against the person it protects.

    A serious deployment keys on both, with a per-account limit that slows attempts down and a
    per-IP limit that stops them, precisely so neither one alone can be abused this way.
    """
    if not settings.rate_limit_enabled:
        return
    rate_limit.enforce(
        LOGIN_RULE,
        rate_limit.identify(request),
        "Too many sign-in attempts. Please wait a moment and try again.",
    )


def limit_search(request: Request, user: "OptionalUser") -> None:
    """Guards `GET /search`, the most expensive read in the app.

    Keyed on the account when there is one — see `rate_limit.identify` for why that is both fairer
    and harder to evade than an address.
    """
    if not settings.rate_limit_enabled:
        return
    rate_limit.enforce(
        SEARCH_RULE,
        rate_limit.identify(request, user),
        "You are searching faster than we can keep up. Please slow down.",
    )


LoginRateLimit = Depends(limit_login)
SearchRateLimit = Depends(limit_search)
