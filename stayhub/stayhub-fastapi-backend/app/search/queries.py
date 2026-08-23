"""Turning a SearchRequest into an Elasticsearch query, and hits back into DTOs."""

from typing import Any

from app.core.config import settings
from app.schemas.search import (
    Facets,
    FacetBucket,
    PriceStats,
    SearchHit,
    SearchRequest,
    SearchResponse,
)

# The price buckets the filter panel offers. Hard-coded rather than computed, because a filter
# panel whose buckets move as you filter is unusable — the row you were aiming at slides away.
# `to=None` means "and up"; Elasticsearch range buckets are half-open, `from` inclusive.
PRICE_RANGES: list[dict[str, Any]] = [
    {"key": "0-100", "to": 100.0},
    {"key": "100-200", "from": 100.0, "to": 200.0},
    {"key": "200-350", "from": 200.0, "to": 350.0},
    {"key": "350-500", "from": 350.0, "to": 500.0},
    {"key": "500+", "from": 500.0},
]


# `^3` boosts city, `^2` title. A guest typing "Austin" means the place, not a description that
# mentions Austin in passing.
TEXT_FIELDS = ["city^3", "title^2", "description", "state", "country"]


def _text_clause(req: SearchRequest) -> dict[str, Any]:
    """The one scoring clause — two `multi_match`es, either of which may match.

    ⚠️ This used to be a single `multi_match` with `operator: and` and the default `best_fields`,
    and it had a bug that only shows up on real data: **"san francisco loft" returned nothing.**

    `best_fields` scores each field independently and keeps the best one, so `operator: and` means
    "every term in ONE field". "san francisco" lives in `city` and "loft" lives in `title`, so no
    single field held all three terms and a completely reasonable search came back empty. Verified
    against the seeded index: `best_fields` 0 hits, `cross_fields` 1 hit.

    `cross_fields` is the fix — it treats the listed fields as one big field for term-matching
    purposes, which is exactly the mental model a guest has. But it **cannot do fuzziness**:
    Elasticsearch rejects the combination outright with *"Fuzziness not allowed for type
    [cross_fields]"*, because a fuzzy expansion has no stable per-term document frequency to blend
    across fields.

    So neither type alone is right, and the answer is both in a `should`:

    - `cross_fields` catches terms spread across fields, exactly
    - `best_fields` + `fuzziness: AUTO` catches typos within one field — "cabbin" finds cabins.
      AUTO rather than a fixed 2, because fuzziness 2 on a 3-letter word matches almost anything.

    `minimum_should_match: 1` makes it an OR, and a document matching both simply scores higher —
    which is the correct preference, since an exact cross-field hit beats a fuzzy one.
    """
    if not req.q:
        # No text query still needs a scoreable clause, or ES has nothing to rank by.
        return {"match_all": {}}
    return {
        "bool": {
            "should": [
                {
                    "multi_match": {
                        "query": req.q,
                        "fields": TEXT_FIELDS,
                        "type": "cross_fields",
                        "operator": "and",
                    }
                },
                {
                    "multi_match": {
                        "query": req.q,
                        "fields": TEXT_FIELDS,
                        "fuzziness": "AUTO",
                        "operator": "and",
                    }
                },
            ],
            "minimum_should_match": 1,
        }
    }


def _named_filters(req: SearchRequest) -> dict[str, list[dict[str, Any]]]:
    """Every non-scoring clause, grouped under the facet it belongs to.

    The grouping is not tidiness. `build_aggs` needs to rebuild the filter list *minus one group*
    for each facet, and that is only possible if the clauses remember which control produced them.
    A flat list cannot be un-filtered.

    Why these are `filter` and not `must`: filter clauses do NOT score, they only include or
    exclude — and they are **cacheable**, which a scoring clause can never be. Putting
    `max_guests >= 4` in `must` is not wrong, exactly; it just makes every query slower and lets
    "sleeps more people" quietly outrank "actually matches what you searched for".
    """
    groups: dict[str, list[dict[str, Any]]] = {}

    if req.guests:
        groups["guests"] = [{"range": {"max_guests": {"gte": req.guests}}}]

    if req.min_price is not None or req.max_price is not None:
        price_range: dict[str, float] = {}
        if req.min_price is not None:
            price_range["gte"] = float(req.min_price)
        if req.max_price is not None:
            price_range["lte"] = float(req.max_price)
        groups["price"] = [{"range": {"price_per_night": price_range}}]

    if req.property_type:
        groups["property_type"] = [{"term": {"property_type": req.property_type}}]
    if req.room_type:
        groups["room_type"] = [{"term": {"room_type": req.room_type}}]

    if req.amenities:
        # One `term` per amenity, so they AND together: "wifi AND parking". A single `terms` clause
        # with the whole list would be OR — "wifi OR parking" — which is not what a filter panel
        # means when a guest ticks two boxes.
        groups["amenities"] = [{"term": {"amenities": slug}} for slug in req.amenities]

    origin = req.geo_point
    if origin and req.radius_km:
        # `geo_distance` is a filter, not a query: "within 10km" is a yes/no, and how far inside
        # the circle a listing sits should not change its ranking. If you want nearer to rank
        # higher, that is `sort=distance`, below — or a `function_score` decay, which is post 11's
        # subject rather than this one's.
        groups["geo"] = [{"geo_distance": {"distance": f"{req.radius_km}km", "location": origin}}]

    # Only PUBLISHED documents are ever indexed (see indexer.py), so no status filter is needed
    # here. That is the payoff for removing rather than flagging.
    return groups


def _flatten(groups: dict[str, list[dict[str, Any]]], *, exclude: str | None = None) -> list[dict[str, Any]]:
    return [clause for name, clauses in groups.items() if name != exclude for clause in clauses]


def _sort_spec(req: SearchRequest) -> tuple[list[Any], int | None]:
    """The `sort` array, and the index within it that carries the distance (or None).

    Elasticsearch returns each hit's sort values in the same order as the sort array, so once a
    `_geo_distance` entry is in there its position IS how you read the distance back out. That is
    cheaper than a `script_field` and exact, because ES already computed it to sort by it.
    """
    origin = req.geo_point
    sort: list[Any] = []

    if req.sort == "price_asc":
        sort = [{"price_per_night": "asc"}]
    elif req.sort == "price_desc":
        sort = [{"price_per_night": "desc"}]
    elif req.sort == "rating":
        # Tie-break on review count: a lone 5-star review should not outrank forty 4.9s.
        sort = [{"rating_average": "desc"}, {"rating_count": "desc"}]
    elif req.sort == "distance" and origin:
        sort = []  # the geo entry appended below becomes the primary sort
    # "relevance" leaves `sort` empty, which means _score — the default and the whole point of
    # having a text query.

    geo_index: int | None = None
    if origin:
        if req.sort != "distance":
            # Distance is wanted as a NUMBER on every hit, not as the ordering. An explicit
            # `_score` first is required once anything else is in the array, because a bare
            # `[_geo_distance]` would silently reorder a relevance search by proximity.
            if not sort:
                sort = ["_score"]
            geo_index = len(sort)
        else:
            geo_index = 0
        sort.append(
            {
                "_geo_distance": {
                    "location": origin,
                    "order": "asc",
                    "unit": "km",
                    # A listing with no coordinates sorts last instead of failing the query.
                    "ignore_unmapped": True,
                }
            }
        )

    return sort, geo_index


def _highlight_spec() -> dict[str, Any]:
    """Which fields to mark up, and the setting that keeps it from being an XSS hole.

    ⚠️ `encoder: "html"` is not optional. Highlighting inserts `<mark>` into the ORIGINAL text and
    returns the result as a string the UI is expected to render as HTML — so without an encoder, a
    listing description containing `<script>` comes back as a live script tag inside a fragment the
    frontend was told to trust. `html` escapes the source text first and only then adds the marks.
    """
    return {
        "pre_tags": ["<mark>"],
        "post_tags": ["</mark>"],
        "encoder": "html",
        "fields": {
            "title": {"number_of_fragments": 0},  # 0 = return the whole field, marked up
            "city": {"number_of_fragments": 0},
            "description": {"fragment_size": 140, "number_of_fragments": 1},
        },
    }


def build_aggs(req: SearchRequest) -> dict[str, Any]:
    """The facet counts behind the filter panel — each one blind to its own filter.

    This is the part most aggregation tutorials leave out, and it is the part that decides whether
    a filter panel is usable.

    Count a facet inside the main query and it becomes self-confirming: tick "Austin" and the city
    aggregation now sees only Austin listings, so the city list collapses to a single row and the
    guest cannot switch cities without clearing the filter first. Same for every multi-select —
    tick "wifi" and every other amenity count is now "wifi AND that", which reads as though the
    catalogue shrank.

    What a guest actually expects from "Austin (48) · Denver (31)" is *"how many results would I
    get if I picked this instead"*. So each facet is counted with the text query and every OTHER
    filter applied, and its own filter dropped:

        global          -> escape the main query entirely
          filter        -> re-apply text + all filters EXCEPT this facet's
            terms/range -> count

    `global` is what makes the re-application possible; without it the aggregation is still scoped
    to the main query and dropping a clause changes nothing.

    The cost is honest: one `filter` aggregation per facet, all inside one request. That is fine at
    this scale. A large index would cut it down to the facets the panel actually shows, or accept
    self-confirming counts on the single-select controls where nobody notices.
    """
    groups = _named_filters(req)
    text = _text_clause(req)

    def scoped(exclude: str, inner: dict[str, Any]) -> dict[str, Any]:
        return {
            "filter": {"bool": {"must": [text], "filter": _flatten(groups, exclude=exclude)}},
            "aggs": {"buckets": inner},
        }

    return {
        "facets": {
            "global": {},
            "aggs": {
                # `city.raw`, not `city`. The analyzed `text` field would count "san", "francisco"
                # and "san francisco" as three different cities — aggregations run on TERMS, and
                # the terms of a text field are its tokens. That is what the `.raw` multi-field in
                # the mapping is for.
                "cities": scoped("city", {"terms": {"field": "city.raw", "size": 20}}),
                "property_types": scoped("property_type", {"terms": {"field": "property_type", "size": 20}}),
                "room_types": scoped("room_type", {"terms": {"field": "room_type", "size": 20}}),
                "amenities": scoped("amenities", {"terms": {"field": "amenities", "size": 30}}),
                "price_ranges": scoped(
                    "price", {"range": {"field": "price_per_night", "keyed": False, "ranges": PRICE_RANGES}}
                ),
                # Stats for the slider's endpoints. Also excluded from its own filter, or dragging
                # the slider shrinks the track it is drawn on.
                "price_stats": scoped("price", {"stats": {"field": "price_per_night"}}),
            },
        }
    }


def build_query(req: SearchRequest, *, with_facets: bool = True) -> dict[str, Any]:
    """Compose the whole request body: query, sort, pagination, highlighting and facets."""
    groups = _named_filters(req)
    sort, _ = _sort_spec(req)

    body: dict[str, Any] = {
        "query": {"bool": {"must": [_text_clause(req)], "filter": _flatten(groups)}},
        "from": (req.page - 1) * req.page_size,
        "size": req.page_size,
        # Ask for an exact total rather than ES's default cap of 10,000. Honest pagination counts
        # matter more than the microseconds this costs at demo scale.
        "track_total_hits": True,
    }
    if sort:
        body["sort"] = sort
    if req.q:
        # Highlighting costs real work — it re-analyses the stored field per hit — so it is only
        # asked for when there is a query term that could possibly be marked.
        body["highlight"] = _highlight_spec()
    if with_facets:
        body["aggs"] = build_aggs(req)
    return body


# ---------------------------------------------------------------------------
# Response mapping
# ---------------------------------------------------------------------------


def _buckets(node: dict[str, Any] | None) -> list[FacetBucket]:
    if not node:
        return []
    out: list[FacetBucket] = []
    for b in node.get("buckets", []):
        # A range bucket's key is already the label from PRICE_RANGES; a terms bucket's key is the
        # value itself. Both arrive as `key`, which is why one reader handles both.
        out.append(
            FacetBucket(
                key=str(b["key"]),
                count=b["doc_count"],
                **{"from": b.get("from")},
                to=b.get("to"),
            )
        )
    return out


def _facets(aggs: dict[str, Any] | None) -> Facets | None:
    if not aggs or "facets" not in aggs:
        return None
    f = aggs["facets"]

    def inner(name: str) -> dict[str, Any] | None:
        return f.get(name, {}).get("buckets")

    stats = f.get("price_stats", {}).get("buckets") or {}
    return Facets(
        cities=_buckets(inner("cities")),
        property_types=_buckets(inner("property_types")),
        room_types=_buckets(inner("room_types")),
        amenities=_buckets(inner("amenities")),
        price_ranges=_buckets(inner("price_ranges")),
        # `stats` over an empty bucket returns nulls for min/max/avg and 0 for count — hence the
        # `.get`s rather than indexing. An empty result set is not an error.
        price=PriceStats(min=stats.get("min"), max=stats.get("max"), avg=stats.get("avg")),
    )


def to_response(raw: dict[str, Any], req: SearchRequest) -> SearchResponse:
    _, geo_index = _sort_spec(req)

    hits: list[SearchHit] = []
    for hit in raw["hits"]["hits"]:
        distance = None
        if geo_index is not None:
            values = hit.get("sort") or []
            if geo_index < len(values):
                value = values[geo_index]
                # ES sorts unmapped/missing coordinates to the end with Infinity, which is not a
                # number any client should try to render as "1.8e308 km away".
                if isinstance(value, (int, float)) and value != float("inf"):
                    distance = round(float(value), 2)
        hits.append(
            SearchHit(
                **hit["_source"],
                score=hit.get("_score"),
                distance_km=distance,
                highlights=hit.get("highlight", {}),
            )
        )

    return SearchResponse(
        hits=hits,
        total=raw["hits"]["total"]["value"],
        page=req.page,
        page_size=req.page_size,
        took_ms=raw.get("took", 0),
        facets=_facets(raw.get("aggregations")),
    )


def index_name() -> str:
    return settings.elasticsearch_index
