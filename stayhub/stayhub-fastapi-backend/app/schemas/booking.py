from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import Field, computed_field, model_validator

from app.models.enums import BookingStatus
from app.schemas.common import ApiModel
from app.services.cancellation_policy import cancellation_deadline, is_cancellable

# ⚠️ `BookingResponse` has a field called `property`, and a class body is one namespace: the
# moment that annotation is assigned, the name `property` inside the class refers to the field,
# not to the builtin decorator. A `@property` written after it fails with
# "TypeError: 'NoneType' object is not callable" — which points at the decorator line and says
# nothing about the field twenty lines above that caused it.
#
# Capturing the builtin here under another name sidesteps it without renaming a field that the
# domain genuinely calls "property".
builtin_property = property


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

    cancelled_at: datetime | None = None
    cancellation_reason: str | None = None
    property: BookingPropertyResponse | None = None
    created_at: datetime

    # ⚠️ COMPUTED, not stored. The answer changes at every midnight, so a stored copy is wrong
    # within a day of being written.
    #
    # `@computed_field` is pydantic v2's way to add a derived value to the OUTPUT without making
    # it an input — it appears in the JSON and in the OpenAPI schema, but nothing can send it.
    # The alternative, passing the values in at construction, meant every call site had to
    # remember to; this way the rule travels with the DTO.
    #
    # The frontend uses these to decide whether to render a Cancel button. The server checks the
    # same rule again on cancel, because a hidden button is a courtesy, not a permission.

    @computed_field
    @builtin_property
    def cancellation_deadline(self) -> date:
        return cancellation_deadline(self.check_in)

    @computed_field
    @builtin_property
    def is_cancellable(self) -> bool:
        return is_cancellable(self.status, self.check_in)


class BookingCancelRequest(ApiModel):
    reason: str | None = Field(default=None, max_length=500)


class AvailabilityResponse(ApiModel):
    property_id: UUID
    available: bool
    # The dates already taken, so the date picker can grey them out rather than letting a guest
    # pick a range and only then be told no.
    unavailable_ranges: list[dict[str, date]] = []
