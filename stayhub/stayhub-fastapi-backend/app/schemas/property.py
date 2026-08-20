from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import Field, field_validator

from app.models.enums import PropertyStatus, PropertyType, RoomType
from app.schemas.common import ApiModel


class PropertyImageInput(ApiModel):
    url: str = Field(max_length=500)
    alt_text: str | None = Field(default=None, max_length=255)
    is_cover: bool = False


class PropertyImageResponse(ApiModel):
    url: str
    alt_text: str | None = None
    sort_order: int
    is_cover: bool


class AmenityResponse(ApiModel):
    slug: str
    name: str
    icon: str | None = None


class PropertyCreateRequest(ApiModel):
    title: str = Field(min_length=5, max_length=200)
    description: str = Field(default="", max_length=5000)
    property_type: PropertyType = PropertyType.HOUSE
    room_type: RoomType = RoomType.ENTIRE_PLACE

    address_line1: str = Field(default="", max_length=255)
    city: str = Field(min_length=1, max_length=120)
    state: str | None = Field(default=None, max_length=120)
    country: str = Field(default="United States", max_length=120)
    postal_code: str | None = Field(default=None, max_length=20)
    latitude: Decimal | None = None
    longitude: Decimal | None = None

    price_per_night: Decimal = Field(gt=0, le=Decimal("100000"))
    cleaning_fee: Decimal = Field(default=Decimal("0"), ge=0, le=Decimal("100000"))

    max_guests: int = Field(default=2, ge=1, le=50)
    bedrooms: int = Field(default=1, ge=0, le=50)
    beds: int = Field(default=1, ge=0, le=50)
    bathrooms: Decimal = Field(default=Decimal("1"), ge=0, le=Decimal("50"))

    amenity_slugs: list[str] = []
    images: list[PropertyImageInput] = []

    @field_validator("price_per_night", "cleaning_fee")
    @classmethod
    def two_decimal_places(cls, v: Decimal) -> Decimal:
        # Quantize at the edge so a client sending 129.999 cannot create a listing whose price
        # renders as $130.00 but sums as something else.
        return v.quantize(Decimal("0.01"))


class PropertyUpdateRequest(ApiModel):
    """Every field optional — this is a PATCH, and `None` means "leave it alone".

    That is also why status is not here: publishing is a transition with rules, not a field
    assignment. It gets its own endpoint.
    """

    title: str | None = Field(default=None, min_length=5, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    property_type: PropertyType | None = None
    room_type: RoomType | None = None
    address_line1: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, min_length=1, max_length=120)
    state: str | None = Field(default=None, max_length=120)
    country: str | None = Field(default=None, max_length=120)
    postal_code: str | None = Field(default=None, max_length=20)
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    price_per_night: Decimal | None = Field(default=None, gt=0, le=Decimal("100000"))
    cleaning_fee: Decimal | None = Field(default=None, ge=0, le=Decimal("100000"))
    max_guests: int | None = Field(default=None, ge=1, le=50)
    bedrooms: int | None = Field(default=None, ge=0, le=50)
    beds: int | None = Field(default=None, ge=0, le=50)
    bathrooms: Decimal | None = Field(default=None, ge=0, le=Decimal("50"))
    amenity_slugs: list[str] | None = None
    images: list[PropertyImageInput] | None = None


class PropertyHostResponse(ApiModel):
    """The slice of a host a guest is allowed to see. Note the absence of `email`."""

    public_id: UUID
    first_name: str
    avatar_url: str | None = None
    host_bio: str | None = None


class PropertyResponse(ApiModel):
    public_id: UUID
    title: str
    description: str
    property_type: str
    room_type: str
    status: PropertyStatus

    city: str
    state: str | None = None
    country: str
    # `address_line1` is deliberately omitted. Airbnb shows the exact address only after booking;
    # publishing it on a listing page tells the internet which houses are empty next week.
    latitude: Decimal | None = None
    longitude: Decimal | None = None

    price_per_night: Decimal
    cleaning_fee: Decimal
    max_guests: int
    bedrooms: int
    beds: int
    bathrooms: Decimal
    rating_average: Decimal
    rating_count: int

    images: list[PropertyImageResponse] = []
    amenities: list[AmenityResponse] = []
    host: PropertyHostResponse | None = None
    created_at: datetime
