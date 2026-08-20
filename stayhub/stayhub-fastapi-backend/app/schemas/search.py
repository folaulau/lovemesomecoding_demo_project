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
    # Elasticsearch's default `from + size` window is capped at 10,000 results. Past that you need
    # `search_after`; a demo never gets there, but the cap is why deep pagination is not free.
    page: int = Field(default=1, ge=1, le=100)
    page_size: int = Field(default=20, ge=1, le=100)
    sort: str = Field(default="relevance", pattern="^(relevance|price_asc|price_desc|rating)$")


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


class SearchResponse(ApiModel):
    hits: list[SearchHit]
    total: int
    page: int
    page_size: int
    took_ms: int
