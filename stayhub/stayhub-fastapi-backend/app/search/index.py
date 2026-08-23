"""The properties index: its mapping, and how a Property row becomes a document.

Why an explicit mapping instead of letting Elasticsearch infer one? Because dynamic mapping guesses
from the FIRST document it sees. A `price_per_night` that happens to arrive as `120` becomes a
`long`, and the next listing at `119.50` is then rejected or silently truncated. Types this
important are declared, not guessed.

**`settings.elasticsearch_index` is an ALIAS, not an index** (changed 2026-08-22). The real indices
are `stayhub-properties-000001`, `-000002`, … and the alias points at exactly one of them. Nothing
outside this module needs to know that: every read and write still names the alias.

The reason is the warning that used to be on `ensure_index` and is still true — a field's type
cannot be changed once it has been written. Changing `bathrooms` from `integer` to `scaled_float`
means building a NEW index and moving the data into it, and the only question is whether search
is broken while that happens. Through an alias it is not: the new index is built and filled behind
the scenes, and one atomic `update_aliases` call moves every reader across between two requests.
Point the app at a concrete index instead and the same change is a delete, a gap, and a rebuild
with search returning nothing in the middle of it. See `reindex_into_new` below and
`scripts/reindex.py`.
"""

import logging
import re
from typing import Any

from elasticsearch import Elasticsearch

from app.core.config import settings
from app.models.property import Property

logger = logging.getLogger(__name__)

INDEX_SETTINGS: dict[str, Any] = {
    "settings": {
        # One shard: this is a demo, and a single shard also makes relevance scores stable.
        # Scores are computed per shard, so small multi-shard indexes give oddly inconsistent
        # ordering — the classic "why did the same query rank differently?" surprise.
        "number_of_shards": 1,
        "number_of_replicas": 0,
        "analysis": {
            "analyzer": {
                # Folds accents so "Malaga" finds "Málaga". Without this, a guest who does not
                # type the accent gets nothing back and concludes the city has no listings.
                "stayhub_text": {
                    "type": "custom",
                    "tokenizer": "standard",
                    "filter": ["lowercase", "asciifolding"],
                }
            }
        },
    },
    "mappings": {
        # Anything not listed is rejected rather than silently added. A typo'd field name then
        # fails loudly at index time instead of creating a field nothing will ever query.
        "dynamic": "strict",
        "properties": {
            "public_id": {"type": "keyword"},
            "title": {"type": "text", "analyzer": "stayhub_text"},
            "description": {"type": "text", "analyzer": "stayhub_text"},
            # `text` for matching, `keyword` for exact filters and aggregations. A city needs both:
            # "san fran" should match loosely, but "group listings by city" needs the exact string.
            "city": {
                "type": "text",
                "analyzer": "stayhub_text",
                "fields": {"raw": {"type": "keyword"}},
            },
            "state": {"type": "keyword"},
            "country": {"type": "keyword"},
            "property_type": {"type": "keyword"},
            "room_type": {"type": "keyword"},
            "status": {"type": "keyword"},
            "amenities": {"type": "keyword"},
            # `scaled_float` with factor 100 stores money as an integer number of cents behind the
            # scenes — exact to the penny, unlike a float, and sorts and ranges correctly.
            "price_per_night": {"type": "scaled_float", "scaling_factor": 100},
            "cleaning_fee": {"type": "scaled_float", "scaling_factor": 100},
            "max_guests": {"type": "integer"},
            "bedrooms": {"type": "integer"},
            "beds": {"type": "integer"},
            "bathrooms": {"type": "scaled_float", "scaling_factor": 10},
            "rating_average": {"type": "scaled_float", "scaling_factor": 100},
            "rating_count": {"type": "integer"},
            "cover_image_url": {"type": "keyword", "index": False},
            "latitude": {"type": "double"},
            "longitude": {"type": "double"},
            "location": {"type": "geo_point"},
            "created_at": {"type": "date"},
        },
    },
}


# ---------------------------------------------------------------------------
# The alias, and the concrete indices behind it
# ---------------------------------------------------------------------------

ALIAS = settings.elasticsearch_index
_GENERATION = re.compile(rf"^{re.escape(ALIAS)}-(\d{{6}})$")


def _generation_name(n: int) -> str:
    """`stayhub-properties-000007`. Zero-padded so the names sort lexicographically, which is what
    makes `_cat/indices` and a wildcard listing come back in creation order."""
    return f"{ALIAS}-{n:06d}"


def current_index(es: Elasticsearch) -> str | None:
    """The concrete index the alias points at, or None if the alias does not exist yet."""
    if not es.indices.exists_alias(name=ALIAS):
        return None
    # An alias may legally point at several indices; ours never should. If it somehow does, take
    # the newest by name rather than an arbitrary dict key, so the answer is at least stable.
    return sorted(es.indices.get_alias(name=ALIAS).keys())[-1]


def next_generation(es: Elasticsearch) -> str:
    """The name for the next index in the sequence, one past the highest that exists."""
    existing = es.indices.get(index=f"{ALIAS}-*", ignore_unavailable=True)
    generations = [int(m.group(1)) for name in existing if (m := _GENERATION.match(name))]
    return _generation_name(max(generations, default=0) + 1)


def ensure_index(es: Elasticsearch) -> str:
    """Make sure the alias exists and points at an index. Safe to call on every startup.

    Returns the concrete index name.

    ⚠️ It does NOT update the mapping of an existing index, because Elasticsearch mostly cannot:
    field types are immutable once written. That is what `reindex_into_new` is for.

    ⚠️ It also refuses to guess when it finds a CONCRETE index sitting on the alias's name. That is
    the pre-alias layout — a cluster created before 2026-08-22 — and Elasticsearch will not let an
    alias and an index share a name, so something has to give. Fixing it means moving real
    documents, which is not a thing a process should do silently while starting up: two API
    instances booting at once would both start it. `scripts/reindex.py --adopt` does it once, on
    purpose, with somebody watching.
    """
    index = current_index(es)
    if index is not None:
        return index

    if es.indices.exists(index=ALIAS):
        logger.warning(
            "%s is a concrete index, not an alias — the pre-alias layout. "
            "Run `python -m scripts.reindex --adopt` to migrate it. Continuing against it as-is.",
            ALIAS,
        )
        return ALIAS

    index = _generation_name(1)
    # Created with the alias attached IN THE SAME CALL. Create-then-alias is two requests, and a
    # crash between them leaves an index no reader can find and a startup that thinks it is done.
    es.indices.create(index=index, body={**INDEX_SETTINGS, "aliases": {ALIAS: {}}})
    logger.info("Created %s behind alias %s", index, ALIAS)
    return index


def reindex_into_new(es: Elasticsearch, *, drop_old: bool = False) -> dict[str, str]:
    """Build a new index with the CURRENT mapping, copy the data in, and flip the alias.

    This is the zero-downtime mapping change, and the order of the four steps is the whole point:

    1. create `…-00000N+1` from `INDEX_SETTINGS` as it stands in this file
    2. `_reindex` from the alias into it — readers are still on the old index, unaffected
    3. `update_aliases` with remove + add **in one call**, which Elasticsearch applies atomically;
       there is no instant at which the alias points at nothing
    4. only then delete the old index

    ⚠️ Writes that land DURING step 2 go to the old index and are not copied. StayHub can shrug
    that off — Postgres is the source of truth and `rebuild_index` repairs anything missed — but a
    system where the index is the source of truth needs dual writes or a replay from a log here,
    and this is the exact gap it needs them for.

    ⚠️ `drop_old=False` by default. Keeping the previous index costs disk and buys the rollback: if
    the new mapping is wrong, flipping the alias back is one call and takes no time at all. Delete
    it once the new one has served real traffic.
    """
    old = current_index(es)
    if old is None:
        raise RuntimeError(f"No index behind alias {ALIAS}; run ensure_index first")

    new = next_generation(es)
    es.indices.create(index=new, body=INDEX_SETTINGS)

    # `wait_for_completion=True` blocks until the copy is done. At real volume this is a task you
    # poll (`wait_for_completion=false` returns a task id) — at twelve documents it is instant.
    result = es.reindex(
        body={"source": {"index": ALIAS}, "dest": {"index": new}},
        wait_for_completion=True,
        refresh=True,
    )

    es.indices.update_aliases(
        body={
            "actions": [
                {"remove": {"index": old, "alias": ALIAS}},
                {"add": {"index": new, "alias": ALIAS}},
            ]
        }
    )
    logger.info("Alias %s: %s -> %s (%s docs)", ALIAS, old, new, result.get("created", 0))

    if drop_old:
        es.options(ignore_status=404).indices.delete(index=old)

    return {"old": old, "new": new, "created": result.get("created", 0)}


def to_document(prop: Property) -> dict[str, Any]:
    """Flatten a Property (plus its joined images and amenities) into one search document.

    Denormalising is the whole point of the index. A search result card needs the cover image and
    the amenity list, and joining for those at query time is exactly the work Elasticsearch exists
    to avoid. The cost is that a stale document is possible — which is why every write path calls
    the indexer.
    """
    lat = float(prop.latitude) if prop.latitude is not None else None
    lon = float(prop.longitude) if prop.longitude is not None else None

    doc: dict[str, Any] = {
        "public_id": str(prop.public_id),
        "title": prop.title,
        "description": prop.description or "",
        "city": prop.city,
        "state": prop.state,
        "country": prop.country,
        "property_type": prop.property_type,
        "room_type": prop.room_type,
        "status": prop.status,
        "amenities": [a.slug for a in prop.amenities],
        "price_per_night": float(prop.price_per_night),
        "cleaning_fee": float(prop.cleaning_fee),
        "max_guests": prop.max_guests,
        "bedrooms": prop.bedrooms,
        "beds": prop.beds,
        "bathrooms": float(prop.bathrooms),
        "rating_average": float(prop.rating_average),
        "rating_count": prop.rating_count,
        "cover_image_url": prop.cover_image_url,
        "latitude": lat,
        "longitude": lon,
        "created_at": prop.created_at.isoformat() if prop.created_at else None,
    }
    # geo_point only when both halves exist — ES rejects a half-populated one, and that rejection
    # would fail the whole bulk request, not just this document.
    if lat is not None and lon is not None:
        doc["location"] = {"lat": lat, "lon": lon}
    return doc
