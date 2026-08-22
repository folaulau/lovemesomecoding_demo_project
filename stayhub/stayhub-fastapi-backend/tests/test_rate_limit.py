"""The token bucket, and the two properties that decide whether a limiter is worth having:
it must be ATOMIC, and it must FAIL OPEN.

The atomicity test is the one that matters. A read-decide-write limiter passes every sequential
test ever written for it and lets four times the limit through under four workers — so the test
that would have caught it has to be concurrent, deliberately.
"""

import concurrent.futures as cf
import time
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.core import cache, rate_limit
from app.main import app

redis_required = pytest.mark.skipif(
    not cache.available(),
    reason="Redis is not running — start it with `docker compose up -d redis`",
)


@pytest.fixture(autouse=True)
def _clean():
    cache.reset_for_tests()
    rate_limit.reset_for_tests()
    yield
    cache.reset_for_tests()
    rate_limit.reset_for_tests()


@pytest.fixture
def rule():
    """A fresh rule and a bucket guaranteed empty of history.

    The name is unique per test run so two tests never share a bucket — a limiter test that
    inherits the previous test's spent tokens fails in a way that looks like a real bug.
    """
    r = rate_limit.Rule(name=f"test-{time.monotonic_ns()}", capacity=5, per_seconds=10)
    yield r
    cache.invalidate(rate_limit.key_for(r, "client"))


@redis_required
class TestTokenBucket:
    def test_it_allows_up_to_capacity(self, rule):
        results = [rate_limit.check(rule, "client").allowed for _ in range(5)]
        assert results == [True] * 5

    def test_it_refuses_past_capacity(self, rule):
        for _ in range(5):
            rate_limit.check(rule, "client")
        assert rate_limit.check(rule, "client").allowed is False

    def test_remaining_counts_down(self, rule):
        remaining = [rate_limit.check(rule, "client").remaining for _ in range(5)]
        assert remaining == [4, 3, 2, 1, 0]

    def test_a_refusal_says_how_long_to_wait(self, rule):
        for _ in range(5):
            rate_limit.check(rule, "client")
        decision = rate_limit.check(rule, "client")
        assert decision.allowed is False
        # Never zero: a `Retry-After: 0` invites the immediate retry the limiter exists to stop.
        assert decision.retry_after >= 1
        assert decision.retry_after <= rule.per_seconds

    def test_tokens_come_back_over_time(self, rule):
        """The bucket refills continuously — it is not a window that resets."""
        for _ in range(5):
            rate_limit.check(rule, "client")
        assert rate_limit.check(rule, "client").allowed is False

        # 5 tokens per 10s = one every 2s. Sleep 2.5s for one token, with margin.
        time.sleep(2.5)
        assert rate_limit.check(rule, "client").allowed is True

    def test_it_never_refills_past_capacity(self, rule):
        """An idle client gets a full bucket, not an unbounded one.

        Without the `math.min(capacity, ...)` in the script, a client that goes quiet for an hour
        comes back with an hour's worth of tokens and can spend them all at once — which is a
        limiter that permits precisely the burst it was deployed to prevent.
        """
        rate_limit.check(rule, "client")
        time.sleep(1.5)  # would accrue ~0.75 of a token; capacity caps it at 5
        allowed = sum(rate_limit.check(rule, "client").allowed for _ in range(10))
        assert allowed <= rule.capacity

    def test_clients_have_separate_buckets(self, rule):
        for _ in range(5):
            rate_limit.check(rule, "alice")
        assert rate_limit.check(rule, "alice").allowed is False
        assert rate_limit.check(rule, "bob").allowed is True
        cache.invalidate(rate_limit.key_for(rule, "alice"), rate_limit.key_for(rule, "bob"))

    def test_the_bucket_expires(self, rule):
        rate_limit.check(rule, "client")
        ttl = cache._client().ttl(rate_limit.key_for(rule, "client"))
        assert 0 < ttl <= rule.per_seconds * 2


@redis_required
class TestAtomicity:
    """The test a read-decide-write limiter fails, and the reason the logic is a Lua script.

    Sequentially, a racy limiter is indistinguishable from a correct one. Concurrently, it leaks.
    """

    def test_concurrent_requests_cannot_exceed_capacity(self):
        rule = rate_limit.Rule(name=f"race-{time.monotonic_ns()}", capacity=20, per_seconds=3600)
        # A long window so refill cannot mask a lost update by handing out extra tokens mid-test.

        with cf.ThreadPoolExecutor(max_workers=50) as pool:
            allowed = list(pool.map(lambda _: rate_limit.check(rule, "swarm").allowed, range(50)))

        assert sum(allowed) == 20, (
            f"{sum(allowed)} of 50 allowed against a capacity of 20 — the check is not atomic"
        )
        cache.invalidate(rate_limit.key_for(rule, "swarm"))


class TestFailsOpen:
    """With Redis gone the limiter must ALLOW. See the module docstring for why open, not closed."""

    def test_no_client_allows(self):
        rule = rate_limit.Rule(name="x", capacity=1, per_seconds=60)
        with patch.object(cache, "_client", return_value=None):
            rate_limit.reset_for_tests()
            decisions = [rate_limit.check(rule, "c") for _ in range(100)]
        assert all(d.allowed for d in decisions)

    def test_an_erroring_redis_allows(self):
        rule = rate_limit.Rule(name="x", capacity=1, per_seconds=60)

        class Exploding:
            def __getattr__(self, _n):
                def boom(*_a, **_kw):
                    raise ConnectionError("down")

                return boom

        with patch.object(cache, "_client", return_value=Exploding()):
            rate_limit.reset_for_tests()
            assert rate_limit.check(rule, "c").allowed is True

    def test_enforce_does_not_raise_when_redis_is_gone(self):
        rule = rate_limit.Rule(name="x", capacity=1, per_seconds=60)
        with patch.object(cache, "_client", return_value=None):
            rate_limit.reset_for_tests()
            for _ in range(50):
                rate_limit.enforce(rule, "c", "nope")  # must never raise


class TestIdentity:
    """A limiter is only as good as its notion of "who"."""

    class _Req:
        def __init__(self, host=None, headers=None):
            self.headers = headers or {}
            self.client = type("C", (), {"host": host})() if host else None

    def test_an_authenticated_user_is_keyed_by_account(self):
        user = type("U", (), {"public_id": "abc-123"})()
        assert rate_limit.identify(self._Req("1.2.3.4"), user) == "user:abc-123"

    def test_an_anonymous_caller_is_keyed_by_address(self):
        assert rate_limit.identify(self._Req("1.2.3.4")) == "ip:1.2.3.4"

    def test_a_forwarded_for_header_is_ignored_by_default(self):
        """⚠️ The security property. `X-Forwarded-For` is client-controlled: honouring it with no
        trusted proxy in front lets anyone mint a new bucket per request and turn the limiter off."""
        req = self._Req("1.2.3.4", {"X-Forwarded-For": "9.9.9.9, 8.8.8.8"})
        assert rate_limit.identify(req) == "ip:1.2.3.4"

    def test_with_a_trusted_proxy_the_last_hop_wins(self):
        """Counting from the RIGHT is what makes it unspoofable: the rightmost entries were
        appended by infrastructure we control, everything left of them is client-supplied."""
        req = self._Req("10.0.0.1", {"X-Forwarded-For": "spoofed, 203.0.113.5"})
        with patch.object(rate_limit, "TRUSTED_PROXY_COUNT", 1):
            assert rate_limit.identify(req) == "ip:203.0.113.5"

    def test_an_unidentifiable_caller_falls_back_to_one_shared_bucket(self):
        assert rate_limit.identify(self._Req(None)) == "ip:unknown"


@redis_required
class TestOverHttp:
    """What the client actually receives."""

    # ⚠️ `ip:testclient`, and finding that out cost a confusing red test.
    #
    # Starlette's TestClient does not leave `request.client` empty — it sets the peer to the
    # literal host "testclient". So these tests all share ONE bucket, every test in this class
    # drains it, and a bucket refilling at 10-per-300s does not recover between tests. Without the
    # explicit reset below the first test passes and every later one starts at 429.
    IDENTITY = "ip:testclient"

    @pytest.fixture
    def client(self):
        from app.core.deps import LOGIN_RULE

        key = rate_limit.key_for(LOGIN_RULE, self.IDENTITY)
        cache.invalidate(key)
        yield TestClient(app)
        cache.invalidate(key)

    def test_the_test_clients_identity_is_what_the_fixture_resets(self, client):
        """Guards the comment above. If Starlette ever changes that host, every test in this class
        starts failing for a reason that has nothing to do with rate limiting — this one names it."""
        assert client.post(
            "/api/v1/auth/login", json={"email": "x@stayhub.test", "password": "y"}
        ).status_code != 429
        assert cache.get_json(rate_limit.key_for(rate_limit.Rule("login", 1, 1), "x")) is None
        from app.core.deps import LOGIN_RULE

        assert cache._client().exists(rate_limit.key_for(LOGIN_RULE, self.IDENTITY))

    def _login(self, client):
        return client.post(
            "/api/v1/auth/login", json={"email": "nobody@stayhub.test", "password": "wrong"}
        )

    def test_login_is_limited(self, client):
        from app.core.config import settings

        codes = [self._login(client).status_code for _ in range(settings.rate_limit_login_capacity + 1)]
        assert codes[:-1] == [401] * settings.rate_limit_login_capacity
        assert codes[-1] == 429

    def test_the_429_carries_retry_after(self, client):
        from app.core.config import settings

        for _ in range(settings.rate_limit_login_capacity):
            self._login(client)
        response = self._login(client)

        assert response.status_code == 429
        assert int(response.headers["Retry-After"]) >= 1
        assert response.headers["X-RateLimit-Limit"] == str(settings.rate_limit_login_capacity)
        assert response.headers["X-RateLimit-Remaining"] == "0"

    def test_the_429_keeps_the_one_error_shape(self, client):
        """A 429 invented by the limiter must parse with the same frontend code as every other
        error — that is the whole reason it goes through ApiException."""
        from app.core.config import settings

        for _ in range(settings.rate_limit_login_capacity):
            self._login(client)
        body = self._login(client).json()
        assert set(body) == {"message", "fieldErrors"}

    def test_the_429_still_gets_cors_headers(self, client):
        """⚠️ Same trap as the 500 in core/middleware.py. A 429 with no
        `Access-Control-Allow-Origin` is reported by the browser as a CORS failure, so the frontend
        shows "network error" instead of "you are being rate limited"."""
        from app.core.config import settings

        for _ in range(settings.rate_limit_login_capacity):
            self._login(client)
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "nobody@stayhub.test", "password": "wrong"},
            headers={"Origin": "http://localhost:5174"},
        )
        assert response.status_code == 429
        assert response.headers["access-control-allow-origin"] == "http://localhost:5174"

    def test_the_off_switch_works(self, client):
        from app.core.config import settings

        with patch.object(settings, "rate_limit_enabled", False):
            codes = [self._login(client).status_code for _ in range(20)]
        assert 429 not in codes
