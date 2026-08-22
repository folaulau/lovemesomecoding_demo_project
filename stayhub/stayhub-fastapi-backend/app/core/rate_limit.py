"""Rate limiting: a token bucket, in Redis, that fails open.

StayHub limits two things, and the choice of which two is the whole design:

- **`POST /auth/login`** — because an unlimited login endpoint is a password-guessing service with
  a nice JSON API. This limit is on the *client*, and it is strict.
- **`GET /search`** — because it is the most expensive read in the app (it goes to Elasticsearch)
  and the one a scraper hits hardest. This limit is generous; it exists to stop a runaway loop,
  not to inconvenience anyone browsing.

Everything else is unlimited here. A limiter on every endpoint sounds thorough and mostly buys
false confidence: the endpoints that need protecting are the ones that are expensive or that guard
a secret, and those are worth naming individually.

---

## Why a token bucket

Four algorithms get used for this, and they differ in what they do at the edges:

| algorithm | burst | memory | the flaw |
|---|---|---|---|
| fixed window | full limit each window | one counter | **double rate at the boundary** — 100 at 11:59:59 and 100 at 12:00:00 is 200 in one second |
| sliding log | none | one entry per request | exact, and unaffordable — a 1000/hour limit stores 1000 timestamps per client |
| sliding window counter | smoothed | two counters | an approximation; good, and more arithmetic to explain |
| **token bucket** | **bounded and deliberate** | **two numbers** | none that matters here |

The token bucket wins because burst is a *feature* and it is the only one that lets you set it
independently of the rate. A page that fires six requests on load should not be throttled by a
"one per second" rule; a bucket of 20 tokens refilling at 1/second allows that page load and still
holds the long-run average to one per second.

The state is two numbers per client — tokens remaining, and when they were last counted. A
timestamp and a float, regardless of traffic.

---

## Why the logic is a Lua script and not Python

This is the part that is genuinely easy to get wrong, and getting it wrong produces a limiter that
works perfectly in testing and does nothing under the load it exists for.

The obvious implementation is read, decide, write:

    tokens = redis.get(key)          # process A reads 1.0    process B reads 1.0
    if tokens >= 1: tokens -= 1      # A decides: allow       B decides: allow
    redis.set(key, tokens)           # A writes 0.0           B writes 0.0

Two requests, one token, both allowed. That is a lost update, and it is not a rare race: it is the
*normal* outcome when a client sends its requests concurrently, which is exactly what an abusive
client does. Under four API workers the effective limit becomes four times what it says.

`EVAL` fixes it because Redis runs a script as a single atomic unit — no other command from any
connection interleaves with it. Read, decide and write become one operation, which is what the
algorithm assumed all along.

---

## Why it fails OPEN

If Redis is unreachable, this module allows the request.

That is a real trade with a real downside, so it should be a decision rather than an accident. Fail
CLOSED and a Redis outage takes down login for everybody — a cache outage becomes a total outage,
which is the coupling `core/cache.py` was written to avoid, reintroduced by the back door. Fail
OPEN and a Redis outage means that, for its duration, the login endpoint is unprotected against
brute force while the passwords behind it are still bcrypt-hashed and the accounts still lock on
the *application* rules.

The right answer depends on what the limiter protects. For quota enforcement that someone is billed
against, fail closed — allowing free usage is worse than refusing service. For availability
protection, which is what this is, fail open. Say which one you chose and why, in the code, once.
"""

import logging
import time
from dataclasses import dataclass

from fastapi import status

from app.core import cache
from app.core.exceptions import ApiException

logger = logging.getLogger(__name__)

_FAIL_OPEN_LOGGED = False


class TooManyRequestsException(ApiException):
    """429, with the headers a well-behaved client needs to back off correctly.

    `Retry-After` is not decoration. Without it a client that gets a 429 has no information beyond
    "no", so it retries immediately — and a limiter that provokes a retry storm has made the load
    problem worse than the one it was deployed to fix.
    """

    def __init__(self, message: str, *, retry_after: int, limit: int, reset_at: int) -> None:
        super().__init__(
            message,
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            headers={
                # Seconds, per RFC 9110. An HTTP-date is also legal and nothing parses it well.
                "Retry-After": str(retry_after),
                "X-RateLimit-Limit": str(limit),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(reset_at),
            },
        )


@dataclass(frozen=True)
class Decision:
    allowed: bool
    remaining: int
    retry_after: int
    reset_at: int


@dataclass(frozen=True)
class Rule:
    """`capacity` requests may arrive at once; the bucket refills to full over `per_seconds`.

    Stating it as capacity-plus-window rather than a refill rate keeps the two numbers a human
    actually reasons about — "20 at once, 20 a minute sustained" — and derives the per-second rate
    below.
    """

    name: str
    capacity: int
    per_seconds: int

    @property
    def refill_per_second(self) -> float:
        return self.capacity / self.per_seconds


# ⚠️ KEYS[1] is passed as a KEY, not baked into the script body. Redis Cluster routes a script by
# its declared keys, so a script that builds key names internally works on a single node and breaks
# the day the cache is sharded — with no error, just a wrong node.
#
# `redis.call('TIME')` rather than a timestamp from the caller: the API runs on several machines and
# their clocks disagree by tens of milliseconds. One clock — the server's — is the only way every
# worker refills the same bucket consistently.
_TOKEN_BUCKET = """
local key        = KEYS[1]
local capacity   = tonumber(ARGV[1])
local refill     = tonumber(ARGV[2])
local ttl        = tonumber(ARGV[3])
local cost       = tonumber(ARGV[4])

local now_pair   = redis.call('TIME')
local now        = tonumber(now_pair[1]) + tonumber(now_pair[2]) / 1000000

local bucket     = redis.call('HMGET', key, 'tokens', 'ts')
local tokens     = tonumber(bucket[1])
local ts         = tonumber(bucket[2])

if tokens == nil then
  tokens = capacity
  ts = now
end

-- Refill for the elapsed time, capped at capacity. This is the whole algorithm: nothing runs on a
-- timer, the bucket is simply recomputed from how long it has been since anyone last looked.
local elapsed = math.max(0, now - ts)
tokens = math.min(capacity, tokens + elapsed * refill)

local allowed = 0
if tokens >= cost then
  tokens = tokens - cost
  allowed = 1
end

redis.call('HSET', key, 'tokens', tokens, 'ts', now)
-- ⚠️ Refreshed on every call. A bucket that expires while a client is still being limited hands
-- them a full one; the TTL exists only to reclaim keys for clients that have gone away.
redis.call('EXPIRE', key, ttl)

-- Seconds until one more token exists. Returned in milliseconds because Lua sends numbers to Redis
-- as integers, and this value is frequently less than one second.
local wait_ms = 0
if allowed == 0 then
  wait_ms = math.ceil(((cost - tokens) / refill) * 1000)
end

return { allowed, math.floor(tokens), wait_ms }
"""

_script = None


def _get_script():
    """Registered once per process. `redis-py` then uses EVALSHA and only falls back to EVAL if
    the script is not cached server-side — so the body crosses the wire once, not per request.

    ⚠️ Wrapped, and it was not until a test caught it. Registration itself looks like a local
    operation — it hashes the script body — but it runs on a client object that may be unbuildable
    (a malformed `redis_url` raises right here) and the whole fail-open guarantee is void if an
    exception can escape this module. The `check()` below only wrapped the CALL, so a failure one
    line earlier failed CLOSED: every login 500ing because Redis was misconfigured, which is the
    exact outcome the fail-open decision exists to prevent.
    """
    global _script
    if _script is None:
        try:
            client = cache._client()
            if client is None:
                return None
            _script = client.register_script(_TOKEN_BUCKET)
        except Exception as exc:  # noqa: BLE001
            _fail_open(exc)
            return None
    return _script


def _fail_open(exc: Exception) -> Decision:
    global _FAIL_OPEN_LOGGED
    if not _FAIL_OPEN_LOGGED:
        _FAIL_OPEN_LOGGED = True
        logger.warning(
            "Rate limiting is DISABLED — Redis is unreachable (%s). Requests are being allowed "
            "through unlimited. Logged once, not per request.",
            exc.__class__.__name__,
        )
    return Decision(allowed=True, remaining=-1, retry_after=0, reset_at=0)


def key_for(rule: Rule, identity: str) -> str:
    return f"stayhub:{cache.CACHE_VERSION}:ratelimit:{rule.name}:{identity}"


def check(rule: Rule, identity: str, *, cost: int = 1) -> Decision:
    """Spend one token for `identity` under `rule`. Never raises."""
    script = _get_script()
    if script is None:
        return _fail_open(RuntimeError("no redis client"))

    key = key_for(rule, identity)
    # Twice the window, so a bucket outlives the period it is limiting even for a client that goes
    # quiet halfway through.
    ttl = rule.per_seconds * 2

    try:
        allowed, tokens, wait_ms = script(
            keys=[key], args=[rule.capacity, rule.refill_per_second, ttl, cost]
        )
    except Exception as exc:  # noqa: BLE001
        return _fail_open(exc)

    retry_after = max(1, -(-int(wait_ms) // 1000)) if not allowed else 0
    return Decision(
        allowed=bool(allowed),
        remaining=int(tokens),
        retry_after=retry_after,
        reset_at=int(time.time()) + retry_after,
    )


def reset_for_tests() -> None:
    global _script, _FAIL_OPEN_LOGGED
    _script = None
    _FAIL_OPEN_LOGGED = False


# --------------------------------------------------------------------------- who is being limited
#
# A limiter is only as good as its notion of "who". Get this wrong and you either limit everyone
# together (one noisy client throttles the whole site) or limit nobody (every request looks unique).


# ⚠️ Trusting `X-Forwarded-For` blindly turns the limiter OFF.
#
# The header is set by the client. Anyone can send `X-Forwarded-For: <random>` on every request and
# get a fresh bucket each time — the limiter then diligently tracks millions of clients that made
# one request each. It is a header a PROXY sets, and it is only meaningful if you know a proxy you
# trust set it.
#
# The rule: take the header only when the request genuinely arrived from a trusted proxy, and take
# the entry that proxy appended, not the first one the client wrote. `TRUSTED_PROXY_COUNT` is how
# many hops sit in front of this app.
#
#   0  -> the app is directly exposed; ignore the header entirely (the default, and the safe one)
#   1  -> one load balancer in front; the LAST entry is the address it observed
#
# Locally there is no proxy, so this is 0 and `request.client.host` is the truth.
TRUSTED_PROXY_COUNT = 0

FORWARDED_FOR = "X-Forwarded-For"


def client_ip(request) -> str:
    """The best available identifier for an unauthenticated caller."""
    if TRUSTED_PROXY_COUNT > 0:
        forwarded = request.headers.get(FORWARDED_FOR, "")
        hops = [h.strip() for h in forwarded.split(",") if h.strip()]
        # Count from the RIGHT. The rightmost entries were appended by infrastructure we control;
        # everything to the left of those is whatever the client chose to claim.
        if len(hops) >= TRUSTED_PROXY_COUNT:
            return hops[-TRUSTED_PROXY_COUNT]

    # `request.client` is None for an ASGI transport with no peer — a TestClient call, or a
    # unix-socket deployment. Falling back to a constant means those all share one bucket, which
    # is correct: an unidentifiable caller should be limited more, not less.
    return request.client.host if request.client else "unknown"


def identify(request, user=None) -> str:
    """Prefer the account over the address.

    An IP is a poor identity in both directions: a university or an office NATs thousands of people
    behind one address, and a single abusive client can rent thousands of addresses. When a request
    is authenticated the user id is both fairer and harder to cycle — so it wins, and the IP is the
    fallback for callers who have not proved who they are.
    """
    if user is not None:
        return f"user:{user.public_id}"
    return f"ip:{client_ip(request)}"


def enforce(rule: Rule, identity_key: str, message: str) -> Decision:
    """Apply a rule and raise 429 if it says no.

    Returns the decision on success so a route can put `X-RateLimit-Remaining` on a 200 as well —
    a client that can see it getting low can slow down before being refused, which is the whole
    point of publishing the header.
    """
    decision = check(rule, identity_key)
    if not decision.allowed:
        raise TooManyRequestsException(
            message,
            retry_after=decision.retry_after,
            limit=rule.capacity,
            reset_at=decision.reset_at,
        )
    return decision
