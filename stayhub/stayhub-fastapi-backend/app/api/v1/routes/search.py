"""`GET /search` — the one read that does not come from Hasura (decision D2).

Everything else the frontends read is a GraphQL query. This is not, because the whole point of
maintaining an Elasticsearch index is to answer this question without touching Postgres, and
Hasura reads Postgres.
"""

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Query

from app.core.exceptions import ApiException
from app.schemas.search import SearchRequest, SearchResponse
from app.search.client import es_available, get_es
from app.search.queries import build_query, index_name, to_response

router = APIRouter(prefix="/search", tags=["search"])


@router.get("", response_model=SearchResponse)
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
    page: int = Query(default=1, ge=1, le=100),
    page_size: int = Query(default=20, ge=1, le=100, alias="pageSize"),
    sort: str = Query(default="relevance", pattern="^(relevance|price_asc|price_desc|rating)$"),
) -> SearchResponse:
    """Search published listings.

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

    raw = get_es().search(index=index_name(), body=build_query(req))
    return to_response(raw.body if hasattr(raw, "body") else dict(raw), req)
