from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import Field, model_validator

from app.models.enums import BookingStatus
from app.schemas.common import ApiModel


class QuoteRequest(ApiModel):
    """Ask what a stay would cost, without creating anything.

    The booking form calls this on every date change so the price breakdown updates live. It runs
    the SAME pricing code the real booking runs, which is the point — a quote a guest cannot then
    book at is worse than no quote.
    """

    property_id: UUID
    check_in: date
    check_out: date
    guests: int = Field(default=1, ge=1, le=50)

    @model_validator(mode="after")
    def check_dates(self) -> "QuoteRequest":
        if self.check_out <= self.check_in:
            raise ValueError("Check-out must be after check-in.")
        return self


class BookingCreateRequest(QuoteRequest):
    """Same fields as a quote — deliberately. The client never sends a price.

    ⚠️ There is no `total` here and there never should be. The server recomputes every figure;
    a client-sent price is an invitation to book a $400 stay for $4.
    """


class PriceBreakdown(ApiModel):
    nights: int
    nightly_rate: Decimal
    subtotal: Decimal
    cleaning_fee: Decimal
    service_fee: Decimal
    total: Decimal


class BookingPropertyResponse(ApiModel):
    public_id: UUID
    title: str
    city: str
    country: str
    cover_image_url: str | None = None


class BookingResponse(ApiModel):
    public_id: UUID
    status: BookingStatus
    check_in: date
    check_out: date
    guests: int

    nights: int
    nightly_rate: Decimal
    subtotal: Decimal
    cleaning_fee: Decimal
    service_fee: Decimal
    total: Decimal

    # Computed, not stored: the answer changes every midnight, so a stored copy is wrong by
    # definition. The frontend uses it to decide whether to render the Cancel button — but the
    # server checks the rule again on cancel, because a button is not a permission.
    is_cancellable: bool
    cancellation_deadline: date

    cancelled_at: datetime | None = None
    cancellation_reason: str | None = None
    property: BookingPropertyResponse | None = None
    created_at: datetime


class BookingCancelRequest(ApiModel):
    reason: str | None = Field(default=None, max_length=500)


class AvailabilityResponse(ApiModel):
    property_id: UUID
    available: bool
    # The dates already taken, so the date picker can grey them out rather than letting a guest
    # pick a range and only then be told no.
    unavailable_ranges: list[dict[str, date]] = []
