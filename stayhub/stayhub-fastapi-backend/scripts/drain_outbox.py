#!/usr/bin/env python3
"""The outbox worker: poll the table, run the handlers, repeat.

    python -m scripts.drain_outbox              # run until interrupted
    python -m scripts.drain_outbox --once       # one batch, then exit (cron, or a test)
    python -m scripts.drain_outbox --interval 1 # poll faster

⚠️ **This is a SEPARATE PROCESS from the API, and that separation is the point.** In the API it
would compete with request handling for the event loop and die with every deploy mid-message. As
its own process it can be restarted, scaled out or stopped without touching the API — and stopping
it is *safe*, which is the property that distinguishes a queue from a background task: messages
simply accumulate as PENDING until it comes back.

Run several if one is not keeping up. `claim` uses `FOR UPDATE SKIP LOCKED`, so N workers process
N disjoint sets of messages with no coordination between them and no configuration.

**Polling, not LISTEN/NOTIFY.** Postgres can push (`NOTIFY outbox`) and it would cut the latency
to near zero, at the cost of a persistent connection, a reconnect loop, and a poll anyway as the
fallback — because a NOTIFY sent while nobody is listening is simply gone. A one-second poll on an
indexed query is a cheap, boring thing that cannot lose a message. Start here; add NOTIFY when the
latency actually matters.

**In production this is a container with a restart policy**, or a Celery/SQS consumer if the volume
justifies one. The shape does not change: claim, handle, mark, commit.
"""

import argparse
import logging
import signal
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.logging import configure_logging  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.services import outbox_service  # noqa: E402

# ⚠️ IMPORTED FOR THEIR SIDE EFFECTS, and this is the one line that will confuse someone.
#
# Handlers register themselves with `@outbox_service.handles(...)` at import time. A module nobody
# imports never runs its decorators, so its topics are simply absent from the registry — and the
# worker's symptom is not a crash: it is "No handler for outbox topic 'booking.created'" on a
# perfectly correct message, forever.
#
# The API imports these transitively through its routes and never notices. The worker imports no
# routes, so it must say so explicitly. `--list-topics` exists to make the registry visible when
# this goes wrong.
import app.search.indexer  # noqa: E402,F401
import app.services.notification_service  # noqa: E402,F401

logger = logging.getLogger("stayhub.outbox")

_running = True


def _stop(signum, _frame):
    """Finish the batch in flight, then exit.

    ⚠️ Setting a flag rather than exiting here is what makes a deploy safe. Killed mid-handler, a
    message is left PENDING (its transaction rolls back) and redelivered — correct, but a duplicate
    email nobody needed. Draining the current batch first turns the common case into a clean stop.
    """
    global _running
    _running = False
    logger.info("Signal %s received — finishing the current batch, then stopping", signum)


def run(interval: float, batch_size: int, once: bool) -> int:
    signal.signal(signal.SIGINT, _stop)
    signal.signal(signal.SIGTERM, _stop)

    totals = {"done": 0, "failed": 0, "dead": 0, "unhandled": 0}
    logger.info(
        "Outbox worker started — topics: %s", ", ".join(outbox_service.registered_topics())
    )

    while _running:
        # ⚠️ A session PER BATCH, not one for the life of the worker. A long-lived session holds
        # one connection open for days and accumulates every object it ever loaded, so a worker
        # that ran all week is a worker with a week of rows in memory.
        with SessionLocal() as db:
            try:
                counts = outbox_service.drain(db, limit=batch_size)
            except Exception:  # noqa: BLE001
                # The queue itself failed — the database is gone, most likely. Log, sleep, retry.
                # Exiting would mean an outage takes the worker with it and nothing drains when
                # the database comes back.
                logger.exception("Outbox drain failed — retrying in %ss", interval)
                counts = {}
                db.rollback()

        for key, value in counts.items():
            totals[key] = totals.get(key, 0) + value

        if any(counts.values()):
            logger.info(
                "batch: done=%(done)s failed=%(failed)s dead=%(dead)s unhandled=%(unhandled)s",
                counts,
            )

        if once:
            break
        time.sleep(interval)

    logger.info(
        "Outbox worker stopped — done=%(done)s failed=%(failed)s dead=%(dead)s unhandled=%(unhandled)s",
        totals,
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--interval", type=float, default=1.0, help="seconds between polls")
    parser.add_argument("--batch-size", type=int, default=20, help="messages claimed per poll")
    parser.add_argument("--once", action="store_true", help="one batch, then exit")
    parser.add_argument(
        "--list-topics", action="store_true", help="print registered handlers and exit"
    )
    parser.add_argument("--log-level", default="INFO")
    args = parser.parse_args()

    configure_logging(level=args.log_level, json_output=False)

    if args.list_topics:
        for topic in outbox_service.registered_topics():
            print(topic)
        return 0

    return run(args.interval, args.batch_size, args.once)


if __name__ == "__main__":
    raise SystemExit(main())
