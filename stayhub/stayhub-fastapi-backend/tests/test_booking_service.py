"""Booking rules against the real database — availability, and the exclusion constraint."""

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError

from app.core.exceptions import ApiException, ConflictException
from app.models.booking import Booking
from app.models.enums import BookingStatus, PropertyStatus, UserRole
from app.models.property import Property
from app.models.user import User
from app.schemas.booking import BookingCreateRequest
from app.services.booking_service import BookingService

TODAY = datetime.now(UTC).date()


@pytest.fixture
def host(db) -> User:
    user = User(
        email=f"host-{datetime.now(UTC).timestamp()}@stayhub.test",
        password_hash="x", first_name="Test", last_name="Host",
        role=UserRole.CUSTOMER, is_host=True,
    )
    db.add(user)
    db.flush()
    return user


@pytest.fixture
def guest(db) -> User:
    user = User(
        email=f"guest-{datetime.now(UTC).timestamp()}@stayhub.test",
        password_hash="x", first_name="Test", last_name="Guest",
        role=UserRole.CUSTOMER, is_host=False,
    )
    db.add(user)
    db.flush()
    return user


@pytest.fixture
def listing(db, host) -> Property:
    prop = Property(
        host_id=host.id, title="Test Listing", description="A place for tests.",
        city="Testville", country="United States",
        price_per_night=Decimal("100.00"), cleaning_fee=Decimal("25.00"),
        max_guests=4, status=PropertyStatus.PUBLISHED,
    )
    db.add(prop)
    db.flush()
    return prop


def book(db, listing, guest, start_offset: int, nights: int, status=BookingStatus.CONFIRMED):
    check_in = TODAY + timedelta(days=start_offset)
    check_out = check_in + timedelta(days=nights)
    booking = Booking(
        property_id=listing.id, guest_id=guest.id,
        check_in=check_in, check_out=check_out, guests=2,
        nights=nights, nightly_rate=Decimal("100.00"), subtotal=Decimal(100 * nights),
        cleaning_fee=Decimal("25.00"), service_fee=Decimal("0.00"),
        total=Decimal(100 * nights + 25), status=status,
    )
    db.add(booking)
    db.flush()
    return booking


class TestTheExclusionConstraint:
    """⚠️ These test POSTGRES, not the service. The service's availability check loses the race
    when two guests submit simultaneously; the constraint is what actually holds."""

    def test_an_overlapping_booking_is_impossible_to_insert(self, db, listing, guest):
        book(db, listing, guest, start_offset=30, nights=3)  # days 30–33

        with pytest.raises(IntegrityError) as exc_info:
            book(db, listing, guest, start_offset=31, nights=3)  # days 31–34, overlaps
            db.flush()

        assert "no_overlapping_bookings" in str(exc_info.value.orig)

    def test_back_to_back_stays_are_allowed(self, db, listing, guest):
        """⚠️ The half-open `[)` bound. One guest checking out on day 33 and another checking in
        on day 33 do NOT overlap. Closed ranges would reject every back-to-back booking."""
        book(db, listing, guest, start_offset=40, nights=3)   # 40–43
        book(db, listing, guest, start_offset=43, nights=2)   # 43–45
        db.flush()  # no exception == the point of the test

    def test_a_cancelled_booking_frees_its_dates(self, db, listing, guest):
        """CANCELLED is not in BookingStatus.blocking(), so the constraint's WHERE clause
        stops seeing the row."""
        first = book(db, listing, guest, start_offset=50, nights=3)
        first.status = BookingStatus.CANCELLED
        db.flush()

        book(db, listing, guest, start_offset=50, nights=3)
        db.flush()

    def test_a_pending_booking_still_blocks(self, db, listing, guest):
        """PENDING holds the dates while the guest pays — the calendar equivalent of reserving
        stock in a cart. Otherwise two people can pay for the same nights."""
        book(db, listing, guest, start_offset=60, nights=3, status=BookingStatus.PENDING)

        with pytest.raises(IntegrityError):
            book(db, listing, guest, start_offset=61, nights=1)
            db.flush()

    def test_the_same_dates_at_a_DIFFERENT_listing_are_fine(self, db, listing, host, guest):
        other = Property(
            host_id=host.id, title="Another Listing", description="Also for tests.",
            city="Testville", country="United States",
            price_per_night=Decimal("90.00"), max_guests=2, status=PropertyStatus.PUBLISHED,
        )
        db.add(other)
        db.flush()

        book(db, listing, guest, start_offset=70, nights=2)
        book(db, other, guest, start_offset=70, nights=2)
        db.flush()

    def test_checkout_before_checkin_is_rejected_by_the_database(self, db, listing, guest):
        bad = Booking(
            property_id=listing.id, guest_id=guest.id,
            check_in=TODAY + timedelta(days=90), check_out=TODAY + timedelta(days=88),
            guests=1, nights=1, nightly_rate=Decimal("100"), subtotal=Decimal("100"),
            cleaning_fee=Decimal("0"), service_fee=Decimal("0"), total=Decimal("100"),
            status=BookingStatus.PENDING,
        )
        db.add(bad)
        with pytest.raises(IntegrityError) as exc_info:
            db.flush()
        assert "checkout_after_checkin" in str(exc_info.value.orig)


class TestBookingService:
    def test_a_clash_becomes_a_409_not_a_500(self, db, listing, guest):
        book(db, listing, guest, start_offset=100, nights=3)
        db.commit()

        service = BookingService(db)
        request = BookingCreateRequest(
            property_id=listing.public_id,
            check_in=TODAY + timedelta(days=101),
            check_out=TODAY + timedelta(days=103),
            guests=2,
        )
        with pytest.raises(ConflictException):
            service.create(guest, request)

    def test_a_host_cannot_book_their_own_listing(self, db, listing, host):
        db.commit()
        service = BookingService(db)
        request = BookingCreateRequest(
            property_id=listing.public_id,
            check_in=TODAY + timedelta(days=200),
            check_out=TODAY + timedelta(days=202),
            guests=2,
        )
        with pytest.raises(ApiException, match="your own listing"):
            service.create(host, request)

    def test_over_capacity_is_refused(self, db, listing, guest):
        db.commit()
        service = BookingService(db)
        request = BookingCreateRequest(
            property_id=listing.public_id,
            check_in=TODAY + timedelta(days=210),
            check_out=TODAY + timedelta(days=212),
            guests=40,  # the listing sleeps 4
        )
        with pytest.raises(ApiException, match="sleeps up to 4"):
            service.create(guest, request)

    def test_a_past_check_in_is_refused(self, db, listing, guest):
        db.commit()
        service = BookingService(db)
        request = BookingCreateRequest(
            property_id=listing.public_id,
            check_in=TODAY - timedelta(days=5),
            check_out=TODAY + timedelta(days=1),
            guests=2,
        )
        with pytest.raises(ApiException, match="past"):
            service.create(guest, request)

    def test_a_draft_listing_cannot_be_booked(self, db, listing, guest):
        listing.status = PropertyStatus.DRAFT
        db.commit()
        service = BookingService(db)
        request = BookingCreateRequest(
            property_id=listing.public_id,
            check_in=TODAY + timedelta(days=220),
            check_out=TODAY + timedelta(days=222),
            guests=2,
        )
        with pytest.raises(ApiException, match="not accepting bookings"):
            service.create(guest, request)

    def test_the_server_computes_the_price_itself(self, db, listing, guest):
        """The request carries dates and a guest count — never an amount."""
        db.commit()
        service = BookingService(db)
        request = BookingCreateRequest(
            property_id=listing.public_id,
            check_in=TODAY + timedelta(days=230),
            check_out=TODAY + timedelta(days=233),
            guests=2,
        )
        booking = service.create(guest, request)

        assert booking.nights == 3
        assert booking.subtotal == Decimal("300.00")
        assert booking.cleaning_fee == Decimal("25.00")
        assert booking.service_fee == Decimal("36.00")
        assert booking.total == Decimal("361.00")
        # PENDING, not CONFIRMED — the dates are held while the guest pays.
        assert booking.status == BookingStatus.PENDING


class TestCancellation:
    def test_a_guest_can_cancel_a_far_out_booking(self, db, listing, guest):
        booking = book(db, listing, guest, start_offset=300, nights=2)
        db.commit()

        cancelled = BookingService(db).cancel(booking, guest, "changed my mind")
        assert cancelled.status == BookingStatus.CANCELLED
        assert cancelled.cancelled_at is not None
        assert cancelled.cancellation_reason == "changed my mind"

    def test_cancelling_inside_the_window_is_refused(self, db, listing, guest):
        booking = book(db, listing, guest, start_offset=1, nights=2)  # check-in tomorrow
        db.commit()

        with pytest.raises(ApiException, match="no longer be cancelled"):
            BookingService(db).cancel(booking, guest, None)

    def test_someone_elses_booking_is_a_404(self, db, listing, guest, host):
        """⚠️ 404, not 403. A 403 confirms the booking exists, which on a guessable id is a slow
        enumeration of the whole table."""
        from app.core.exceptions import NotFoundException

        booking = book(db, listing, guest, start_offset=310, nights=2)
        db.commit()

        with pytest.raises(NotFoundException):
            BookingService(db).cancel(booking, host, None)

    def test_staff_may_cancel_past_the_deadline(self, db, listing, guest):
        """Refunds and disputes happen after the deadline by definition."""
        staff = User(
            email=f"staff-{datetime.now(UTC).timestamp()}@stayhub.test",
            password_hash="x", first_name="Staff", last_name="Member",
            role=UserRole.ADMIN, is_host=False,
        )
        db.add(staff)
        db.flush()

        booking = book(db, listing, guest, start_offset=1, nights=2)
        db.commit()

        cancelled = BookingService(db).cancel(booking, staff, "support request")
        assert cancelled.status == BookingStatus.CANCELLED

    def test_cancelling_twice_is_refused(self, db, listing, guest):
        booking = book(db, listing, guest, start_offset=320, nights=2)
        db.commit()

        service = BookingService(db)
        service.cancel(booking, guest, None)
        with pytest.raises(ApiException, match="already cancelled"):
            service.cancel(booking, guest, None)
