"""A read cache, and a deliberate decision about what happens when it is not there.

StayHub caches one thing: the public listing page. That is the read a guest triggers dozens of
times while comparing places, it is expensive (a listing joins images, amenities and the host),
and it changes rarely — a host edits a listing a few times a year. Cache the hot, expensive,
rarely-changing read; leave everything else alone.

Three rules are baked into this module, and each one is a mistake this code is written to avoid.

**1. A cache outage and a cache miss are the same code path.**
Every call into Redis here is wrapped, and every failure returns "not cached" rather than raising.
A cache is an optimisation. The moment an optimisation can take the site down, it is a dependency,
and it has stopped being worth having. `docker compose up -d` without Redis running must serve
every page exactly as before, only slower — and it does.

**2. Cache-aside, not write-through.**
The reader fills the cache on a miss; the writer only *deletes*. A write-through cache has to
serialise the same object twice, in two places, and the two drift the first time someone adds a
field to one of them. Delete-on-write cannot drift: the worst case is an extra database read.

**3. Never cache a miss.**
`get_for_public` raises 404 for a draft, and it is tempting to cache that too — the ids are UUIDs,
so a hostile client cannot enumerate them, but a *host* publishing a listing can absolutely refresh
the page and be told for the next five minutes that it does not exist. Negative caching is a real
technique with a real purpose (absorbing a flood of lookups for something that does not exist), and
it is the wrong trade here.

Invalidation is explicit AND time-bounded, which sounds like belt-and-braces and is not:

- the explicit `invalidate()` on every write path is what makes an edit show up immediately;
- the TTL is what limits the damage when a write path is added that forgets to call it.

Either one alone is wrong. The TTL alone means stale listings for its whole duration; the delete
alone means one missed call caches a wrong price forever.
"""

import json
import logging
from functools import lru_cache
from typing import Any
from uuid import UUID

from app.core.config import settings

logger = logging.getLogger(__name__)

# Bumped when the SHAPE of a cached value changes — a new field on PropertyResponse, a renamed
# key. Old entries then simply never match and age out on their own TTL.
#
# The alternative is flushing the cache on deploy, which works right up until the deploy that
# rolls back: the new code is gone and its differently-shaped entries are not. A version in the
# key makes the two shapes coexist harmlessly instead of fighting.
CACHE_VERSION = "v1"

_UNAVAILABLE_LOGGED = False


@lru_cache
def _client() -> Any | None:
    """One client per process, holding one connection pool.

    Returns None — rather than raising — when redis-py is not installed at all, so that the
    dependency is genuinely optional. Everything below treats None exactly like a cache miss.
    """
    try:
        import redis
    except ImportError:
        logger.info("redis-py is not installed — the listing cache is disabled")
        return None

    return redis.Redis.from_url(
        settings.redis_url,
        # Values go in as JSON strings and must come back as strings, not bytes.
        decode_responses=True,
        # ⚠️ These timeouts are the whole safety argument, and the defaults are None — meaning
        # "wait forever". A Redis that is DOWN fails fast and costs nothing; a Redis that is
        # *hung* (swapping, saving a huge RDB, a broken network path that drops packets silently)
        # accepts the connection and never answers. With no timeout, every request that touches
        # the cache parks a worker on a socket read, and the API stops serving pages it could have
        # served straight from Postgres. Half a second is far longer than a local Redis needs and
        # far shorter than a user will wait.
        socket_connect_timeout=0.5,
        socket_timeout=0.5,
        # Without this a dropped connection surfaces as an error on the NEXT request rather than
        # being retried transparently — one restart of Redis becomes one failed page load.
        retry_on_timeout=True,
        health_check_interval=30,
    )


def available() -> bool:
    """Used by /health, which reports each dependency separately."""
    client = _client()
    if client is None:
        return False
    try:
        return bool(client.ping())
    except Exception:  # noqa: BLE001 — any transport failure means "not available"
        return False


def _warn_once(exc: Exception) -> None:
    """Log the first cache failure loudly, then stay quiet.

    A Redis that is down is down for every request. Logging each one turns a degraded cache into a
    log flood that buries the thing that actually broke — and log volume is not free when something
    is collecting it.
    """
    global _UNAVAILABLE_LOGGED
    if not _UNAVAILABLE_LOGGED:
        _UNAVAILABLE_LOGGED = True
        logger.warning(
            "Cache unavailable at %s (%s) — serving from the database. "
            "This is logged once, not per request.",
            settings.redis_url,
            exc.__class__.__name__,
        )


def get_json(key: str) -> Any | None:
    """Read a cached value. Returns None on a miss, on a failure, and on unreadable JSON."""
    client = _client()
    if client is None:
        return None
    try:
        raw = client.get(key)
    except Exception as exc:  # noqa: BLE001
        _warn_once(exc)
        return None
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Something wrote a value this code cannot read — a shape change that skipped
        # CACHE_VERSION, or another service sharing the keyspace. Treat it as a miss and let the
        # next write overwrite it, rather than 500ing on a corrupted cache entry.
        logger.warning("Discarding unreadable cache entry at %s", key)
        return None


def set_json(key: str, value: Any, ttl_seconds: int) -> None:
    """Store a value with an expiry. Failures are swallowed — a write that misses costs a lookup.

    `ttl_seconds` is required rather than defaulted on purpose. An entry with no expiry lives until
    something deletes it, and "something forgot to delete it" is the normal case; a key that cannot
    be set without a lifetime cannot be leaked by omission.
    """
    client = _client()
    if client is None:
        return
    try:
        client.setex(key, ttl_seconds, json.dumps(value, default=str))
    except Exception as exc:  # noqa: BLE001
        _warn_once(exc)


def invalidate(*keys: str) -> None:
    """Drop entries. Called from write paths, and it must never fail a write.

    ⚠️ If this silently does nothing because Redis is unreachable, the cache is ALSO unreachable
    for reads — so there is nothing stale to serve. The failure modes line up, which is why
    swallowing the error here is safe rather than merely convenient.
    """
    client = _client()
    if client is None or not keys:
        return
    try:
        client.delete(*keys)
    except Exception as exc:  # noqa: BLE001
        _warn_once(exc)


# --------------------------------------------------------------------------- keys
#
# Every key is built by a named function, never by an f-string at the call site. The reader and
# the writer MUST agree on the exact string, and the way they stop agreeing is a typo in one of
# two places — which does not error, it just caches forever and invalidates nothing.


def property_key(public_id: UUID | str) -> str:
    return f"stayhub:{CACHE_VERSION}:property:{public_id}"


def reset_for_tests() -> None:
    """Drop the memoised client so a test can point at a different Redis, or none at all."""
    global _UNAVAILABLE_LOGGED
    _UNAVAILABLE_LOGGED = False
    _client.cache_clear()
