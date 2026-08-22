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
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.session import SessionLocal
from app.models.booking import Booking
from app.services import outbox_service

logger = logging.getLogger(__name__)

OUTBOX = Path("notifications")


@contextmanager
def _session(existing: Session | None):
    """Use the caller's session if there is one, otherwise open and close our own.

    Two callers with genuinely different needs share these functions. A BackgroundTask runs after
    the request's session is closed and MUST open its own. An outbox handler runs inside the
    worker's transaction and must NOT — a second session would read outside the transaction
    holding the message's row lock, and would leave a connection per message.

    ⚠️ The `yield`/`finally` asymmetry is deliberate: a session we were HANDED is not ours to
    close. Closing a caller's session out from under it is the kind of bug that surfaces three
    frames away as "Instance is not bound to a Session".
    """
    if existing is not None:
        yield existing
        return
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def _deliver(to: str, subject: str, body: str) -> None:
    """Stand-in for a provider call. A real one is an HTTP request to SES/Postmark/SendGrid."""
    OUTBOX.mkdir(exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%S%f")
    path = OUTBOX / f"{stamp}-{to.replace('@', '_at_')}.json"
    path.write_text(
        json.dumps({"to": to, "subject": subject, "body": body}, indent=2), encoding="utf-8"
    )
    logger.info("Email queued for %s: %s", to, subject, extra={"recipient": to})


def send_booking_confirmation(booking_public_id: UUID, *, db: Session | None = None) -> None:
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
    # finished before this line ran. Unless a caller supplied one — see `_session`.
    with _session(db) as db:
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


def send_cancellation_notice(booking_public_id: UUID, *, db: Session | None = None) -> None:
    """Confirm a cancellation. Same rules as above — an id, and (usually) its own session."""
    with _session(db) as db:
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


# ---------------------------------------------------------------------------
# Outbox handlers
# ---------------------------------------------------------------------------
#
# The same two emails, reachable a second way: through the outbox instead of BackgroundTasks.
#
# Both routes exist ON PURPOSE, and the contrast is the lesson. `BackgroundTasks` sends the email
# before the worker would even poll — but loses it on a crash, a deploy, or a provider blip. The
# outbox is a second or two slower and cannot lose it. Which one a piece of work deserves is a
# judgement about what it costs to lose, and having both here makes that judgement concrete rather
# than theoretical.
#
# ⚠️ `_deliver` writes a file named by timestamp and recipient, so a redelivery produces a SECOND
# file rather than overwriting the first. That is the at-least-once cost made visible: run the
# worker twice on the same message and you can count the duplicates in `notifications/`. A real
# provider call would pass `message["idempotencyKey"]` — which is why the payload carries one.

TOPIC_BOOKING_CREATED = "booking.created"
TOPIC_BOOKING_CANCELLED = "booking.cancelled"


@outbox_service.handles(TOPIC_BOOKING_CREATED)
def _handle_booking_created(db, payload: dict) -> None:
    """⚠️ Uses the WORKER's session, passed in — it does not open one of its own.

    That is the opposite of `send_booking_confirmation` above, and both are right for their
    context. The BackgroundTask runs after the request's session is closed and must therefore make
    its own. The handler runs inside the worker's transaction, and opening a second session here
    would put the handler's reads outside the transaction that holds the message's row lock.
    """
    send_booking_confirmation(UUID(payload["bookingId"]), db=db)


@outbox_service.handles(TOPIC_BOOKING_CANCELLED)
def _handle_booking_cancelled(db, payload: dict) -> None:
    send_cancellation_notice(UUID(payload["bookingId"]), db=db)
