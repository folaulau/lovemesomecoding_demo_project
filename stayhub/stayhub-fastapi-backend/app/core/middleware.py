"""Request id and access logging.

One middleware, two jobs that belong together: give every request an id, and log what happened to
it. Splitting them would mean two passes over every request to produce one line.
"""

import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.core.exceptions import unhandled_response
from app.core.logging import request_id_ctx

logger = logging.getLogger("stayhub.access")

REQUEST_ID_HEADER = "X-Request-ID"

# `/health` is polled by the container orchestrator every few seconds forever. Logging it buries
# the requests anyone cares about under thousands of identical lines.
QUIET_PATHS = frozenset({"/health", "/docs", "/openapi.json", "/redoc"})


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Stamps an id on the request, times it, logs one line, echoes the id back.

    The id is taken from an inbound `X-Request-ID` when there is one. That is what makes it useful
    beyond this process: a reverse proxy or an upstream service that already assigned an id gets
    the SAME id in our logs, so one identifier follows a request across the whole system. We only
    invent one when nobody else has.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = request.headers.get(REQUEST_ID_HEADER) or uuid.uuid4().hex[:16]

        # ⚠️ Set BEFORE call_next, and this direction is the only one that works.
        #
        # BaseHTTPMiddleware runs the downstream app in a child anyio task. A child task inherits
        # a COPY of the context at creation, so a value set here is visible all the way down —
        # routes, services, repositories. The reverse is not true: anything the downstream app
        # sets is written into its own copy and is invisible here after call_next returns.
        #
        # So: seed context on the way in, never expect to read it back on the way out.
        token = request_id_ctx.set(request_id)
        started = time.perf_counter()

        try:
            response = await call_next(request)
        except Exception:
            # ⚠️ Caught and CONVERTED here, not re-raised — and that is the whole reason this
            # middleware sits inside CORS rather than outside it.
            #
            # Re-raising sends the exception up to ServerErrorMiddleware, which is the outermost
            # layer of the stack. The 500 it builds has skipped every user middleware on the way
            # back, so it carries no `Access-Control-Allow-Origin`, and a browser shown a 500
            # with no CORS header reports a CORS failure and never exposes the body. The frontend
            # never sees the error message the API took the trouble to write.
            #
            # Returning the response from in here means CORSMiddleware — which is outside us —
            # sees an ordinary response and adds its headers.
            #
            # The body itself comes from core/exceptions.py so there is still exactly ONE error
            # shape in this API, produced in one place.
            elapsed_ms = (time.perf_counter() - started) * 1000
            logger.exception(
                "%s %s failed after %.1fms",
                request.method,
                request.url.path,
                elapsed_ms,
                extra={
                    # Explicit, not left to RequestIdFilter. The filter lives on the root
                    # HANDLER, so anything that swaps the handler out — pytest's caplog, a
                    # different log config — loses it. On the one line that exists to correlate
                    # a request, the id is passed as data.
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status": 500,
                    "duration_ms": round(elapsed_ms, 1),
                },
            )
            response = unhandled_response()
            response.headers[REQUEST_ID_HEADER] = request_id
            response.headers["X-Response-Time-Ms"] = f"{elapsed_ms:.1f}"
            request_id_ctx.reset(token)
            return response

        elapsed_ms = (time.perf_counter() - started) * 1000
        response.headers[REQUEST_ID_HEADER] = request_id
        response.headers["X-Response-Time-Ms"] = f"{elapsed_ms:.1f}"

        if request.url.path not in QUIET_PATHS:
            # A 5xx is our fault and a 4xx usually is not, so they log at different levels — that
            # alone makes "alert on ERROR" a usable rule.
            level = (
                logging.ERROR
                if response.status_code >= 500
                else logging.WARNING
                if response.status_code >= 400
                else logging.INFO
            )
            logger.log(
                level,
                "%s %s -> %d in %.1fms",
                request.method,
                request.url.path,
                response.status_code,
                elapsed_ms,
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status": response.status_code,
                    "duration_ms": round(elapsed_ms, 1),
                },
            )

        # Reset last, after the access log above.
        #
        # History worth keeping: this was `finally: request_id_ctx.reset(token)` on the try block,
        # which reads as the careful thing to do and was wrong — the reset ran BEFORE the logging
        # below it, so the access line came out as `"request_id": "-"` while every other line in
        # the same request carried the real id. It was found by reading `docker logs`, not by a
        # test; nothing asserted on log CONTENT.
        #
        # The actual fix is the explicit `"request_id": request_id` in the `extra=` above, which
        # makes this line's position irrelevant to correctness. It stays here anyway: leaving a
        # ContextVar set past the work it describes is how the NEXT logger to fire inherits a
        # stale id.
        request_id_ctx.reset(token)
        return response
