from uuid import UUID

from fastapi import APIRouter, status

from app.core.deps import CurrentUser, DbSession, HostUser
from app.core.exceptions import NotFoundException
from app.repositories.booking_repository import BookingRepository
from app.schemas.booking import (
    AvailabilityResponse,
    BookingCancelRequest,
    BookingCreateRequest,
    BookingResponse,
    PriceBreakdown,
    QuoteRequest,
)
from app.models.booking import Booking
from app.services.booking_service import BookingService

router = APIRouter(prefix="/bookings", tags=["bookings"])


def _to_response(booking: Booking) -> BookingResponse:
    """`isCancellable` and `cancellationDeadline` are computed fields on the DTO itself — see
    schemas/booking.py — so there is nothing to assemble here."""
    return BookingResponse.model_validate(booking)


@router.post("/quote", response_model=PriceBreakdown)
def quote(payload: QuoteRequest, db: DbSession) -> PriceBreakdown:
    """What would this stay cost? Creates nothing.

    Runs the same pricing code the booking runs, so a quote is always honoured.
    """
    _, breakdown = BookingService(db).quote(payload)
    return breakdown


@router.get("/availability/{property_id}", response_model=AvailabilityResponse)
def availability(property_id: UUID, db: DbSession) -> AvailabilityResponse:
    """Dates already taken, so the picker can grey them out before a guest commits."""
    prop, ranges = BookingService(db).availability(property_id)
    return AvailabilityResponse(
        property_id=prop.public_id, available=True, unavailable_ranges=ranges
    )


@router.post("", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
def create_booking(
    payload: BookingCreateRequest, user: CurrentUser, db: DbSession
) -> BookingResponse:
    """Hold the dates. The booking is PENDING until payment succeeds.

    ⚠️ The body carries no price. Every figure is computed server-side from the listing.
    """
    return _to_response(BookingService(db).create(user, payload))


@router.get("/mine", response_model=list[BookingResponse])
def my_bookings(user: CurrentUser, db: DbSession) -> list[BookingResponse]:
    return [_to_response(b) for b in BookingRepository(db).list_for_guest(user.id)]


@router.get("/hosting", response_model=list[BookingResponse])
def bookings_at_my_places(host: HostUser, db: DbSession) -> list[BookingResponse]:
    """Reservations across all of a host's listings — the /hosts/reservations page."""
    return [_to_response(b) for b in BookingRepository(db).list_for_host(host.id)]


@router.get("/{public_id}", response_model=BookingResponse)
def get_booking(public_id: UUID, user: CurrentUser, db: DbSession) -> BookingResponse:
    booking = BookingRepository(db).get_by_public_id_full(public_id)
    # ⚠️ 404 rather than 403 for someone else's booking. A 403 would confirm the id exists, which
    # on a guessable identifier is a slow enumeration of the whole table. Staff bypass this.
    if booking is None or (booking.guest_id != user.id and user.role != "ADMIN"):
        raise NotFoundException("Booking not found.")
    return _to_response(booking)


@router.post("/{public_id}/cancel", response_model=BookingResponse)
def cancel_booking(
    public_id: UUID, payload: BookingCancelRequest, user: CurrentUser, db: DbSession
) -> BookingResponse:
    """Cancel, subject to the 2-days-before-check-in rule.

    The rule is enforced here regardless of what the UI shows — a hidden button is a courtesy,
    not a permission.
    """
    booking = BookingRepository(db).get_by_public_id_full(public_id)
    if booking is None:
        raise NotFoundException("Booking not found.")
    return _to_response(BookingService(db).cancel(booking, user, payload.reason))
