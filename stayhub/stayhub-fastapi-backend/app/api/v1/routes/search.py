"""`GET /search` — the one read that does not come from Hasura (decision D2).

Everything else the frontends read is a GraphQL query. This is not, because the whole point of
maintaining an Elasticsearch index is to answer this question without touching Postgres, and
Hasura reads Postgres.
"""

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Query

from app.core.deps import SearchRateLimit
from app.core.exceptions import ApiException
from app.schemas.search import SearchRequest, SearchResponse
from app.search.client import es_available, get_es
from app.search.queries import build_query, index_name, to_response

router = APIRouter(prefix="/search", tags=["search"])


@router.get("", response_model=SearchResponse, dependencies=[SearchRateLimit])
def search(
    q: str | None = Query(default=None, max_length=200),
    check_in: date | None = Query(default=None, alias="checkIn"),
    check_out: date | None = Query(default=None, alias="checkOut"),
    guests: int | None = Query(default=None, ge=1, le=50),
    min_price: Decimal | None = Query(default=None, ge=0, alias="minPrice"),
    max_price: Decimal | None = Query(default=None, ge=0, alias="maxPrice"),
    property_type: str | None = Query(default=None, alias="propertyType"),
    room_type: str | None = Query(default=None, alias="roomType"),
    # A repeated query parameter — `?amenities=wifi&amenities=parking` — not a comma-joined
    # string. It needs no parsing and no escaping decision for a value containing a comma.
    amenities: list[str] = Query(default=[]),
    # Geo — the map viewport. All three are optional, and `lat`/`lon` are only honoured together;
    # see SearchRequest.geo_point for why half a coordinate has to mean "no geo".
    lat: float | None = Query(default=None, ge=-90, le=90),
    lon: float | None = Query(default=None, ge=-180, le=180),
    radius_km: float | None = Query(default=None, gt=0, le=500, alias="radiusKm"),
    # Facets cost one `filter` aggregation per control (see queries.build_aggs). The result page
    # wants them; "load more" and the map's pan handler do not, and asking for them anyway is the
    # easiest accidental way to double a search's cost.
    facets: bool = Query(default=True),
    page: int = Query(default=1, ge=1, le=100),
    page_size: int = Query(default=20, ge=1, le=100, alias="pageSize"),
    sort: str = Query(default="relevance", pattern="^(relevance|price_asc|price_desc|rating|distance)$"),
) -> SearchResponse:
    """Search published listings.

    `lat` / `lon` / `radiusKm` restrict results to a circle and, whenever a coordinate is given,
    put a `distanceKm` on every hit. `sort=distance` makes proximity the ordering rather than a
    number. `facets=false` skips the filter-panel counts for callers that do not render them.

    ⚠️ `checkIn` / `checkOut` are accepted but do NOT filter results yet. Date availability lives
    in Postgres (the bookings table), not in the index, so filtering on it here would mean either
    denormalising every booking into the document or a second query per hit. The listing page
    checks availability properly. Saying so out loud beats a filter that quietly does nothing.
    """
    req = SearchRequest(
        q=q,
        check_in=check_in,
        check_out=check_out,
        guests=guests,
        min_price=min_price,
        max_price=max_price,
        property_type=property_type,
        room_type=room_type,
        amenities=amenities,
        lat=lat,
        lon=lon,
        radius_km=radius_km,
        page=page,
        page_size=page_size,
        sort=sort,
    )

    if not es_available():
        # An honest 503 beats an empty result set. "No listings match" and "search is down" look
        # identical to a user otherwise, and the second one is not their fault.
        raise ApiException(
            "Search is temporarily unavailable. Please try again in a moment.",
            status_code=503,
        )

    raw = get_es().search(index=index_name(), body=build_query(req, with_facets=facets))
    return to_response(raw.body if hasattr(raw, "body") else dict(raw), req)
