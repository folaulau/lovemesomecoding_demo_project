"""Guest emails, sent off the request path with BackgroundTasks.

There is no SMTP server in this demo, so "sending" writes a file into `notifications/` and logs a
line. Everything around that — when it runs, what it is allowed to touch, what happens when it
fails — is exactly what a real provider call would need, which is the part worth copying.

WHAT BackgroundTasks ACTUALLY IS
--------------------------------
Starlette runs these after the response has been sent, in the same process and the same event
loop. That is the whole feature. It buys you one thing: the guest is not kept waiting while an
email provider takes 400ms.

It is NOT a job queue, and the difference is not academic:

  * no retry           — a provider blip loses the email
  * no persistence     — a deploy or a crash mid-task loses it too
  * no back-pressure   — a burst of requests is a burst of concurrent tasks
  * no visibility      — nothing anywhere records that it was meant to happen

So the rule is: BackgroundTasks for work that is genuinely nice-to-have, Celery/RQ/SQS for work
that MUST happen. A booking confirmation email is borderline and lives here because this is a
demo; the money-side equivalent — the Stripe webhook that confirms the booking — deliberately
does not, and is a real HTTP callback instead.
"""

import json
import logging
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import SessionLocal
from app.models.booking import Booking

logger = logging.getLogger(__name__)

OUTBOX = Path("notifications")


def _deliver(to: str, subject: str, body: str) -> None:
    """Stand-in for a provider call. A real one is an HTTP request to SES/Postmark/SendGrid."""
    OUTBOX.mkdir(exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%S%f")
    path = OUTBOX / f"{stamp}-{to.replace('@', '_at_')}.json"
    path.write_text(
        json.dumps({"to": to, "subject": subject, "body": body}, indent=2), encoding="utf-8"
    )
    logger.info("Email queued for %s: %s", to, subject, extra={"recipient": to})


def send_booking_confirmation(booking_public_id: UUID) -> None:
    """Tell the guest their dates are held.

    ⚠️ THE SIGNATURE IS THE LESSON. This takes a UUID — a plain value — and NOT the `Booking`
    object the route already had in its hand. Passing the ORM object is the obvious thing to do
    and it is wrong.

    A dependency with `yield` runs its cleanup BEFORE background tasks run. Measured on
    2026-08-21, FastAPI 0.115.5:

        1. dep: open
        2. route body
        3. dep: CLOSED      <-- get_db's `finally: db.close()`
        4. background task ran

    So by the time this function runs, the request's session is closed and any object loaded from
    it is detached. What makes that genuinely dangerous is that it half-works:

        booking.total          -> OK, Decimal('797.40')   (expire_on_commit=False keeps it)
        booking.property.title -> DetachedInstanceError

    A loaded column survives; the first unvisited relationship raises. So the version that passes
    the object works in a test that checks the total, and fails in production the day someone adds
    the property name to the email — after the response has already gone out with a 200, where
    nobody is looking.

    Taking an id and opening a fresh session removes the whole category.
    """
    # A session of its own, closed by the `with`. It does NOT belong to the request; the request
    # finished before this line ran.
    with SessionLocal() as db:
        booking = db.execute(
            select(Booking)
            .where(Booking.public_id == booking_public_id)
            # Loaded up front, in one query, precisely because there is no session to lazy-load
            # from later — and because the alternative is three more round trips per email.
            .options(selectinload(Booking.property), selectinload(Booking.guest))
        ).scalar_one_or_none()

        if booking is None:
            # Not an error worth raising. The booking can legitimately be gone by now, and there
            # is nobody left to return a 404 to — the response was sent long ago.
            logger.warning("Booking %s vanished before its email was sent", booking_public_id)
            return

        _deliver(
            to=booking.guest.email,
            subject=f"Your stay at {booking.property.title} is held",
            body=(
                f"Hi {booking.guest.first_name},\n\n"
                f"We are holding {booking.property.title} in {booking.property.city} "
                f"from {booking.check_in:%d %b %Y} to {booking.check_out:%d %b %Y} "
                f"({booking.nights} nights, {booking.guests} guests).\n\n"
                f"Total: ${booking.total}\n"
                f"This booking is {booking.status} until payment completes.\n"
            ),
        )


def send_cancellation_notice(booking_public_id: UUID) -> None:
    """Confirm a cancellation. Same rules as above — an id, and its own session."""
    with SessionLocal() as db:
        booking = db.execute(
            select(Booking)
            .where(Booking.public_id == booking_public_id)
            .options(selectinload(Booking.property), selectinload(Booking.guest))
        ).scalar_one_or_none()

        if booking is None:
            logger.warning("Booking %s vanished before its cancellation email", booking_public_id)
            return

        _deliver(
            to=booking.guest.email,
            subject=f"Cancelled: {booking.property.title}",
            body=(
                f"Hi {booking.guest.first_name},\n\n"
                f"Your stay at {booking.property.title} on {booking.check_in:%d %b %Y} "
                f"has been cancelled.\n"
            ),
        )
