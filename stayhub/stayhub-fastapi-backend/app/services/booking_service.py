"""Booking: availability, creation, and the cancellation rule."""

import logging
from datetime import UTC, date, datetime, timedelta
from uuid import UUID

from psycopg import errors as pg_errors
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import (
    ApiException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
)
from app.models.booking import Booking
from app.models.enums import BookingStatus, PropertyStatus
from app.models.property import Property
from app.models.user import User
from app.repositories.booking_repository import BookingRepository
from app.repositories.property_repository import PropertyRepository
from app.schemas.booking import BookingCreateRequest, PriceBreakdown, QuoteRequest
from app.services import pricing_service
from app.services.cancellation_policy import cancellation_deadline, is_cancellable

logger = logging.getLogger(__name__)


class BookingService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.bookings = BookingRepository(db)
        self.properties = PropertyRepository(db)

    # ------------------------------------------------------------------ quoting

    def quote(self, req: QuoteRequest) -> tuple[Property, PriceBreakdown]:
        prop = self._bookable_property(req.property_id)
        self._validate_stay(prop, req.check_in, req.check_out, req.guests)
        return prop, pricing_service.quote(prop, req.check_in, req.check_out)

    def availability(self, property_id: UUID) -> tuple[Property, list[dict[str, date]]]:
        prop = self._bookable_property(property_id)
        today = datetime.now(UTC).date()
        blocked = self.bookings.blocked_ranges(prop.id, from_date=today)
        return prop, [{"from": b.check_in, "to": b.check_out} for b in blocked]

    # ------------------------------------------------------------------ writing

    def create(self, guest: User, req: BookingCreateRequest) -> Booking:
        prop = self._bookable_property(req.property_id)
        self._validate_stay(prop, req.check_in, req.check_out, req.guests)

        if prop.host_id == guest.id:
            raise ApiException("You cannot book your own listing.")

        # The friendly check. It loses the race; the constraint below wins it.
        if self.bookings.overlapping(prop.id, req.check_in, req.check_out):
            raise ConflictException("Those dates are no longer available.")

        breakdown = pricing_service.quote(prop, req.check_in, req.check_out)

        booking = Booking(
            property_id=prop.id,
            guest_id=guest.id,
            check_in=req.check_in,
            check_out=req.check_out,
            guests=req.guests,
            nights=breakdown.nights,
            nightly_rate=breakdown.nightly_rate,
            subtotal=breakdown.subtotal,
            cleaning_fee=breakdown.cleaning_fee,
            service_fee=breakdown.service_fee,
            total=breakdown.total,
            # PENDING holds the dates while the guest pays. Because PENDING is one of
            # BookingStatus.blocking(), the exclusion constraint stops anyone else booking the same
            # nights during checkout — the calendar equivalent of reserving stock in a cart.
            status=BookingStatus.PENDING,
        )

        try:
            self.bookings.add(booking)
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            # ⚠️ Two guests can pass the check above simultaneously — both queries run before
            # either INSERT lands. Postgres rejects the second one, and THAT is the real
            # protection. Translating it here is what turns a 500 into a 409 the UI can act on.
            if _is_overlap_violation(exc):
                raise ConflictException(
                    "Those dates were just booked by someone else."
                ) from exc
            raise

        self.db.refresh(booking)
        return booking

    def cancel(self, booking: Booking, actor: User, reason: str | None) -> Booking:
        # A guest may cancel their own booking; staff may cancel any. A host may not — cancelling
        # on a guest's behalf is a support action, not a hosting one.
        if booking.guest_id != actor.id and actor.role != "ADMIN":
            # 404, not 403. A 403 confirms the booking exists, which is a small information leak
            # on a guessable id.
            raise NotFoundException("Booking not found.")

        if booking.status == BookingStatus.CANCELLED:
            raise ApiException("This booking is already cancelled.")
        if booking.status == BookingStatus.COMPLETED:
            raise ApiException("A completed stay cannot be cancelled.")

        # ⚠️ Re-checked here even though the API also returns `isCancellable` for the UI. The
        # button being hidden is a courtesy; this is the rule. Anyone can POST to this endpoint.
        # Staff are exempt — refunds and disputes happen after the deadline by definition.
        if actor.role != "ADMIN" and not is_cancellable(booking.status, booking.check_in):
            deadline = cancellation_deadline(booking.check_in)
            raise ApiException(
                f"This booking can no longer be cancelled — the deadline was {deadline:%d %b %Y}, "
                f"{settings.cancellation_cutoff_days} days before check-in."
            )

        booking.status = BookingStatus.CANCELLED
        booking.cancelled_at = datetime.now(UTC)
        booking.cancellation_reason = reason
        self.db.commit()
        self.db.refresh(booking)
        # Cancelling frees the dates automatically: CANCELLED is not in BookingStatus.blocking(),
        # so both the availability query and the exclusion constraint stop seeing this row.
        return booking

    # ------------------------------------------------------------------ helpers

    def _bookable_property(self, public_id: UUID) -> Property:
        prop = self.properties.get_by_public_id_full(public_id)
        if prop is None or prop.deleted:
            raise NotFoundException("Listing not found.")
        if prop.status != PropertyStatus.PUBLISHED:
            raise ApiException("This listing is not accepting bookings.")
        return prop

    def _validate_stay(self, prop: Property, check_in: date, check_out: date, guests: int) -> None:
        today = datetime.now(UTC).date()
        if check_in < today:
            raise ApiException("Check-in cannot be in the past.")
        if check_out <= check_in:
            raise ApiException("Check-out must be after check-in.")
        if guests > prop.max_guests:
            raise ApiException(f"This place sleeps up to {prop.max_guests} guests.")
        if pricing_service.nights_between(check_in, check_out) > 365:
            raise ApiException("Stays are limited to 365 nights.")


def _is_overlap_violation(exc: IntegrityError) -> bool:
    """Was this IntegrityError our exclusion constraint, or something else entirely?

    ⚠️ Match on the constraint NAME, not on the message text. Postgres error strings are localised
    and change between versions; the name in the migration does not. Blindly treating every
    IntegrityError as "dates taken" would report a broken foreign key as a booking clash.
    """
    orig = getattr(exc, "orig", None)
    if isinstance(orig, pg_errors.ExclusionViolation):
        return True
    return "no_overlapping_bookings" in str(orig)
