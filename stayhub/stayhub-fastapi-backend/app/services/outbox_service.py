"""Writing to the outbox, and draining it.

Two halves that never run in the same process:

- **`enqueue`** is called by a service, inside the business transaction, and does nothing but add
  a row. It must be cheap and it must not commit — see below.
- **`drain`** is called by the worker (`scripts/drain_outbox.py`), reads a batch, and runs each
  message's handler.

The interesting engineering is all in `claim`.
"""

import json
import logging
from datetime import UTC, datetime, timedelta
from typing import Callable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import OutboxStatus
from app.models.outbox import OutboxMessage

logger = logging.getLogger(__name__)

# Give up after this many tries and move the message to DEAD.
#
# A cap is not pessimism, it is the difference between a queue and a spin loop. A message with a
# malformed payload fails identically forever; without a cap the worker retries it every poll
# until someone notices, and meanwhile it is at the front of the queue delaying everything behind
# it. Eight attempts with the backoff below spans a bit over four minutes, which is long enough to
# ride out a provider blip and short enough to give up on a genuine bug.
MAX_ATTEMPTS = 8

# Exponential, capped. 2s, 4s, 8s ... 300s.
#
# ⚠️ The cap matters as much as the growth. Uncapped doubling reaches days by attempt 20, so a
# message that would have succeeded on the next retry sits for a week. And the growth itself is
# the point: retrying a struggling provider every second is how a limited outage becomes a total
# one, because the retries ARE the load.
BACKOFF_BASE_SECONDS = 2
BACKOFF_MAX_SECONDS = 300


def backoff_for(attempts: int) -> timedelta:
    """Seconds to wait before attempt number `attempts + 1`.

    Real systems add jitter here — a random fraction of the delay — because without it every
    message that failed during the same outage retries at the same instant, and the recovering
    service is hit by a thundering herd of its own making. It is left out here only so the tests
    can assert exact numbers; the comment is the more important half.
    """
    return timedelta(seconds=min(BACKOFF_BASE_SECONDS * (2 ** max(0, attempts - 1)), BACKOFF_MAX_SECONDS))


# --------------------------------------------------------------------------- producing


def enqueue(db: Session, topic: str, payload: dict) -> OutboxMessage:
    """Add a message to the outbox. **Does not commit — that is the entire point.**

    The caller's transaction owns this row. `booking_service.create` calls `enqueue` and then
    commits once, so the booking and the message land together or not at all. A `commit()` in here
    would open exactly the gap the outbox exists to close, and it would do it invisibly: the code
    would look correct and work perfectly until the first crash.

    This is the same rule the repositories follow — see `stayhub/CLAUDE.md`: only the caller knows
    where the transaction boundary is.

    ⚠️ `payload` must be JSON-serialisable. A `Decimal` price or a `date` will not serialise, and
    the failure surfaces at COMMIT — a long way from the line that caused it — so it is coerced
    here where the stack trace still points at the producer.
    """
    message = OutboxMessage(
        topic=topic,
        payload=json.loads(json.dumps(payload, default=str)),
        status=OutboxStatus.PENDING,
    )
    db.add(message)
    # flush, not commit: assigns the id so a caller can log it, without ending the transaction.
    db.flush()
    return message


# --------------------------------------------------------------------------- consuming


def claim(db: Session, limit: int = 20) -> list[OutboxMessage]:
    """Take up to `limit` messages, so that no other worker can take the same ones.

    ⚠️ `FOR UPDATE SKIP LOCKED` is what makes this table a queue rather than a table two workers
    fight over. It is worth understanding exactly what each half does.

    **`FOR UPDATE`** locks the selected rows for the transaction's duration. Without it, two
    workers polling at the same moment both read the same PENDING rows and both send the same
    email. At-least-once is a guarantee to design around; twice on *every single message* because
    two workers are running is just a bug.

    **`SKIP LOCKED`** is the half people leave off, and leaving it off is worse than it looks.
    Plain `FOR UPDATE` makes worker B *wait* for worker A's rows — so a second worker adds no
    throughput at all, it just queues behind the first, and if a handler is slow every other worker
    blocks on it. `SKIP LOCKED` tells Postgres to step over anything already locked and take the
    next free rows. Workers then scale linearly and never see each other.

    **`ORDER BY available_at`** processes oldest-ready-first — roughly FIFO. It is not a strict
    ordering guarantee and must not be relied on as one: with several workers, message 2 can finish
    before message 1. If two messages must be applied in order, they belong in one message.

    The lock is released when the caller's transaction ends. That is why `drain` commits after each
    message rather than at the end of the batch: an unhandled crash mid-batch then loses at most
    the message in flight, and everything already marked DONE stays DONE.
    """
    stmt = (
        select(OutboxMessage)
        .where(
            OutboxMessage.status == OutboxStatus.PENDING,
            OutboxMessage.available_at <= datetime.now(UTC),
        )
        .order_by(OutboxMessage.available_at)
        .limit(limit)
        .with_for_update(skip_locked=True)
    )
    return list(db.execute(stmt).scalars().all())


def mark_done(db: Session, message: OutboxMessage) -> None:
    message.status = OutboxStatus.DONE
    message.processed_at = datetime.now(UTC)
    message.last_error = None


def mark_failed(db: Session, message: OutboxMessage, error: str) -> None:
    """Schedule a retry, or give up.

    `attempts` is incremented BEFORE the decision so a message that has exhausted its attempts
    cannot be re-scheduled by an off-by-one.
    """
    message.attempts += 1
    # Truncated: a driver can raise an exception carrying an entire response body, and a megabyte
    # of HTML in a column nobody reads is a slow way to fill a disk.
    message.last_error = error[:2000]

    if message.attempts >= MAX_ATTEMPTS:
        message.status = OutboxStatus.DEAD
        message.processed_at = datetime.now(UTC)
        logger.error(
            "Outbox message %s (%s) is DEAD after %s attempts: %s",
            message.public_id,
            message.topic,
            message.attempts,
            error[:200],
        )
    else:
        message.available_at = datetime.now(UTC) + backoff_for(message.attempts)


# --------------------------------------------------------------------------- handlers

Handler = Callable[[Session, dict], None]

_HANDLERS: dict[str, Handler] = {}


def handles(topic: str) -> Callable[[Handler], Handler]:
    """Register a handler for a topic.

    A registry rather than an if/elif chain in `drain`, so adding a consumer is one decorator in
    the module that owns the work, and `drain` never learns what a booking is.
    """

    def decorator(fn: Handler) -> Handler:
        _HANDLERS[topic] = fn
        return fn

    return decorator


def handler_for(topic: str) -> Handler | None:
    return _HANDLERS.get(topic)


def registered_topics() -> list[str]:
    return sorted(_HANDLERS)


# --------------------------------------------------------------------------- the worker loop


def drain(db: Session, limit: int = 20) -> dict[str, int]:
    """Process one batch. Returns counts, so the worker can log something useful.

    Each message is committed on its own. Batching the commits would be fewer round trips and
    would mean one poisoned message rolls back the successful ones alongside it — which then
    re-sends every one of them on the next poll.
    """
    counts = {"done": 0, "failed": 0, "dead": 0, "unhandled": 0}

    for message in claim(db, limit):
        handler = handler_for(message.topic)

        if handler is None:
            # Not a failure to retry: no amount of waiting grows a handler. It is a deployment
            # problem — a producer shipped ahead of its consumer — so the message is left PENDING
            # and simply skipped, and it will be picked up when the consumer deploys.
            #
            # ⚠️ It is deliberately NOT marked DEAD. Marking it dead would make a five-minute
            # deploy skew permanently lose messages that were about to become deliverable.
            counts["unhandled"] += 1
            logger.warning(
                "No handler for outbox topic %r (known: %s) — leaving it pending",
                message.topic,
                ", ".join(registered_topics()) or "none",
            )
            db.commit()  # releases the row lock so the next poll can see it again
            continue

        try:
            handler(db, message.payload)
        except Exception as exc:  # noqa: BLE001 — a bad handler must not stop the queue
            mark_failed(db, message, f"{exc.__class__.__name__}: {exc}")
            counts["dead" if message.status == OutboxStatus.DEAD else "failed"] += 1
            logger.warning(
                "Outbox message %s (%s) failed on attempt %s: %s",
                message.public_id,
                message.topic,
                message.attempts,
                exc,
            )
        else:
            mark_done(db, message)
            counts["done"] += 1

        db.commit()

    return counts


def pending_count(db: Session) -> int:
    """For the health check and the admin page. A number that only goes up means the worker is
    dead, and that is worth an alert — a queue nobody is draining fails completely silently."""
    from sqlalchemy import func as sqlfunc

    return int(
        db.execute(
            select(sqlfunc.count(OutboxMessage.id)).where(
                OutboxMessage.status == OutboxStatus.PENDING
            )
        ).scalar_one()
    )


def dead_count(db: Session) -> int:
    from sqlalchemy import func as sqlfunc

    return int(
        db.execute(
            select(sqlfunc.count(OutboxMessage.id)).where(OutboxMessage.status == OutboxStatus.DEAD)
        ).scalar_one()
    )
