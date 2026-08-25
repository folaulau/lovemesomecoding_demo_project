"""The OAuth2 authorization code flow, end to end, without the internet.

`httpx.MockTransport` is what makes that possible, and it is a better tool here than
monkeypatching `exchange_code`. A monkeypatch replaces the function under test; the transport
lets the REAL function build the real request and then answers it — so these tests actually check
the grant type, the `code_verifier` and the `Accept` header, which is where the bugs are.

The route takes its client from the `http_client` dependency for exactly this reason. See
`app/api/v1/routes/oauth.py`.
"""

import base64
import hashlib
from datetime import UTC, datetime
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core import cache, oauth, rate_limit
from app.core.config import settings
from app.core.exceptions import ForbiddenException
from app.db.session import get_db
from app.main import app
from app.models.enums import UserRole
from app.models.oauth_account import OAuthAccount
from app.models.user import User
from app.services.auth_service import AuthService
from app.services.oauth_service import OAuthService

redis_required = pytest.mark.skipif(
    not cache.available(),
    reason="Redis is not running — start it with `docker compose up -d redis`",
)

GOOGLE_SUB = "104219871234509876543"


@pytest.fixture(autouse=True)
def _configured():
    """Credentials, and the limiter off.

    The limiter is real and shared with `/auth/login`, so a dozen calls to `/authorize` in one
    file would start returning 429 partway through and the failure would look like an OAuth bug.
    `tests/test_rate_limit.py` is where the limiter is tested.
    """
    cache.reset_for_tests()
    rate_limit.reset_for_tests()
    _drop_pending_logins()
    with patch.multiple(
        settings,
        oauth_google_client_id="test-client-id",
        oauth_google_client_secret="test-client-secret",
        oauth_redirect_base="http://localhost:8000",
        oauth_success_redirect="http://localhost:5174/auth/callback",
        rate_limit_enabled=False,
    ):
        yield
    cache.reset_for_tests()
    # Every `/authorize` writes a key that only a completed callback deletes, and most of these
    # tests deliberately never complete one. They expire in ten minutes, so nothing breaks — but
    # a full run left 179 of them behind, which is exactly the kind of debris that makes the next
    # person distrust what they are looking at in redis-cli.
    _drop_pending_logins()


def _drop_pending_logins() -> None:
    client = cache._client()
    if client is None:
        return
    try:
        # SCAN, not KEYS: KEYS blocks the whole server while it walks the keyspace, and the habit
        # matters more than the size of this test database.
        keys = list(client.scan_iter(match="oauth:state:*", count=500))
        if keys:
            client.delete(*keys)
    except Exception:  # noqa: BLE001
        # ⚠️ `cache._client()` hands back a client whether or not anything is listening — redis-py
        # connects lazily. So "is Redis up?" cannot be answered by a None check, and without this
        # guard a stopped Redis turns an autouse CLEANUP into an error on every test in the file,
        # including the ones that never touch it.
        pass


def _identity(**overrides) -> oauth.OAuthIdentity:
    base = dict(
        provider="google", subject=GOOGLE_SUB, email="alex@example.com",
        email_verified=True, first_name="Alex", last_name="Moreau",
    )
    base.update(overrides)
    return oauth.OAuthIdentity(**base)


# ---------------------------------------------------------------------------
# PKCE
# ---------------------------------------------------------------------------


class TestPkce:
    def test_the_challenge_is_unpadded_base64url_of_the_sha256(self):
        verifier = "a" * 64
        expected = base64.urlsafe_b64encode(hashlib.sha256(b"a" * 64).digest()).rstrip(b"=")
        assert oauth.challenge_for(verifier) == expected.decode()

    def test_the_challenge_carries_no_padding(self):
        # The failure this guards against is one round trip away from its cause: Google accepts a
        # padded challenge at /authorize and rejects it at /token with `invalid_grant`.
        assert "=" not in oauth.challenge_for(oauth.new_verifier())

    def test_the_verifier_is_within_the_rfc_length_range(self):
        assert 43 <= len(oauth.new_verifier()) <= 128

    def test_two_verifiers_are_never_the_same(self):
        assert len({oauth.new_verifier() for _ in range(50)}) == 50


# ---------------------------------------------------------------------------
# The state store
# ---------------------------------------------------------------------------


@redis_required
class TestStateStore:
    def _pending(self) -> oauth.PendingLogin:
        return oauth.PendingLogin(
            provider="google", verifier="v", redirect_uri="http://localhost:8000/cb", next_url="/"
        )

    def test_a_state_round_trips(self):
        state = oauth.remember(self._pending())
        assert oauth.consume(state) == self._pending()

    def test_a_state_is_single_use(self):
        # The replay guard. Without GETDEL — or with GET followed by DELETE — one authorisation
        # can be spent twice.
        state = oauth.remember(self._pending())
        assert oauth.consume(state) is not None
        assert oauth.consume(state) is None

    def test_a_state_we_never_issued_is_unknown(self):
        assert oauth.consume("not-a-state-this-server-minted") is None

    def test_two_states_are_never_the_same(self):
        assert len({oauth.remember(self._pending()) for _ in range(20)}) == 20


# ---------------------------------------------------------------------------
# What StayHub does with an identity
# ---------------------------------------------------------------------------


class TestSignIn:
    @pytest.fixture
    def existing(self, db) -> User:
        user = User(
            email="alex@example.com", password_hash="$2b$12$" + "x" * 53,
            first_name="Alex", last_name="Moreau", role=UserRole.CUSTOMER, is_host=False,
        )
        db.add(user)
        db.flush()
        return user

    def test_an_unverified_email_is_refused(self, db):
        with pytest.raises(ForbiddenException):
            OAuthService(db).sign_in(_identity(email_verified=False))

    def test_an_unverified_email_creates_nothing(self, db):
        # Refusing is only half of it. Falling through to "create an account anyway" would put a
        # second row on an address that may already belong to somebody.
        with pytest.raises(ForbiddenException):
            OAuthService(db).sign_in(_identity(email_verified=False))
        assert db.query(User).filter_by(email="alex@example.com").count() == 0

    def test_an_empty_email_is_refused(self, db):
        with pytest.raises(ForbiddenException):
            OAuthService(db).sign_in(_identity(email=""))

    def test_a_new_person_gets_an_account(self, db):
        response = OAuthService(db).sign_in(_identity())
        assert response.access_token
        assert response.user.email == "alex@example.com"
        assert db.query(User).filter_by(email="alex@example.com").count() == 1

    def test_a_verified_email_links_to_the_existing_account(self, db, existing):
        response = OAuthService(db).sign_in(_identity())
        assert response.user.public_id == existing.public_id
        assert db.query(User).filter_by(email="alex@example.com").count() == 1

    def test_signing_in_twice_does_not_link_twice(self, db):
        OAuthService(db).sign_in(_identity())
        OAuthService(db).sign_in(_identity())
        assert db.query(OAuthAccount).filter_by(subject=GOOGLE_SUB).count() == 1

    def test_the_link_is_found_by_subject_not_by_email(self, db):
        """The provider account is the same one even after the person changes their address."""
        OAuthService(db).sign_in(_identity())
        again = OAuthService(db).sign_in(_identity(email="alex.moreau@example.com"))
        # Counting only the two addresses in play — the database this runs against carries seed
        # users, so a bare `count()` here would be asserting against the fixtures.
        assert db.query(User).filter(
            User.email.in_(["alex@example.com", "alex.moreau@example.com"])
        ).count() == 1
        assert again.user.email == "alex@example.com"

    def test_the_same_subject_at_two_providers_is_two_links(self, db):
        OAuthService(db).sign_in(_identity())
        OAuthService(db).sign_in(_identity(provider="github", email="alex@example.com"))
        assert db.query(OAuthAccount).filter_by(subject=GOOGLE_SUB).count() == 2

    def test_a_provider_never_grants_a_role(self, db):
        response = OAuthService(db).sign_in(_identity())
        user = db.query(User).filter_by(email="alex@example.com").one()
        assert user.role == UserRole.CUSTOMER
        assert response.user.is_host is False

    def test_the_password_path_answers_instead_of_crashing(self, db):
        """The reason the password hash is random rather than a sentinel like "!" or "".

        passlib cannot identify a sentinel as any known scheme and RAISES — so `/auth/login` on an
        OAuth-created address would 500, reachable by anyone who guesses the address. A random
        hash makes it answer "email or password is incorrect", which is both correct and dull.
        """
        OAuthService(db).sign_in(_identity())
        from app.core.exceptions import UnauthorizedException

        with pytest.raises(UnauthorizedException):
            AuthService(db).login("alex@example.com", "hunter2")


# ---------------------------------------------------------------------------
# The HTTP flow
# ---------------------------------------------------------------------------


def _google_transport(userinfo: dict, token_status: int = 200) -> httpx.MockTransport:
    """Answers the two Google endpoints, and records what was asked of them."""
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "oauth2.googleapis.com":
            seen["token_body"] = dict(
                pair.split("=", 1) for pair in request.content.decode().split("&")
            )
            seen["token_accept"] = request.headers.get("accept")
            if token_status != 200:
                return httpx.Response(token_status, json={"error": "invalid_grant"})
            return httpx.Response(200, json={"access_token": "google-access-token"})
        if request.url.host == "openidconnect.googleapis.com":
            seen["userinfo_auth"] = request.headers.get("authorization")
            return httpx.Response(200, json=userinfo)
        raise AssertionError(f"unexpected outbound request to {request.url}")

    transport = httpx.MockTransport(handler)
    transport.seen = seen  # type: ignore[attr-defined]
    return transport


@pytest.fixture
def client(db):
    transport = _google_transport(
        {
            "sub": GOOGLE_SUB, "email": "alex@example.com", "email_verified": True,
            "given_name": "Alex", "family_name": "Moreau",
        }
    )
    from app.api.v1.routes.oauth import http_client

    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[http_client] = lambda: httpx.Client(transport=transport)
    test_client = TestClient(app, follow_redirects=False)
    test_client.transport_seen = transport.seen  # type: ignore[attr-defined]
    yield test_client
    app.dependency_overrides.clear()


@redis_required
class TestAuthorize:
    def test_it_redirects_to_the_provider(self, client):
        response = client.get("/api/v1/auth/oauth/google/authorize")
        assert response.status_code == 307
        assert urlparse(response.headers["location"]).netloc == "accounts.google.com"

    def test_it_asks_for_pkce(self, client):
        response = client.get("/api/v1/auth/oauth/google/authorize")
        params = parse_qs(urlparse(response.headers["location"]).query)
        assert params["code_challenge_method"] == ["S256"]
        assert params["code_challenge"][0]
        # The verifier itself must never appear in a URL the browser sees.
        assert "code_verifier" not in params

    def test_the_redirect_uri_comes_from_configuration(self, client):
        response = client.get("/api/v1/auth/oauth/google/authorize")
        params = parse_qs(urlparse(response.headers["location"]).query)
        assert params["redirect_uri"] == [
            "http://localhost:8000/api/v1/auth/oauth/google/callback"
        ]

    def test_an_absolute_next_is_refused(self, client):
        """The open redirect. `next` arrives from the browser and is forced to a path."""
        state = self._start(client, next_url="https://stayhub-login.example/")
        assert oauth.consume(state).next_url == "/"

    def test_a_protocol_relative_next_is_refused(self, client):
        # `//evil.example` has no scheme and is still absolute to a browser — the check has to
        # reject it as well, and `startswith("/")` alone does not.
        state = self._start(client, next_url="//stayhub-login.example/")
        assert oauth.consume(state).next_url == "/"

    def test_a_relative_next_is_kept(self, client):
        state = self._start(client, next_url="/trips")
        assert oauth.consume(state).next_url == "/trips"

    def test_an_unconfigured_provider_is_not_a_client_error(self, client):
        with patch.object(settings, "oauth_github_client_id", ""):
            response = client.get("/api/v1/auth/oauth/github/authorize")
        assert response.status_code == 500

    def test_an_unknown_provider_is_rejected(self, client):
        assert client.get("/api/v1/auth/oauth/myspace/authorize").status_code == 500

    @staticmethod
    def _start(client, next_url: str = "/") -> str:
        """Run the authorize step and return the state it minted.

        ⚠️ It has to be THIS request's state. An earlier version called a helper that issued a
        second, plain `/authorize` and read the state off that one — so the assertion checked a
        pending login that never carried `next` at all, and passed for the wrong reason.
        """
        response = client.get(
            "/api/v1/auth/oauth/google/authorize", params={"next": next_url}
        )
        return parse_qs(urlparse(response.headers["location"]).query)["state"][0]


@redis_required
class TestCallback:
    def _start(self, client, next_url: str = "/") -> str:
        response = client.get(f"/api/v1/auth/oauth/google/authorize?next={next_url}")
        return parse_qs(urlparse(response.headers["location"]).query)["state"][0]

    def test_the_happy_path_signs_the_person_in(self, client, db):
        state = self._start(client)
        response = client.get(f"/api/v1/auth/oauth/google/callback?code=abc&state={state}")
        assert response.status_code == 307
        assert db.query(User).filter_by(email="alex@example.com").count() == 1

    def test_the_token_travels_in_the_fragment(self, client):
        state = self._start(client)
        location = client.get(
            f"/api/v1/auth/oauth/google/callback?code=abc&state={state}"
        ).headers["location"]
        parsed = urlparse(location)
        # In the fragment, which no browser sends to any server...
        assert "access_token=" in parsed.fragment
        # ...and NOT in the query string, which every access log and Referer header records.
        assert "access_token" not in parse_qs(parsed.query)

    def test_the_code_is_exchanged_with_the_verifier(self, client):
        state = self._start(client)
        client.get(f"/api/v1/auth/oauth/google/callback?code=abc&state={state}")
        body = client.transport_seen["token_body"]
        assert body["grant_type"] == "authorization_code"
        assert body["code"] == "abc"
        assert body["code_verifier"]
        assert body["client_secret"] == "test-client-secret"

    def test_the_exchange_asks_for_json(self, client):
        # GitHub answers this endpoint with form encoding unless asked otherwise, and the failure
        # is a JSON decode error on a 200.
        state = self._start(client)
        client.get(f"/api/v1/auth/oauth/google/callback?code=abc&state={state}")
        assert "application/json" in client.transport_seen["token_accept"]

    def test_userinfo_is_fetched_with_the_providers_token(self, client):
        state = self._start(client)
        client.get(f"/api/v1/auth/oauth/google/callback?code=abc&state={state}")
        assert client.transport_seen["userinfo_auth"] == "Bearer google-access-token"

    def test_a_state_we_never_issued_is_refused(self, client):
        response = client.get("/api/v1/auth/oauth/google/callback?code=abc&state=forged")
        assert response.status_code == 401

    def test_a_state_cannot_be_replayed(self, client):
        state = self._start(client)
        assert client.get(
            f"/api/v1/auth/oauth/google/callback?code=abc&state={state}"
        ).status_code == 307
        assert client.get(
            f"/api/v1/auth/oauth/google/callback?code=abc&state={state}"
        ).status_code == 401

    def test_a_state_from_one_provider_does_not_work_at_another(self, client):
        state = self._start(client)
        with patch.multiple(
            settings, oauth_github_client_id="gh", oauth_github_client_secret="ghs"
        ):
            response = client.get(
                f"/api/v1/auth/oauth/github/callback?code=abc&state={state}"
            )
        assert response.status_code == 401

    def test_pressing_cancel_is_not_an_error_page(self, client):
        """Every provider sends `?error=access_denied` when the consent screen is dismissed."""
        response = client.get("/api/v1/auth/oauth/google/callback?error=access_denied")
        assert response.status_code == 307
        assert "error=access_denied" in response.headers["location"]

    def test_a_callback_with_nothing_in_it_is_refused(self, client):
        assert client.get("/api/v1/auth/oauth/google/callback").status_code == 401

    def test_a_rejected_exchange_does_not_create_an_account(self, client, db):
        from app.api.v1.routes.oauth import http_client

        transport = _google_transport({}, token_status=400)
        app.dependency_overrides[http_client] = lambda: httpx.Client(transport=transport)
        state = self._start(client)
        response = client.get(f"/api/v1/auth/oauth/google/callback?code=abc&state={state}")
        assert response.status_code == 401
        assert db.query(User).filter_by(email="alex@example.com").count() == 0

    def test_the_next_url_survives_the_round_trip(self, client):
        state = self._start(client, next_url="/trips")
        location = client.get(
            f"/api/v1/auth/oauth/google/callback?code=abc&state={state}"
        ).headers["location"]
        assert "next=%2Ftrips" in location


# ---------------------------------------------------------------------------
# The password grant, and the Authorize button that depends on it
# ---------------------------------------------------------------------------


class TestPasswordGrant:
    @pytest.fixture
    def registered(self, db):
        from app.schemas.user import UserRegisterRequest

        email = f"grant-{datetime.now(UTC).timestamp()}@stayhub.test"
        AuthService(db).register(
            UserRegisterRequest(
                email=email, password="correct-horse", first_name="Pat", last_name="Nguyen"
            )
        )
        return email

    def test_it_accepts_form_encoding(self, client, registered):
        response = client.post(
            "/api/v1/auth/token",
            data={"username": registered, "password": "correct-horse"},
        )
        assert response.status_code == 200
        assert response.json()["accessToken"]

    def test_json_is_not_the_shape_this_endpoint_takes(self, client, registered):
        # Documents the constraint rather than lamenting it: the spec fixes the encoding, so
        # `/auth/login` exists alongside for the two React apps.
        response = client.post(
            "/api/v1/auth/token",
            json={"username": registered, "password": "correct-horse"},
        )
        assert response.status_code == 422

    def test_a_wrong_password_is_still_vague(self, client, registered):
        response = client.post(
            "/api/v1/auth/token", data={"username": registered, "password": "wrong"}
        )
        assert response.status_code == 401
        assert "incorrect" in response.json()["message"].lower()

    def test_the_token_it_returns_authenticates(self, client, registered):
        token = client.post(
            "/api/v1/auth/token",
            data={"username": registered, "password": "correct-horse"},
        ).json()["accessToken"]
        me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200
        assert me.json()["email"] == registered


class TestOpenApi:
    def test_the_docs_declare_a_token_endpoint(self, client):
        """What makes the `Authorize` button on /docs work at all."""
        schemes = client.get("/openapi.json").json()["components"]["securitySchemes"]
        flows = next(s for s in schemes.values() if s["type"] == "oauth2")["flows"]
        assert flows["password"]["tokenUrl"] == "api/v1/auth/token"

    def test_the_token_endpoint_it_names_exists(self, client):
        paths = client.get("/openapi.json").json()["paths"]
        assert "/api/v1/auth/token" in paths
