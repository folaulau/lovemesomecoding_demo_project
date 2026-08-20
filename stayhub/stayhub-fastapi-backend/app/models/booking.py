from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    literal_column,
)
from sqlalchemy.dialects.postgresql import ExcludeConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, PublicIdMixin, TimestampMixin
from app.models.enums import BookingStatus, PaymentStatus

if TYPE_CHECKING:
    from app.models.property import Property
    from app.models.user import User


class Booking(Base, PublicIdMixin, TimestampMixin):
    """A stay. Dates are half-open: check_in is included, check_out is not.

    That `[)` convention is why a one-night stay is `2026-09-01 → 2026-09-02` and why one guest's
    check-out day can be another's check-in day without the two overlapping.
    """

    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(
        ForeignKey("properties.id"), nullable=False, index=True
    )
    guest_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    check_in: Mapped[date] = mapped_column(Date, nullable=False)
    check_out: Mapped[date] = mapped_column(Date, nullable=False)
    guests: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Every figure is frozen at booking time. A host raising their nightly rate next week must not
    # change what a guest already agreed to pay, so none of this is recomputed from `properties`.
    nights: Mapped[int] = mapped_column(Integer, nullable=False)
    nightly_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    cleaning_fee: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"), nullable=False)
    service_fee: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"), nullable=False)
    total: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    status: Mapped[str] = mapped_column(
        String(20), default=BookingStatus.PENDING, nullable=False, index=True
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancellation_reason: Mapped[str | None] = mapped_column(String(500))

    property: Mapped["Property"] = relationship(back_populates="bookings")
    guest: Mapped["User"] = relationship(back_populates="bookings")
    payments: Mapped[list["Payment"]] = relationship(back_populates="booking")

    __table_args__ = (
        Index("ix_bookings_property_dates", "property_id", "check_in", "check_out"),
        # ⚠️ THE constraint that makes double-booking impossible (decision D6).
        #
        # `EXCLUDE USING gist` is Postgres saying "no two rows may both match these operators".
        # Here: same property_id (=) AND overlapping date ranges (&&), but only among statuses
        # that actually occupy the calendar — a cancelled booking must not block its old dates.
        #
        # The service checks availability first so the guest gets a readable message. THIS is what
        # holds when two guests submit the same dates in the same millisecond and both checks pass.
        # A check without a constraint is a race; a constraint without a check is a 500.
        #
        # `'[)'` is the half-open bound: check-out day is excluded, so one guest leaving on the 5th
        # does not collide with another arriving on the 5th. Get this wrong and every back-to-back
        # booking in the system is rejected.
        #
        # Needs the `btree_gist` extension — GiST alone has no `=` operator for a plain integer
        # column, only the range operators. The first migration creates it.
        ExcludeConstraint(
            (literal_column("property_id"), "="),
            (literal_column("daterange(check_in, check_out, '[)')"), "&&"),
            where=literal_column(
                "status IN ('PENDING', 'CONFIRMED', 'COMPLETED')"
            ),
            using="gist",
            name="no_overlapping_bookings",
        ),
        CheckConstraint("check_out > check_in", name="checkout_after_checkin"),
        {"comment": "A stay booked by a guest at a property"},
    )


class Payment(Base, PublicIdMixin, TimestampMixin):
    """A Stripe PaymentIntent, mirrored locally.

    ⚠️ Card numbers, CVCs and cardholder names are NEVER stored — only Stripe's opaque id plus
    display metadata. If a `card_number` column ever appears here, something has gone badly wrong.
    """

    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), nullable=False, index=True)

    stripe_payment_intent_id: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="usd", nullable=False)
    status: Mapped[str] = mapped_column(
        String(30), default=PaymentStatus.REQUIRES_PAYMENT, nullable=False
    )

    card_brand: Mapped[str | None] = mapped_column(String(30))
    card_last4: Mapped[str | None] = mapped_column(String(4))
    failure_message: Mapped[str | None] = mapped_column(String(500))

    booking: Mapped["Booking"] = relationship(back_populates="payments")


class Review(Base, PublicIdMixin, TimestampMixin):
    """One review per completed booking — which is what makes ratings trustworthy: you cannot
    review a place you never stayed at."""

    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(
        ForeignKey("bookings.id"), unique=True, nullable=False
    )
    property_id: Mapped[int] = mapped_column(
        ForeignKey("properties.id"), nullable=False, index=True
    )
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[str | None] = mapped_column(String(2000))

    __table_args__ = (
        # The application validates this too, with a friendlier message. Both exist because the
        # application is not the only thing that will ever write to this table.
        CheckConstraint("rating BETWEEN 1 AND 5", name="rating_in_range"),
    )
