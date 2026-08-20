"""The Postgres → Elasticsearch sink, run from application code.

The README asks for the sync to happen "in the code" rather than via Debezium, a Hasura event
trigger or a cron job. That is a real design choice with a real trade-off, so it is worth being
explicit about what this does and does not guarantee.

**What it does:** every write path that changes a property calls `index_property` (or
`remove_property`) after committing. Postgres is the source of truth; the index is a derived,
disposable copy that can be rebuilt from scratch at any time.

**What it does not do:** it is not transactional. The commit succeeds and *then* the index is
updated, so a crash in between leaves the two out of step. That is deliberate — the alternative
(indexing inside the transaction) is worse: a slow or dead Elasticsearch would then fail writes
that have nothing wrong with them.

⚠️ **Index AFTER the commit, never before.** Indexing first means a rolled-back transaction leaves
a listing in search results that does not exist in the database — and the guest who clicks it gets
a 404 from a page that just told them it was available.

**Failures are logged, not raised.** A host publishing a listing must not get a 500 because a
search cluster is restarting. The listing is correct in Postgres; `rebuild_index` repairs the
index. In production this is where you would enqueue a retry instead of only logging.
"""

import logging

from elasticsearch import Elasticsearch
from elasticsearch.helpers import bulk

from app.core.config import settings
from app.models.enums import PropertyStatus
from app.models.property import Property
from app.search.client import get_es
from app.search.index import ensure_index, to_document

logger = logging.getLogger(__name__)


def index_property(prop: Property, *, es: Elasticsearch | None = None) -> bool:
    """Upsert one property into the index, or remove it if it should no longer be findable.

    A DRAFT, SUSPENDED or soft-deleted property is *deleted* from the index rather than indexed
    with a status flag. Filtering on `status: PUBLISHED` at query time would work too, but then
    every single query pays for the filter and one forgotten `.filter()` leaks a draft into public
    search results. Absent is safer than filtered.
    """
    client = es or get_es()
    try:
        ensure_index(client)
        should_be_visible = prop.status == PropertyStatus.PUBLISHED and not prop.deleted
        if not should_be_visible:
            return remove_property(str(prop.public_id), es=client)

        client.index(
            index=settings.elasticsearch_index,
            # The document id IS the public id. That makes indexing idempotent — the same call
            # twice updates rather than creating a duplicate — and makes deletion by id trivial.
            id=str(prop.public_id),
            document=to_document(prop),
        )
        return True
    except Exception:  # noqa: BLE001 — see the module docstring: never fail a write over this
        logger.exception("Failed to index property %s", prop.public_id)
        return False


def remove_property(public_id: str, *, es: Elasticsearch | None = None) -> bool:
    client = es or get_es()
    try:
        # `ignore_unavailable` / a 404 on delete is fine and expected: unpublishing a listing that
        # was never indexed is a no-op, not an error.
        client.delete(index=settings.elasticsearch_index, id=public_id, ignore=[404])
        return True
    except Exception:  # noqa: BLE001
        logger.exception("Failed to remove property %s from index", public_id)
        return False


def rebuild_index(properties: list[Property], *, es: Elasticsearch | None = None) -> int:
    """Drop the index and refill it from Postgres. The repair path, and the seed path.

    Because the index is derived data, a full rebuild is always safe — this is the payoff for
    treating Postgres as the single source of truth.
    """
    client = es or get_es()
    client.indices.delete(index=settings.elasticsearch_index, ignore=[404])
    ensure_index(client)

    if not properties:
        return 0

    # `bulk` sends one request for many documents. Indexing 500 listings one call at a time is
    # 500 round trips; this is one.
    actions = [
        {
            "_index": settings.elasticsearch_index,
            "_id": str(p.public_id),
            "_source": to_document(p),
        }
        for p in properties
    ]
    success, _ = bulk(client, actions, refresh="wait_for")
    logger.info("Reindexed %s properties", success)
    return success


def refresh_index(*, es: Elasticsearch | None = None) -> None:
    """Force pending writes to become searchable NOW.

    ⚠️ Elasticsearch is near-real-time: an indexed document is normally visible about a second
    later, so a test that indexes and immediately searches finds nothing and looks like a broken
    query. This exists for tests and the seed script — **never call it per write in production**,
    it defeats the batching that makes indexing fast.
    """
    client = es or get_es()
    try:
        client.indices.refresh(index=settings.elasticsearch_index)
    except Exception:  # noqa: BLE001
        logger.exception("Failed to refresh index")
