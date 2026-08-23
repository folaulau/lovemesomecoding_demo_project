from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import Field

from app.schemas.common import ApiModel


class SearchRequest(ApiModel):
    """Query parameters for `GET /search` — the one read that does not come from Hasura (D2)."""

    q: str | None = Field(default=None, max_length=200, description="Free text: city, title, or description")
    check_in: date | None = None
    check_out: date | None = None
    guests: int | None = Field(default=None, ge=1, le=50)
    min_price: Decimal | None = Field(default=None, ge=0)
    max_price: Decimal | None = Field(default=None, ge=0)
    property_type: str | None = None
    room_type: str | None = None
    amenities: list[str] = []

    # --- geo (added 2026-08-22) --------------------------------------------------------------
    # `location` has been mapped as a geo_point and populated since the index was created, but
    # nothing ever queried it. These three turn "listings near this map view" into a real filter.
    #
    # lat/lon are only meaningful together, and `radius_km` is only meaningful with both — see
    # `SearchRequest.geo_point`, which is the single place that decides whether geo is active.
    lat: float | None = Field(default=None, ge=-90, le=90)
    lon: float | None = Field(default=None, ge=-180, le=180)
    # 50km ≈ a metro area. Capped because an uncapped radius is just a slower match_all.
    radius_km: float | None = Field(default=None, gt=0, le=500)

    # Elasticsearch's default `from + size` window is capped at 10,000 results. Past that you need
    # `search_after`; a demo never gets there, but the cap is why deep pagination is not free.
    page: int = Field(default=1, ge=1, le=100)
    page_size: int = Field(default=20, ge=1, le=100)
    sort: str = Field(default="relevance", pattern="^(relevance|price_asc|price_desc|rating|distance)$")

    @property
    def geo_point(self) -> dict[str, float] | None:
        """The origin for geo filtering and distance sorting, or None if geo is not in play.

        ⚠️ Half a coordinate is not a coordinate. A `lat` with no `lon` has to mean "no geo" rather
        than "assume the prime meridian" — Elasticsearch would happily accept `lon: 0` and return
        listings in the Gulf of Guinea for a search of Austin.
        """
        if self.lat is None or self.lon is None:
            return None
        return {"lat": self.lat, "lon": self.lon}


class SearchHit(ApiModel):
    public_id: UUID
    title: str
    city: str
    state: str | None = None
    country: str
    property_type: str
    room_type: str
    price_per_night: Decimal
    cleaning_fee: Decimal
    max_guests: int
    bedrooms: int
    beds: int
    bathrooms: Decimal
    rating_average: Decimal
    rating_count: int
    cover_image_url: str | None = None
    amenities: list[str] = []
    latitude: Decimal | None = None
    longitude: Decimal | None = None

    # --- per-hit search metadata (added 2026-08-22) ------------------------------------------
    # Everything above comes from `_source` — it is the listing. Everything below is the SEARCH's
    # opinion about this listing, and exists only inside a result set.
    score: float | None = Field(default=None, description="BM25 relevance score, null when sorting by a field")
    distance_km: float | None = Field(default=None, description="Distance from lat/lon, when supplied")
    highlights: dict[str, list[str]] = Field(
        default_factory=dict,
        description="Matched fragments per field, with the matched terms wrapped in <mark>",
    )


class FacetBucket(ApiModel):
    """One row of a filter panel: a value and how many listings would remain if you ticked it."""

    key: str
    count: int
    # Present on range facets only ("under $100"), so the UI can render the bounds it filters on.
    from_: Decimal | None = Field(default=None, alias="from")
    to: Decimal | None = None


class PriceStats(ApiModel):
    """What the price slider needs in order to draw itself over the right interval."""

    min: Decimal | None = None
    max: Decimal | None = None
    avg: Decimal | None = None


class Facets(ApiModel):
    """The counts behind the filter panel.

    See `queries.build_aggs` for the part that tutorials skip: each facet is counted with every
    filter applied EXCEPT its own, or ticking "Austin" collapses the city list to just Austin and
    the guest can never switch cities without clearing the filter first.
    """

    cities: list[FacetBucket] = []
    property_types: list[FacetBucket] = []
    room_types: list[FacetBucket] = []
    amenities: list[FacetBucket] = []
    price_ranges: list[FacetBucket] = []
    price: PriceStats | None = None


class SearchResponse(ApiModel):
    hits: list[SearchHit]
    total: int
    page: int
    page_size: int
    took_ms: int
    facets: Facets | None = None
