"""Two endpoints, and the browser does the travelling between them.

    GET /auth/oauth/{provider}/authorize   ->  307 to the provider's consent screen
    GET /auth/oauth/{provider}/callback    ->  307 back to the frontend, with a StayHub token

Nothing here is called by JavaScript. Both are ordinary page navigations, because the middle of
the flow happens on a domain we do not control. That is why the token cannot simply be returned
in a JSON body the way `/auth/login` returns it — there is no fetch to receive it.
"""

from typing import Annotated
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, Query
from fastapi.responses import RedirectResponse

from app.core import oauth
from app.core.config import settings
from app.core.deps import DbSession, LoginRateLimit
from app.core.exceptions import UnauthorizedException
from app.services.oauth_service import OAuthService

router = APIRouter(prefix="/auth/oauth", tags=["auth"])


def http_client():
    """The outbound HTTP client, as a dependency rather than a module-level global.

    This is the only reason the flow is testable without the internet: a test overrides this with
    a client wired to `httpx.MockTransport` and every request the routes make is answered locally.
    Reaching for `httpx.post(...)` directly inside the service would leave monkeypatching as the
    only option, which stops exercising the code that builds the request — and the request body is
    exactly where these bugs are.

    `yield` rather than `return` so the connection pool is closed when the request ends.
    """
    with httpx.Client(timeout=10.0, follow_redirects=False) as client:
        yield client


HttpClient = Annotated[httpx.Client, Depends(http_client)]


@router.get("/{provider_name}/authorize", dependencies=[LoginRateLimit])
def start(provider_name: str, next: Annotated[str, Query()] = "/") -> RedirectResponse:
    """Begin a sign-in. Sends the browser to the provider.

    ⚠️ `next` is where the user goes AFTER signing in, and it arrives from the browser, so it is
    forced to a path. Passing it through unchecked is a textbook open redirect: a link to
    `/authorize?next=https://stayhub-login.example/` sends someone through a genuine StayHub URL
    and a genuine Google consent screen, and lands them on a copy of the site — with everything up
    to that point looking exactly right.

    Rate limited with the same rule as `/auth/login`, because this endpoint also writes a Redis key
    per call and is just as anonymous.
    """
    provider = oauth.get_provider(provider_name)
    verifier = oauth.new_verifier()
    redirect_uri = oauth.redirect_uri_for(provider_name)

    state = oauth.remember(
        oauth.PendingLogin(
            provider=provider_name,
            verifier=verifier,
            redirect_uri=redirect_uri,
            next_url=next if next.startswith("/") and not next.startswith("//") else "/",
        )
    )

    # 307, not the default 302. A 302 lets a client turn the request into a GET, which is harmless
    # here and a real bug the day this becomes a POST — so the habit is worth having.
    return RedirectResponse(
        oauth.authorize_url(provider, state, verifier, redirect_uri), status_code=307
    )


@router.get("/{provider_name}/callback")
def callback(
    provider_name: str,
    db: DbSession,
    client: HttpClient,
    code: Annotated[str | None, Query()] = None,
    state: Annotated[str | None, Query()] = None,
    error: Annotated[str | None, Query()] = None,
) -> RedirectResponse:
    """Where the provider sends the browser back.

    ⚠️ `error` is not an edge case. Every provider sends the user here with `?error=access_denied`
    when they press Cancel on the consent screen, and a handler that only reads `code` treats that
    as a malformed callback and shows a crash to somebody who simply changed their mind.
    """
    if error:
        return RedirectResponse(
            f"{settings.oauth_success_redirect}?{urlencode({'error': error})}", status_code=307
        )
    if not code or not state:
        raise UnauthorizedException("That sign-in could not be completed. Please try again.")

    # The state check, and it comes FIRST — before the code is spent, before the provider is
    # contacted. An unknown state means this callback was not started by us.
    pending = oauth.consume(state)
    if pending is None or pending.provider != provider_name:
        raise UnauthorizedException("That sign-in link has expired. Please try again.")

    access_token = oauth.exchange_code(
        oauth.get_provider(provider_name), code, pending.verifier, pending.redirect_uri, client
    )
    identity = oauth.fetch_identity(
        oauth.get_provider(provider_name), access_token, client
    )
    auth = OAuthService(db).sign_in(identity)

    # ⚠️ The token goes in the FRAGMENT, after the `#`, not in the query string. A fragment is
    # never sent to a server: not to StayHub, not in a `Referer` header to whatever the landing
    # page loads, not into an access log or a proxy's. A token in `?access_token=` is written to
    # every one of those, and lands in browser history on a shared machine besides.
    #
    # This is the demo's simplification of a real deployment, which sets an HttpOnly cookie or
    # hands back a one-time code the SPA exchanges — both of which keep the token out of
    # JavaScript's reach entirely. The fragment is the best of the options that do not.
    fragment = urlencode({"access_token": auth.access_token, "token_type": "bearer"})
    destination = f"{settings.oauth_success_redirect}?{urlencode({'next': pending.next_url})}"
    return RedirectResponse(f"{destination}#{fragment}", status_code=307)
