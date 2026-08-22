"""The transactional outbox.

Three groups, in order of how much they matter:

1. **Transactionality** — the message and the business row commit together, or neither does. This
   is the entire reason the table exists; everything else is plumbing.
2. **Delivery** — claim, handle, retry with backoff, dead-letter.
3. **Concurrency** — `FOR UPDATE SKIP LOCKED` means two workers never take the same message.

The concurrency test needs its own connections, so it does NOT use the rolled-back `db` fixture —
two sessions on one connection cannot lock against each other, and a test that shares them would
pass no matter what the query said.
"""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import delete, select

# ⚠️ Imported for their SIDE EFFECTS, exactly as scripts/drain_outbox.py does — handlers register
# themselves at import time. Imported at MODULE scope, not inside a test, so the registry snapshot
# below always contains them: taken before the import, the snapshot would be restored over the top
# of the real handlers and quietly unregister them for every test that ran afterwards.
import app.search.indexer  # noqa: F401
import app.services.notification_service  # noqa: F401
from app.db.session import SessionLocal
from app.models.enums import OutboxStatus
from app.models.outbox import OutboxMessage
from app.services import outbox_service


@pytest.fixture(autouse=True)
def _isolated_registry():
    """Restore the handler registry after every test.

    `handles` mutates module-level state, so a test that registers a fake handler would otherwise
    leak it into every test that runs afterwards.
    """
    saved = dict(outbox_service._HANDLERS)
    yield
    # Remove only what this test ADDED, and restore anything it overwrote. A blunt
    # `clear(); update(saved)` also deletes handlers registered by an import that happened during
    # the test — which is how the real ones went missing the first time this was written.
    for topic in list(outbox_service._HANDLERS):
        if topic not in saved:
            del outbox_service._HANDLERS[topic]
    outbox_service._HANDLERS.update(saved)


class TestEnqueue:
    def test_it_does_not_commit(self, db):
        """The whole design in one assertion.

        If `enqueue` committed, the message would survive a rollback of the business change — the
        exact "email about a booking that does not exist" bug the pattern prevents.
        """
        outbox_service.enqueue(db, "test.topic", {"a": 1})
        db.rollback()
        assert db.execute(select(OutboxMessage).where(OutboxMessage.topic == "test.topic")).first() is None

    def test_it_flushes_so_the_row_has_an_id(self, db):
        message = outbox_service.enqueue(db, "test.topic", {"a": 1})
        assert message.id is not None
        assert message.public_id is not None

    def test_a_new_message_starts_pending_and_immediately_available(self, db):
        message = outbox_service.enqueue(db, "test.topic", {})
        db.flush()
        assert message.status == OutboxStatus.PENDING
        assert message.attempts == 0

    def test_non_json_values_are_coerced_rather_than_exploding_at_commit(self, db):
        """⚠️ A Decimal or a date in the payload fails at COMMIT — far from the line that caused
        it. Coercing in `enqueue` keeps the traceback pointing at the producer."""
        from datetime import date
        from decimal import Decimal

        message = outbox_service.enqueue(
            db, "test.topic", {"total": Decimal("797.40"), "when": date(2026, 8, 22)}
        )
        db.flush()
        assert message.payload == {"total": "797.40", "when": "2026-08-22"}


class TestTransactionality:
    """The property that makes this an outbox rather than a table with jobs in it."""

    def test_the_booking_and_its_message_commit_together(self, db):
        """⚠️ Counted as a DELTA, not as an absolute.

        The first version asserted `len(found) == 1` against the whole table, which passes only
        while the table happens to be empty — so it went red the moment anyone exercised the API
        by hand. A test whose result depends on rows it did not create is not testing what it says.
        """
        from app.services import notification_service

        topic = notification_service.TOPIC_BOOKING_CREATED
        before = len(
            db.execute(select(OutboxMessage).where(OutboxMessage.topic == topic)).scalars().all()
        )

        outbox_service.enqueue(db, topic, {"bookingId": "x"})
        db.commit()

        after = len(
            db.execute(select(OutboxMessage).where(OutboxMessage.topic == topic)).scalars().all()
        )
        assert after == before + 1

    def test_a_rolled_back_write_leaves_no_message(self, db):
        """A booking rejected by the exclusion constraint must not email anybody.

        `booking_service.create` gets this for free by enqueueing INSIDE the try block, before the
        commit — the rollback takes the message with it.
        """
        before = db.execute(select(OutboxMessage)).scalars().all()
        outbox_service.enqueue(db, "booking.created", {"bookingId": "doomed"})
        db.rollback()
        after = db.execute(select(OutboxMessage)).scalars().all()
        assert len(after) == len(before)


class TestDelivery:
    @pytest.fixture
    def calls(self):
        return []

    def test_a_handler_runs_and_the_message_is_marked_done(self, db, calls):
        @outbox_service.handles("t.ok")
        def _ok(_db, payload):
            calls.append(payload)

        message = outbox_service.enqueue(db, "t.ok", {"n": 1})
        db.commit()

        counts = outbox_service.drain(db)

        db.refresh(message)
        assert counts["done"] == 1
        assert calls == [{"n": 1}]
        assert message.status == OutboxStatus.DONE
        assert message.processed_at is not None

    def test_a_failing_handler_schedules_a_retry(self, db):
        @outbox_service.handles("t.fail")
        def _fail(_db, _payload):
            raise RuntimeError("provider is down")

        message = outbox_service.enqueue(db, "t.fail", {})
        db.commit()

        counts = outbox_service.drain(db)

        db.refresh(message)
        assert counts["failed"] == 1
        assert message.status == OutboxStatus.PENDING  # still to be retried
        assert message.attempts == 1
        assert "provider is down" in message.last_error
        # Scheduled into the future, so the next poll does not immediately retry it.
        assert message.available_at > datetime.now(UTC)

    def test_a_message_is_not_claimed_before_its_backoff_expires(self, db):
        @outbox_service.handles("t.fail")
        def _fail(_db, _payload):
            raise RuntimeError("down")

        outbox_service.enqueue(db, "t.fail", {})
        db.commit()
        outbox_service.drain(db)  # fails, backs off

        assert outbox_service.drain(db) == {"done": 0, "failed": 0, "dead": 0, "unhandled": 0}

    def test_it_eventually_succeeds(self, db):
        attempts = {"n": 0}

        @outbox_service.handles("t.flaky")
        def _flaky(_db, _payload):
            attempts["n"] += 1
            if attempts["n"] < 3:
                raise RuntimeError("not yet")

        message = outbox_service.enqueue(db, "t.flaky", {})
        db.commit()

        for _ in range(3):
            message.available_at = datetime.now(UTC) - timedelta(seconds=1)  # skip the wait
            db.commit()
            outbox_service.drain(db)

        db.refresh(message)
        assert message.status == OutboxStatus.DONE
        assert attempts["n"] == 3

    def test_it_gives_up_and_dead_letters(self, db):
        @outbox_service.handles("t.doomed")
        def _doomed(_db, _payload):
            raise ValueError("this will never work")

        message = outbox_service.enqueue(db, "t.doomed", {})
        db.commit()

        for _ in range(outbox_service.MAX_ATTEMPTS):
            message.available_at = datetime.now(UTC) - timedelta(seconds=1)
            db.commit()
            outbox_service.drain(db)

        db.refresh(message)
        assert message.status == OutboxStatus.DEAD
        assert message.attempts == outbox_service.MAX_ATTEMPTS
        assert "this will never work" in message.last_error

    def test_a_dead_message_is_never_claimed_again(self, db):
        @outbox_service.handles("t.doomed")
        def _doomed(_db, _payload):
            raise ValueError("no")

        message = outbox_service.enqueue(db, "t.doomed", {})
        db.commit()
        for _ in range(outbox_service.MAX_ATTEMPTS):
            message.available_at = datetime.now(UTC) - timedelta(seconds=1)
            db.commit()
            outbox_service.drain(db)

        assert outbox_service.drain(db)["failed"] == 0

    def test_an_unknown_topic_stays_pending_rather_than_dying(self, db):
        """⚠️ A producer deployed ahead of its consumer must not LOSE messages.

        Marking them DEAD would permanently discard work that becomes deliverable the moment the
        consumer ships — turning a five-minute deploy skew into data loss.
        """
        message = outbox_service.enqueue(db, "nobody.handles.this", {})
        db.commit()

        counts = outbox_service.drain(db)

        db.refresh(message)
        assert counts["unhandled"] == 1
        assert message.status == OutboxStatus.PENDING
        assert message.attempts == 0

    def test_one_bad_message_does_not_stop_the_others(self, db, calls):
        @outbox_service.handles("t.bad")
        def _bad(_db, _p):
            raise RuntimeError("boom")

        @outbox_service.handles("t.good")
        def _good(_db, p):
            calls.append(p)

        outbox_service.enqueue(db, "t.bad", {"i": 1})
        outbox_service.enqueue(db, "t.good", {"i": 2})
        outbox_service.enqueue(db, "t.good", {"i": 3})
        db.commit()

        counts = outbox_service.drain(db)

        assert counts["done"] == 2
        assert counts["failed"] == 1
        assert calls == [{"i": 2}, {"i": 3}]

    def test_a_successful_message_is_committed_even_if_a_later_one_fails(self, db):
        """`drain` commits per message, not per batch — so a poison message cannot roll back the
        work already done alongside it and cause it all to be re-sent."""

        @outbox_service.handles("t.good")
        def _good(_db, _p):
            pass

        @outbox_service.handles("t.bad")
        def _bad(_db, _p):
            raise RuntimeError("boom")

        good = outbox_service.enqueue(db, "t.good", {})
        outbox_service.enqueue(db, "t.bad", {})
        db.commit()

        outbox_service.drain(db)

        db.refresh(good)
        assert good.status == OutboxStatus.DONE

    def test_the_batch_size_is_respected(self, db, calls):
        @outbox_service.handles("t.many")
        def _many(_db, p):
            calls.append(p)

        for i in range(5):
            outbox_service.enqueue(db, "t.many", {"i": i})
        db.commit()

        counts = outbox_service.drain(db, limit=2)
        assert counts["done"] == 2
        assert len(calls) == 2


class TestBackoff:
    def test_it_grows_exponentially(self):
        delays = [outbox_service.backoff_for(n).total_seconds() for n in range(1, 6)]
        assert delays == [2, 4, 8, 16, 32]

    def test_it_is_capped(self):
        """⚠️ Uncapped doubling reaches days by attempt 20, so a message that would have succeeded
        on the next retry waits a week."""
        assert (
            outbox_service.backoff_for(50).total_seconds() == outbox_service.BACKOFF_MAX_SECONDS
        )

    def test_the_attempt_budget_is_a_sensible_span(self):
        """Eight attempts must ride out a provider blip without taking a working day."""
        total = sum(
            outbox_service.backoff_for(n).total_seconds()
            for n in range(1, outbox_service.MAX_ATTEMPTS)
        )
        assert 60 < total < 15 * 60


class TestCounts:
    def test_pending_and_dead_are_counted(self, db):
        @outbox_service.handles("t.ok")
        def _ok(_db, _p):
            pass

        before_pending = outbox_service.pending_count(db)
        outbox_service.enqueue(db, "t.ok", {})
        outbox_service.enqueue(db, "t.ok", {})
        db.commit()

        assert outbox_service.pending_count(db) == before_pending + 2
        outbox_service.drain(db)
        assert outbox_service.pending_count(db) == before_pending


class TestSkipLocked:
    """Two workers, one queue, no overlap — and no waiting.

    ⚠️ This test uses REAL, separate connections rather than the rolled-back `db` fixture. Two
    sessions sharing one connection cannot block each other, so the fixture would make this test
    pass even against a query with no locking clause at all — the worst kind of green.

    It therefore commits real rows, and cleans them up in a `finally`.
    """

    TOPIC = "t.skiplocked"

    def _cleanup(self):
        with SessionLocal() as db:
            db.execute(delete(OutboxMessage).where(OutboxMessage.topic == self.TOPIC))
            db.commit()

    def test_two_workers_claim_disjoint_sets(self):
        self._cleanup()
        try:
            with SessionLocal() as setup:
                for i in range(6):
                    outbox_service.enqueue(setup, self.TOPIC, {"i": i})
                setup.commit()

            worker_a = SessionLocal()
            worker_b = SessionLocal()
            try:
                claimed_a = outbox_service.claim(worker_a, limit=3)
                # B runs while A still holds its transaction open — which is precisely the
                # situation two real workers are in.
                claimed_b = outbox_service.claim(worker_b, limit=3)

                ids_a = {m.id for m in claimed_a}
                ids_b = {m.id for m in claimed_b}

                assert len(ids_a) == 3
                assert len(ids_b) == 3, (
                    "worker B claimed nothing — SKIP LOCKED is missing and B is blocked on A"
                )
                assert ids_a.isdisjoint(ids_b), "both workers claimed the same message"
            finally:
                worker_a.rollback()
                worker_b.rollback()
                worker_a.close()
                worker_b.close()
        finally:
            self._cleanup()

    def test_a_locked_message_is_skipped_not_waited_on(self):
        """The half of `FOR UPDATE SKIP LOCKED` people leave off.

        Plain `FOR UPDATE` makes B wait for A, so a second worker adds no throughput — it just
        queues behind the first. Here B must come back empty and come back FAST.
        """
        import time

        self._cleanup()
        try:
            with SessionLocal() as setup:
                outbox_service.enqueue(setup, self.TOPIC, {"only": 1})
                setup.commit()

            worker_a = SessionLocal()
            worker_b = SessionLocal()
            try:
                assert len(outbox_service.claim(worker_a, limit=10)) == 1

                started = time.perf_counter()
                claimed_b = outbox_service.claim(worker_b, limit=10)
                elapsed = time.perf_counter() - started

                assert claimed_b == []
                assert elapsed < 1.0, f"worker B blocked for {elapsed:.2f}s — it is waiting, not skipping"
            finally:
                worker_a.rollback()
                worker_b.rollback()
                worker_a.close()
                worker_b.close()
        finally:
            self._cleanup()


class TestRegistry:
    def test_the_real_handlers_are_registered(self):
        """Guards the side-effect imports in scripts/drain_outbox.py. If a handler module stops
        being imported, the worker's only symptom is 'No handler for topic' on valid messages."""
        import app.search.indexer  # noqa: F401
        import app.services.notification_service  # noqa: F401

        topics = outbox_service.registered_topics()
        assert "booking.created" in topics
        assert "booking.cancelled" in topics
        assert "property.changed" in topics
