"""The transactional outbox: a queue that shares the database's transaction.

The problem it solves is one line long, and almost every service has it somewhere:

    self.db.commit()                       # the booking is now real
    send_confirmation_email(booking)       # ...and this line never runs

Between those two statements the process can be deployed over, OOM-killed, or lose its network.
The booking exists and the email does not, and nothing anywhere records that it was supposed to.
`app/services/notification_service.py` says exactly this about `BackgroundTasks`, and this table is
the answer to it.

Reversing the order is not a fix — it is a worse bug. Send first and a transaction that then rolls
back has emailed a guest about a booking that does not exist.

The dual-write problem is that two systems (Postgres and an email provider, or Postgres and
Elasticsearch) cannot be updated atomically. You cannot commit to both. What you CAN do is make
the *intent* to update the second system part of the first system's transaction:

    BEGIN
      INSERT INTO bookings  ...        -- the business change
      INSERT INTO outbox    ...        -- "and an email needs sending"
    COMMIT                             -- both, or neither

Now there is no gap. If the commit succeeds, the row saying "send this" is durable. If it rolls
back, the intent vanishes with the booking. A separate worker reads the table and does the work,
retrying until it succeeds.

**What this buys, that BackgroundTasks does not:** the message survives a crash, a deploy and a
restart; a failure is retried with backoff instead of lost; a message that can never succeed ends
up in `DEAD` where somebody can see it; and there is a durable record that the work was owed.

**What it costs, and it is not free:** delivery is now *at-least-once*, never exactly-once. The
worker can hand a message to the provider and die before marking it DONE, and the next worker will
send it again. Every handler must therefore be idempotent — sending the same email twice must be
harmless, and indexing the same document twice must produce the same document. That constraint is
not a wart of this design; it is what "reliable messaging" always means, and a system that pretends
otherwise has simply not found its duplicate yet.

Also: latency. A queued email goes out when the worker next polls, not in the same millisecond.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin
from app.models.enums import OutboxStatus


class OutboxMessage(Base, TimestampMixin):
    __tablename__ = "outbox"

    id: Mapped[int] = mapped_column(primary_key=True)

    # Every other table in StayHub carries `public_id` via PublicIdMixin because the API exposes
    # it. This one gets its own, deliberately NOT from the mixin: it is not an API resource, and
    # the id is here for a different job — it is the idempotency key a handler passes downstream
    # so a redelivery is recognisable as the same message rather than a new one.
    public_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), default=uuid.uuid4, unique=True, nullable=False
    )

    # What happened, in the past tense: `booking.created`, `property.changed`. A topic names an
    # EVENT, not a command — "booking.created" not "send_confirmation_email".
    #
    # That distinction decides how the system grows. A command has exactly one handler by
    # definition, so the producer has to know every consumer and gets edited each time one is
    # added. An event has none of that: today `booking.created` sends an email, next month it also
    # nudges the host, and the booking service is not touched either time.
    topic: Mapped[str] = mapped_column(String(64), nullable=False)

    # ⚠️ JSONB holds a SNAPSHOT of what the handler needs, not a foreign key to look up later.
    #
    # A key alone is smaller and it is the thing that goes wrong: by the time the worker runs, the
    # row may have changed, and the email then describes the CURRENT state rather than the state
    # that triggered the event. Worse, the row may be gone — and a message that cannot resolve its
    # own subject can only be discarded.
    #
    # The exception is data that must be fresh at delivery (an address the guest may have
    # corrected), which is exactly the case for carrying the id as well and re-reading that one
    # field. Both are here: the payload names the booking AND carries what the email says.
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    # ⚠️ No `index=True` here, deliberately. `ix_outbox_pending` below leads with `status`, and a
    # B-tree index on (a, b) already answers every query a lone index on (a) would — so a separate
    # one is pure cost: another structure to update on every INSERT and UPDATE, more disk, and one
    # more thing for the planner to consider, in exchange for nothing.
    #
    # Autogenerate DID create both, because it reflects what the model declares rather than
    # thinking about it. Redundant indexes are among the most common findings in a database
    # review, and this is exactly how they get there.
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=OutboxStatus.PENDING
    )

    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Not before this time. Two jobs in one column: it is `created_at` for a new message, and the
    # backoff deadline after a failure. A single column means the worker's query is one
    # `available_at <= now()` rather than a NULL check plus a comparison.
    available_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # The last failure, kept so a DEAD row can be diagnosed without going to the logs — which by
    # then have very possibly rotated.
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        # ⚠️ The only index that matters, and its column order is the whole reason it works.
        #
        # The worker's query is `WHERE status = 'PENDING' AND available_at <= now() ORDER BY
        # available_at`. Equality first, then the range/sort column: Postgres can then seek
        # straight to the PENDING rows and walk them already in `available_at` order, so the query
        # costs the same when the table holds ten million DONE rows as when it holds none.
        #
        # Reverse the two and the index cannot satisfy the ORDER BY without a sort. Index only
        # `status` and every poll re-sorts every pending row.
        Index("ix_outbox_pending", "status", "available_at"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<OutboxMessage {self.topic} {self.status} attempts={self.attempts}>"
