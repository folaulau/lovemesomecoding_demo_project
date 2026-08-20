"""Turning a SearchRequest into an Elasticsearch query, and hits back into DTOs."""

from typing import Any

from app.core.config import settings
from app.schemas.search import SearchHit, SearchRequest, SearchResponse


def build_query(req: SearchRequest) -> dict[str, Any]:
    """Compose the bool query.

    The distinction that matters here is **must vs filter**:

    - `must` clauses SCORE. Free text goes here, because how well a listing matches "beach cabin"
      should affect its ranking.
    - `filter` clauses do NOT score, they only include or exclude. Price ranges, guest counts and
      amenity checks go here. They are also **cacheable** — Elasticsearch caches filter results
      and reuses them across queries, which a scoring clause can never be.

    Putting `max_guests >= 4` in `must` is not wrong, exactly; it just makes every query slower and
    lets "sleeps more people" quietly outrank "actually matches what you searched for".
    """
    must: list[dict[str, Any]] = []
    filters: list[dict[str, Any]] = []

    if req.q:
        must.append(
            {
                "multi_match": {
                    "query": req.q,
                    # `^3` boosts city, `^2` title. A guest typing "Austin" means the place, not a
                    # description that mentions Austin in passing.
                    "fields": ["city^3", "title^2", "description", "state", "country"],
                    # Tolerates one typo in a short word, two in a longer one. "cabbin" finds
                    # cabins. AUTO rather than a fixed 2, because fuzziness on a 3-letter word
                    # matches almost anything.
                    "fuzziness": "AUTO",
                    "operator": "and",
                }
            }
        )
    else:
        # No text query still needs a scoreable clause, or ES has nothing to rank by.
        must.append({"match_all": {}})

    if req.guests:
        filters.append({"range": {"max_guests": {"gte": req.guests}}})

    if req.min_price is not None or req.max_price is not None:
        price_range: dict[str, float] = {}
        if req.min_price is not None:
            price_range["gte"] = float(req.min_price)
        if req.max_price is not None:
            price_range["lte"] = float(req.max_price)
        filters.append({"range": {"price_per_night": price_range}})

    if req.property_type:
        filters.append({"term": {"property_type": req.property_type}})
    if req.room_type:
        filters.append({"term": {"room_type": req.room_type}})

    for slug in req.amenities:
        # One `term` per amenity, so they AND together: "wifi AND parking". A single `terms` clause
        # with the whole list would be OR — "wifi OR parking" — which is not what a filter panel
        # means when a guest ticks two boxes.
        filters.append({"term": {"amenities": slug}})

    # Only PUBLISHED documents are ever indexed (see indexer.py), so no status filter is needed
    # here. That is the payoff for removing rather than flagging.

    sort: list[Any] = []
    if req.sort == "price_asc":
        sort = [{"price_per_night": "asc"}]
    elif req.sort == "price_desc":
        sort = [{"price_per_night": "desc"}]
    elif req.sort == "rating":
        # Tie-break on review count: a lone 5-star review should not outrank forty 4.9s.
        sort = [{"rating_average": "desc"}, {"rating_count": "desc"}]
    # "relevance" leaves `sort` empty, which means _score — the default and the whole point of
    # having a text query.

    body: dict[str, Any] = {
        "query": {"bool": {"must": must, "filter": filters}},
        "from": (req.page - 1) * req.page_size,
        "size": req.page_size,
        # Ask for an exact total rather than ES's default cap of 10,000. Honest pagination counts
        # matter more than the microseconds this costs at demo scale.
        "track_total_hits": True,
    }
    if sort:
        body["sort"] = sort
    return body


def to_response(raw: dict[str, Any], req: SearchRequest) -> SearchResponse:
    hits = [SearchHit(**hit["_source"]) for hit in raw["hits"]["hits"]]
    total = raw["hits"]["total"]["value"]
    return SearchResponse(
        hits=hits,
        total=total,
        page=req.page,
        page_size=req.page_size,
        took_ms=raw.get("took", 0),
    )


def index_name() -> str:
    return settings.elasticsearch_index
