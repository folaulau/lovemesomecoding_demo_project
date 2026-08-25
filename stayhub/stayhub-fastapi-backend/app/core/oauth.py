"""The OAuth2 authorization code flow, with PKCE, for "Sign in with Google".

This is a different job from `core/security.py`. That module mints StayHub's OWN token. This one
is about the round trip that happens BEFORE there is anything to mint: sending a browser to
Google, getting a code back, trading the code for Google's token, and asking Google who the person
is. The output of everything here is an `OAuthIdentity` — a claim about a human, from a third
party. `services/oauth_service.py` decides what StayHub does with that claim.

Two things in this file are the whole security argument, and both are easy to leave out because
the flow works without them:

**`state` is CSRF protection, not a convenience.** Without it, an attacker completes a login at
Google as themselves, keeps the resulting `code`, and then gets a victim's browser to visit
`/callback?code=<attacker's code>`. The victim's session is now signed in as the ATTACKER, who can
then read whatever the victim goes on to save — addresses, saved cards, trip history. `state` is a
value we generated and remembered, so a callback carrying one we never issued is discarded.

**PKCE is not just for mobile apps.** The RFC introduced it for public clients that cannot keep a
secret, and the docs still describe it that way, so server-side apps skip it. Do not: PKCE binds
the code to the browser that started the flow. Anywhere the code can leak — a Referer header off
the redirect page, a shared-machine browser history, a proxy log, an open redirect on your own
domain — the leaked code is useless without the verifier, which never left this server.

⚠️ **The state store fails CLOSED, unlike everything else in this app that touches Redis.**
`core/cache.py` treats an outage as a miss and `core/rate_limit.py` allows the request, both
deliberately. Here, a Redis outage means we cannot tell an issued `state` from a forged one, and
the only safe answer to "I cannot verify this" is to refuse. Failing open would turn a cache
outage into a silent hole in the login path — the exact class of bug that only shows up in the
incident report.
"""

from __future__ import annotations

import base64
import hashlib
import json
import logging
import secrets
from dataclasses import asdict, dataclass
from urllib.parse import urlencode

import httpx

from app.core.config import settings
from app.core.exceptions import ApiException, UnauthorizedException

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class OAuthIdentity:
    """What a provider told us about a person. A claim, not a fact — see `email_verified`."""

    provider: str
    subject: str
    email: str
    email_verified: bool
    first_name: str
    last_name: str
    avatar_url: str | None = None


@dataclass(frozen=True)
class Provider:
    name: str
    authorize_url: str
    token_url: str
    userinfo_url: str
    scopes: tuple[str, ...]
    client_id: str
    client_secret: str


class OAuthConfigurationError(ApiException):
    """This deployment cannot run the flow — no credentials, or the state store is down.

    Not a 4xx: the request was fine, the server is not. Returning 400 for an unconfigured provider
    sends someone hunting through their frontend for a bad provider name when the actual problem
    is an unset environment variable.
    """

    def __init__(self, message: str, *, status_code: int = 500) -> None:
        super().__init__(message, status_code=status_code)


def _google() -> Provider:
    return Provider(
        name="google",
        authorize_url="https://accounts.google.com/o/oauth2/v2/auth",
        token_url="https://oauth2.googleapis.com/token",
        # The OIDC userinfo endpoint, not the older `googleapis.com/oauth2/v2/userinfo`. This one
        # returns the standard claim names — `sub`, `email`, `email_verified` — which is what the
        # normaliser below expects and what every other OIDC provider also returns.
        userinfo_url="https://openidconnect.googleapis.com/v1/userinfo",
        scopes=("openid", "email", "profile"),
        client_id=settings.oauth_google_client_id,
        client_secret=settings.oauth_google_client_secret,
    )


def _github() -> Provider:
    return Provider(
        name="github",
        authorize_url="https://github.com/login/oauth/authorize",
        token_url="https://github.com/login/oauth/access_token",
        userinfo_url="https://api.github.com/user",
        # `user:email` is its own scope because GitHub treats email as separate from the profile.
        # Ask for `read:user` alone and `/user` returns `"email": null` for anyone who has ticked
        # "keep my email address private" — which is a lot of people, and the failure looks like a
        # bug in your code rather than a missing scope.
        scopes=("read:user", "user:email"),
        client_id=settings.oauth_github_client_id,
        client_secret=settings.oauth_github_client_secret,
    )


_BUILDERS = {"google": _google, "github": _github}


def get_provider(name: str) -> Provider:
    builder = _BUILDERS.get(name)
    if builder is None:
        raise OAuthConfigurationError(f"Unknown sign-in provider: {name}")
    provider = builder()
    if not provider.client_id or not provider.client_secret:
        raise OAuthConfigurationError(
            f"{name} sign-in is not configured on this deployment "
            f"(set STAYHUB_OAUTH_{name.upper()}_CLIENT_ID and _SECRET)."
        )
    return provider


# ---------------------------------------------------------------------------
# PKCE
# ---------------------------------------------------------------------------


def new_verifier() -> str:
    """A high-entropy secret that stays on this server for the length of one login.

    `token_urlsafe(64)` is 86 characters, inside the RFC 7636 range of 43–128. The RFC also allows
    a `plain` challenge method where the verifier IS the challenge; never use it. It is in the spec
    for clients that cannot compute SHA-256, and it provides no protection at all, because anyone
    who intercepts the challenge has the verifier.
    """
    return secrets.token_urlsafe(64)


def challenge_for(verifier: str) -> str:
    """S256: base64url(sha256(verifier)), with the padding stripped.

    ⚠️ The `=` padding must go. base64url in these specs is unpadded, and Google rejects a padded
    challenge with `invalid_grant` at the TOKEN step — one round trip after the mistake, on a
    different endpoint, with an error that says nothing about padding.
    """
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


# ---------------------------------------------------------------------------
# The pending-login store
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class PendingLogin:
    """Everything the callback needs that must NOT travel through the browser.

    `verifier` is the secret half of PKCE. `redirect_uri` is here because the token endpoint
    demands the identical string it saw at the authorize step, and rebuilding it from the callback
    request is how that drifts. `next_url` is where the user was going before we interrupted them.
    """

    provider: str
    verifier: str
    redirect_uri: str
    next_url: str


_STATE_PREFIX = "oauth:state:"


def _redis():
    """Reuses the client `core/cache.py` already owns, so there is one pool, not two."""
    from app.core import cache

    return cache._client()


def remember(pending: PendingLogin) -> str:
    """Mint a `state`, store what it stands for, and return it.

    Raises rather than degrading if Redis is unreachable — see the ⚠️ in the module docstring.
    """
    client = _redis()
    if client is None:
        raise OAuthConfigurationError(
            "Sign-in with a provider is temporarily unavailable.", status_code=503
        )

    state = secrets.token_urlsafe(32)
    try:
        client.setex(
            _STATE_PREFIX + state,
            settings.oauth_state_ttl_seconds,
            json.dumps(asdict(pending)),
        )
    except Exception as exc:  # noqa: BLE001 — any client error means we cannot verify later
        logger.error("oauth: could not store login state: %s", exc)
        raise OAuthConfigurationError(
            "Sign-in with a provider is temporarily unavailable.", status_code=503
        ) from exc
    return state


def consume(state: str) -> PendingLogin | None:
    """Look a `state` up and destroy it in the same breath. Returns None if it was never issued.

    ⚠️ `GETDEL`, not `GET` then `DELETE`. Those are two round trips, and two callbacks arriving
    together can both complete the GET before either DELETE lands — so one `state` authorises two
    logins. That is exactly the replay `state` exists to stop. `GETDEL` is a single atomic command
    (Redis 6.2+); the loser of the race gets None.
    """
    client = _redis()
    if client is None:
        raise OAuthConfigurationError(
            "Sign-in with a provider is temporarily unavailable.", status_code=503
        )
    try:
        raw = client.getdel(_STATE_PREFIX + state)
    except Exception as exc:  # noqa: BLE001
        logger.error("oauth: could not read login state: %s", exc)
        raise OAuthConfigurationError(
            "Sign-in with a provider is temporarily unavailable.", status_code=503
        ) from exc
    if raw is None:
        return None
    return PendingLogin(**json.loads(raw))


# ---------------------------------------------------------------------------
# The two halves of the flow
# ---------------------------------------------------------------------------


def redirect_uri_for(provider_name: str) -> str:
    """Where the provider sends the browser back.

    ⚠️ Built from configuration, never from the incoming request's Host header. A redirect_uri
    assembled from `request.url` follows whatever host a proxy — or an attacker — put in that
    header, and the value has to match the console registration character for character anyway.
    Deriving it from the request means the string differs between localhost, staging and
    production for reasons nobody can see in the code.
    """
    return f"{settings.oauth_redirect_base.rstrip('/')}/api/v1/auth/oauth/{provider_name}/callback"


def authorize_url(provider: Provider, state: str, verifier: str, redirect_uri: str) -> str:
    params = {
        "response_type": "code",
        "client_id": provider.client_id,
        "redirect_uri": redirect_uri,
        "scope": " ".join(provider.scopes),
        "state": state,
        "code_challenge": challenge_for(verifier),
        "code_challenge_method": "S256",
    }
    return f"{provider.authorize_url}?{urlencode(params)}"


def exchange_code(
    provider: Provider, code: str, verifier: str, redirect_uri: str, client: httpx.Client
) -> str:
    """Trade the one-time code for an access token. Returns the access token.

    ⚠️ `Accept: application/json` is there for GitHub, which answers this endpoint with
    `application/x-www-form-urlencoded` by default — so `response.json()` raises a JSON decode
    error on a 200 response, and the traceback points at your parsing rather than at the header
    you did not send. Google ignores the header and returns JSON regardless.
    """
    response = client.post(
        provider.token_url,
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "client_id": provider.client_id,
            "client_secret": provider.client_secret,
            "code_verifier": verifier,
        },
        headers={"Accept": "application/json"},
    )
    if response.status_code != 200:
        # The provider's body here says things like {"error": "invalid_grant"}, which is useful in
        # a log and meaningless to a person staring at a sign-in button.
        logger.warning(
            "oauth: %s token exchange failed with %s: %s",
            provider.name, response.status_code, response.text[:500],
        )
        raise UnauthorizedException("That sign-in could not be completed. Please try again.")

    token = response.json().get("access_token")
    if not token:
        raise UnauthorizedException("That sign-in could not be completed. Please try again.")
    return token


def fetch_identity(provider: Provider, access_token: str, client: httpx.Client) -> OAuthIdentity:
    headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/json"}
    response = client.get(provider.userinfo_url, headers=headers)
    if response.status_code != 200:
        logger.warning(
            "oauth: %s userinfo failed with %s", provider.name, response.status_code
        )
        raise UnauthorizedException("That sign-in could not be completed. Please try again.")

    profile = response.json()
    if provider.name == "github":
        return _github_identity(profile, headers, client)
    return _oidc_identity(provider.name, profile)


def _oidc_identity(provider_name: str, profile: dict) -> OAuthIdentity:
    """Google and every other OpenID Connect provider, which all use the same claim names."""
    return OAuthIdentity(
        provider=provider_name,
        # `sub`, not `email`. See the ⚠️ on OAuthAccount.subject — an email can be reassigned to
        # a different human; `sub` is the provider's permanent id for the account.
        subject=str(profile["sub"]),
        email=(profile.get("email") or "").strip().lower(),
        # ⚠️ Google returns this as a real boolean, but plenty of providers send the string
        # "true". `is True` would then be False and every login would be refused; truthiness on
        # the string "false" would accept everything. Compare against both explicitly.
        email_verified=profile.get("email_verified") in (True, "true", "True"),
        first_name=(profile.get("given_name") or "").strip(),
        last_name=(profile.get("family_name") or "").strip(),
        avatar_url=profile.get("picture"),
    )


def _github_identity(profile: dict, headers: dict, client: httpx.Client) -> OAuthIdentity:
    """GitHub is not an OIDC provider, and its differences are all in the email.

    `/user` returns `email: null` for anyone with a private address, and it has no notion of
    `email_verified` at all — so the address has to come from `/user/emails`, which does, and
    which is why `user:email` is in the scope list.
    """
    emails = client.get("https://api.github.com/user/emails", headers=headers)
    primary = {}
    if emails.status_code == 200:
        primary = next(
            (row for row in emails.json() if row.get("primary")),
            {},
        )

    name = (profile.get("name") or "").strip()
    first, _, last = name.partition(" ")
    return OAuthIdentity(
        provider="github",
        subject=str(profile["id"]),
        email=(primary.get("email") or profile.get("email") or "").strip().lower(),
        email_verified=bool(primary.get("verified")),
        first_name=first or profile.get("login", ""),
        last_name=last,
        avatar_url=profile.get("avatar_url"),
    )
