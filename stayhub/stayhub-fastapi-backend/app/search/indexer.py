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
index.

**And a failure is now retried, not merely logged** (added 2026-08-22). `index_property` returns
False when the write did not land, and `property_service._sync` turns that False into an outbox
message — so a listing indexed during an Elasticsearch outage is re-indexed by the worker minutes
later instead of waiting for somebody to notice and run `rebuild_index`. The handler is at the
bottom of this file.

That combination — try inline, fall back to the queue — is worth naming, because doing only one is
worse both ways. Queue everything and the common case (Elasticsearch is fine) pays a worker
round-trip for no reason, and search is seconds stale for every edit. Queue nothing and a
thirty-second outage silently drops every change made during it.
"""

import logging
from uuid import UUID

from elasticsearch import Elasticsearch
from elasticsearch.helpers import bulk
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.enums import PropertyStatus
from app.models.property import Property
from app.search.client import get_es
from app.search.index import ensure_index, to_document
from app.services import outbox_service

logger = logging.getLogger(__name__)


def index_property(
    prop: Property, *, es: Elasticsearch | None = None, raise_on_error: bool = False
) -> bool:
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
            return remove_property(str(prop.public_id), es=client, raise_on_error=raise_on_error)

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
        # ⚠️ `raise_on_error` is for the WORKER, and only for the worker. On the request path a
        # False keeps a host's save working; in the worker a False would be read as success and
        # the message marked DONE, quietly discarding the retry this function exists to enable.
        # Same code, two callers, opposite correct behaviours — so the caller chooses.
        if raise_on_error:
            raise
        return False


def remove_property(
    public_id: str, *, es: Elasticsearch | None = None, raise_on_error: bool = False
) -> bool:
    client = es or get_es()
    try:
        # `ignore_unavailable` / a 404 on delete is fine and expected: unpublishing a listing that
        # was never indexed is a no-op, not an error.
        client.delete(index=settings.elasticsearch_index, id=public_id, ignore=[404])
        return True
    except Exception:  # noqa: BLE001
        logger.exception("Failed to remove property %s from index", public_id)
        if raise_on_error:
            raise
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



# ---------------------------------------------------------------------------
# Outbox handler — the retry path
# ---------------------------------------------------------------------------

TOPIC_PROPERTY_CHANGED = "property.changed"


@outbox_service.handles(TOPIC_PROPERTY_CHANGED)
def _handle_property_changed(db: Session, payload: dict) -> None:
    """Re-index one property, reading it fresh from Postgres.

    ⚠️ It RE-READS rather than indexing a snapshot from the payload, and that is the opposite of
    what `models/outbox.py` says payloads are usually for. The reasoning inverts here because the
    index is *derived data whose only job is to match the database right now*. If the listing was
    edited three more times while Elasticsearch was down, indexing the first snapshot would write a
    stale document and then be marked DONE — leaving search confidently wrong. Re-reading
    collapses all four changes into one correct write.

    A booking-confirmation email is the other case: it describes a moment, so it carries the
    moment. Ask what the consumer needs — the event as it happened, or the world as it is.

    **Idempotent by construction.** The document id is the property's public id, so running this
    handler once or five times produces exactly the same index — which is the property that makes
    at-least-once delivery safe here rather than merely tolerable.

    Raising on failure is deliberate: `drain` catches it and schedules the next retry. The
    swallow-everything rule at the top of this file applies to the REQUEST path, where a 500 would
    punish a host for an infrastructure problem. In the worker, an exception is how you say
    "not done yet".
    """
    public_id = payload["propertyId"]

    prop = db.execute(
        select(Property).where(Property.public_id == UUID(public_id))
    ).scalar_one_or_none()

    if prop is None:
        # Hard-deleted between the event and the retry. Nothing to index and nothing to fix, so
        # make sure it is not in the index and call the message done — raising here would retry
        # eight times and then park a DEAD row for a listing nobody can look at.
        remove_property(public_id)
        return

    if not index_property(prop, raise_on_error=True):  # pragma: no cover - defensive
        raise RuntimeError(f"Could not index property {public_id}")
