"""The cancellation rule, in one place with no dependencies.

It lives on its own because BOTH the schema layer and the service layer need it, and if it lived
in `booking_service` the schema would have to import the service that imports the schema — a
circular import. A rule with no dependencies can be imported by anything.
"""

from datetime import UTC, date, datetime, timedelta

from app.core.config import settings
from app.models.enums import BookingStatus


def cancellation_deadline(check_in: date) -> date:
    """The last day a guest may cancel — the README's "up to 2 days before start date".

    A date, not a timestamp, deliberately. "Two days before check-in" is a calendar fact; making
    it an instant would give a guest in Auckland and one in Los Angeles different deadlines for
    the same stay.
    """
    return check_in - timedelta(days=settings.cancellation_cutoff_days)


def is_cancellable(status: str, check_in: date, *, today: date | None = None) -> bool:
    today = today or datetime.now(UTC).date()
    if status not in (BookingStatus.PENDING, BookingStatus.CONFIRMED):
        return False
    # `<=` — the deadline day itself still counts. Check-in on the 10th means the deadline is the
    # 8th, and cancelling ON the 8th is allowed.
    return today <= cancellation_deadline(check_in)
