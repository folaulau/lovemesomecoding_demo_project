from datetime import date
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.orm import joinedload

from app.models.booking import Booking, Payment
from app.models.enums import BookingStatus
from app.repositories.base import BaseRepository


class BookingRepository(BaseRepository[Booking]):
    model = Booking

    def get_by_public_id_full(self, public_id: UUID) -> Booking | None:
        from app.models.property import Property

        stmt = (
            select(Booking)
            .options(
                # Chained joinedload: the booking's property AND that property's images, so a
                # confirmation page can show the cover photo without a second query.
                joinedload(Booking.property).joinedload(Property.images),
                joinedload(Booking.guest),
            )
            .where(Booking.public_id == public_id)
        )
        return self.db.execute(stmt).unique().scalar_one_or_none()

    def overlapping(
        self, property_id: int, check_in: date, check_out: date, *, exclude_id: int | None = None
    ) -> list[Booking]:
        """Live bookings that collide with this date range.

        The overlap test is `existing.check_in < new.check_out AND existing.check_out > new.check_in`.
        Both comparisons are STRICT, which is what makes the ranges half-open: a stay ending on the
        5th and one starting on the 5th do not overlap. Using `<=` here would reject every
        back-to-back booking — a bug that looks like "the calendar is wrong" rather than an
        off-by-one.

        This is the friendly check. `bookings_no_overlapping_bookings`, the EXCLUDE constraint in
        the migration, is the one that holds under concurrency.
        """
        conditions = [
            Booking.property_id == property_id,
            Booking.status.in_([s.value for s in BookingStatus.blocking()]),
            Booking.check_in < check_out,
            Booking.check_out > check_in,
        ]
        if exclude_id is not None:
            conditions.append(Booking.id != exclude_id)
        return list(self.db.execute(select(Booking).where(and_(*conditions))).scalars())

    def blocked_ranges(self, property_id: int, *, from_date: date) -> list[Booking]:
        """Everything occupying the calendar from today forward, for the date picker."""
        stmt = (
            select(Booking)
            .where(
                Booking.property_id == property_id,
                Booking.status.in_([s.value for s in BookingStatus.blocking()]),
                Booking.check_out > from_date,
            )
            .order_by(Booking.check_in)
        )
        return list(self.db.execute(stmt).scalars())

    def list_for_guest(self, guest_id: int) -> list[Booking]:
        stmt = (
            select(Booking)
            .options(joinedload(Booking.property))
            .where(Booking.guest_id == guest_id)
            .order_by(Booking.check_in.desc())
        )
        return list(self.db.execute(stmt).unique().scalars())

    def list_for_host(self, host_id: int) -> list[Booking]:
        """A host sees bookings across all their properties — note the join, not a second query."""
        from app.models.property import Property

        stmt = (
            select(Booking)
            .join(Property, Booking.property_id == Property.id)
            .options(joinedload(Booking.property), joinedload(Booking.guest))
            .where(Property.host_id == host_id)
            .order_by(Booking.check_in.desc())
        )
        return list(self.db.execute(stmt).unique().scalars())


class PaymentRepository(BaseRepository[Payment]):
    model = Payment

    def get_by_intent_id(self, intent_id: str) -> Payment | None:
        stmt = select(Payment).where(Payment.stripe_payment_intent_id == intent_id)
        return self.db.execute(stmt).scalar_one_or_none()

    def latest_for_booking(self, booking_id: int) -> Payment | None:
        """A booking can have several payment attempts; the newest is the one that counts."""
        stmt = (
            select(Payment)
            .where(Payment.booking_id == booking_id)
            .order_by(Payment.created_at.desc())
            .limit(1)
        )
        return self.db.execute(stmt).scalar_one_or_none()
