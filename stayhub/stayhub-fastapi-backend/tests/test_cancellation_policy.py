"""The README's rule: cancel "all the way up to 2 days before start date"."""

from datetime import date, timedelta

import pytest

from app.models.enums import BookingStatus
from app.services.cancellation_policy import cancellation_deadline, is_cancellable


def test_deadline_is_two_days_before_check_in():
    assert cancellation_deadline(date(2026, 9, 10)) == date(2026, 9, 8)


def test_deadline_crosses_a_month_boundary():
    assert cancellation_deadline(date(2026, 10, 1)) == date(2026, 9, 29)


@pytest.mark.parametrize(
    "days_until_check_in,expected",
    [
        (30, True),
        (3, True),
        (2, True),    # ⚠️ the boundary: check-in in 2 days means TODAY is the deadline day,
                      # and the deadline day itself still counts.
        (1, False),   # inside the window
        (0, False),   # check-in is today
        (-1, False),  # already started
    ],
)
def test_the_two_day_cutoff(days_until_check_in, expected):
    today = date(2026, 9, 1)
    check_in = today + timedelta(days=days_until_check_in)
    assert is_cancellable(BookingStatus.CONFIRMED, check_in, today=today) is expected


@pytest.mark.parametrize(
    "status,expected",
    [
        (BookingStatus.PENDING, True),
        (BookingStatus.CONFIRMED, True),
        (BookingStatus.CANCELLED, False),   # already cancelled
        (BookingStatus.COMPLETED, False),   # the stay happened
    ],
)
def test_only_live_bookings_can_be_cancelled(status, expected):
    today = date(2026, 9, 1)
    assert is_cancellable(status, date(2026, 12, 1), today=today) is expected


def test_a_pending_booking_far_out_is_cancellable():
    """PENDING holds the dates while the guest pays; abandoning checkout must free them."""
    assert is_cancellable(BookingStatus.PENDING, date(2027, 1, 1), today=date(2026, 9, 1))
