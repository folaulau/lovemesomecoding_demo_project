"""Logging setup: one request id on every line, and JSON when something is collecting it.

Two formats, one switch. Locally you want to read the log; in production something is parsing it,
and a regex over free text is a worse contract than a JSON object.

The request id is the part that matters either way. A single request through this API can log from
a route, a service and a repository, and without a correlation id those lines are unrelated
strings in a file shared with every other concurrent request.
"""

import json
import logging
from contextvars import ContextVar

# ⚠️ A ContextVar, not a global and not a thread-local.
#
# A module-level global is shared by every concurrent request, so request B overwrites A's id
# mid-flight. A thread-local is nearly right but breaks on the async half of the app: many
# coroutines share one thread, so they would share one "thread-local" value.
#
# A ContextVar is per-execution-context. asyncio copies the context into each task, and
# `run_in_threadpool` (which is how FastAPI runs every `def` route) copies it into the worker
# thread. So it holds for both sync and async routes, which is the only reason one mechanism
# covers this whole app.
request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")

# What a LogRecord carries before anyone adds anything. Everything NOT in here is something the
# caller passed via `extra=`, and belongs in the JSON output as a field of its own.
_RESERVED = frozenset(
    logging.LogRecord("", 0, "", 0, "", (), None).__dict__
) | {"asctime", "message", "request_id", "taskName"}


class RequestIdFilter(logging.Filter):
    """Attaches the current request id to every record.

    A filter rather than a custom Logger or an adapter: filters apply to records from libraries
    too, so SQLAlchemy's and uvicorn's lines get the id without either of them knowing it exists.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_ctx.get()
        return True  # never actually filters anything out; it only annotates


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "request_id": getattr(record, "request_id", "-"),
            "message": record.getMessage(),
        }

        # Anything passed as `logger.info("...", extra={"booking_id": ...})` becomes a top-level
        # key. That is the whole point of structured logging: `booking_id` is a field you can
        # filter on, not a substring you have to parse back out of a sentence.
        for key, value in record.__dict__.items():
            if key not in _RESERVED:
                payload[key] = value

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        # default=str so a Decimal, a UUID or a datetime in `extra` cannot make logging itself
        # raise. A log line that throws while reporting an error is the worst possible failure.
        return json.dumps(payload, default=str)


def configure_logging(*, level: str = "INFO", json_output: bool = False) -> None:
    """Install the formatter and the filter on the root handler.

    ⚠️ `logging.basicConfig` does NOTHING if the root logger already has a handler — and under
    `uvicorn --reload` it sometimes does. Configuring the handler explicitly is what makes this
    deterministic instead of "works when started one particular way".
    """
    handler = logging.StreamHandler()
    handler.addFilter(RequestIdFilter())
    handler.setFormatter(
        JsonFormatter()
        if json_output
        else logging.Formatter("%(levelname)-5.5s [%(request_id)s] [%(name)s] %(message)s")
    )

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level.upper())

    # ⚠️ Uvicorn installs its OWN handlers on `uvicorn.access` and `uvicorn.error` when it starts,
    # which is AFTER this function has run. Those handlers are not touched by clearing the root,
    # so its lines bypass everything configured above:
    #
    #     {"ts": "...", "logger": "stayhub.access", "message": "POST /api/v1/auth/login -> 200"}
    #     INFO:     172.19.0.1:59176 - "POST /api/v1/auth/login HTTP/1.1" 200 OK
    #
    # Two lines per request, one JSON and one not, in a stream something is trying to parse.
    # Observed in `docker logs` on 2026-08-21.
    #
    # `propagate = True` with no handlers of its own sends uvicorn's records up to the root
    # handler, so they get the same formatter and the same request id as everything else.
    for name in ("uvicorn", "uvicorn.error"):
        lg = logging.getLogger(name)
        lg.handlers.clear()
        lg.propagate = True

    # The access logger is silenced outright rather than reformatted: RequestContextMiddleware
    # already logs every request, with a duration and a request id that uvicorn's line does not
    # have. Keeping both means logging every request twice forever.
    access = logging.getLogger("uvicorn.access")
    access.handlers.clear()
    access.propagate = False
    access.disabled = True
