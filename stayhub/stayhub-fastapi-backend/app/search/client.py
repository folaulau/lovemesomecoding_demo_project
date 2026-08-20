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
    )


def es_available() -> bool:
    """Used by the health check and by the indexer, which must not crash writes when ES is down."""
    try:
        return bool(get_es().ping())
    except Exception:  # noqa: BLE001 — any transport failure means "not available"
        return False
