"""The properties index: its mapping, and how a Property row becomes a document.

Why an explicit mapping instead of letting Elasticsearch infer one? Because dynamic mapping guesses
from the FIRST document it sees. A `price_per_night` that happens to arrive as `120` becomes a
`long`, and the next listing at `119.50` is then rejected or silently truncated. Types this
important are declared, not guessed.
"""

from typing import Any

from elasticsearch import Elasticsearch

from app.core.config import settings
from app.models.property import Property

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


def ensure_index(es: Elasticsearch) -> None:
    """Create the index if it is missing. Safe to call on every startup.

    ⚠️ It does NOT update the mapping of an existing index, because Elasticsearch mostly cannot:
    field types are immutable once written. Changing a type means creating a new index and
    reindexing into it. Deleting and recreating is fine here only because Postgres is the source of
    truth and a rebuild is one call away.
    """
    if not es.indices.exists(index=settings.elasticsearch_index):
        es.indices.create(index=settings.elasticsearch_index, body=INDEX_SETTINGS)


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
