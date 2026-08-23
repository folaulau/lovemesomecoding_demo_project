"""The Elasticsearch client, created once per process."""

import logging
from functools import lru_cache

from elasticsearch import Elasticsearch

from app.core.config import settings

logger = logging.getLogger(__name__)


@lru_cache
def get_es() -> Elasticsearch:
    """One client, reused. It holds a connection pool, so building a new one per request would
    open a new pool per request."""
    return Elasticsearch(
        settings.elasticsearch_url,
        # A search that hangs must not hang the API. Better a fast failure the route can turn
        # into "search is unavailable" than a request that ties up a worker for a minute.
        request_timeout=5,
        retry_on_timeout=True,
        max_retries=2,
        **_auth(),
    )


def _auth() -> dict:
    """Whichever credential is configured, or none at all.

    ⚠️ An API key and a username/password are mutually exclusive in this client — passing both
    raises `ValueError: Can't specify both 'api_key' and 'basic_auth'` at construction time, which
    is a crash on the first search rather than a config warning at startup. The key wins because
    it is the one with least privilege.

    ⚠️ Sending credentials to a cluster running with `xpack.security.enabled: false` is NOT a
    harmless no-op — it returns 401 with "missing authentication credentials" on a cluster that
    has no authentication at all, which is a genuinely confusing error to debug. Hence: send
    nothing unless something is configured.
    """
    if settings.elasticsearch_api_key:
        return {"api_key": settings.elasticsearch_api_key}
    if settings.elasticsearch_username and settings.elasticsearch_password:
        return {"basic_auth": (settings.elasticsearch_username, settings.elasticsearch_password)}
    return {}


def es_available() -> bool:
    """Used by the health check and by the indexer, which must not crash writes when ES is down."""
    try:
        return bool(get_es().ping())
    except Exception:  # noqa: BLE001 — any transport failure means "not available"
        return False
