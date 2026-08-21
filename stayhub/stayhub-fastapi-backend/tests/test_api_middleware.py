"""The middleware contract, exercised through the real ASGI stack.

These are the tests that would have caught the bug fixed on 2026-08-21: an unhandled exception
reached the browser as a 500 with no CORS headers, so the frontend reported a CORS failure and
never saw the error body the API had carefully written.

⚠️ The bug was invisible to every service-level test in this suite, because it was not in any
service — it was in the ORDER two middlewares were registered in. Nothing below `TestClient`
can see it.
"""

import pytest
from fastapi.testclient import TestClient

from app.core.logging import request_id_ctx
from app.main import app

ORIGIN = "http://localhost:5174"  # in settings.cors_origins; anything else is not


@pytest.fixture(scope="module")
def client() -> TestClient:
    # raise_server_exceptions=False makes TestClient behave like a real server: return the 500
    # rather than re-raising into the test. With the default, the assertions below are unreachable
    # because the RuntimeError propagates and the test just errors.
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture(scope="module", autouse=True)
def probe_routes():
    """Two routes that exist only for these tests.

    Registered on the real `app` so they go through the real middleware stack — a second app
    assembled by hand would be testing a copy of the configuration rather than the configuration.
    """
    seen: dict[str, str] = {}

    @app.get("/__test/ctx", include_in_schema=False)
    def _ctx_sync():
        seen["sync"] = request_id_ctx.get()
        return {"seen": seen["sync"]}

    @app.get("/__test/ctx-async", include_in_schema=False)
    async def _ctx_async():
        seen["async"] = request_id_ctx.get()
        return {"seen": seen["async"]}

    @app.get("/__test/boom", include_in_schema=False)
    def _boom():
        raise RuntimeError("deliberate — testing the unhandled path")

    yield seen

    # Leave the app as it was found. A stray /__test route in the OpenAPI schema of a later test
    # run is exactly the kind of leftover the suite is supposed to avoid.
    app.router.routes = [
        r for r in app.router.routes if not getattr(r, "path", "").startswith("/__test")
    ]


class TestRequestId:
    def test_it_echoes_an_inbound_request_id(self, client):
        r = client.get("/health", headers={"X-Request-ID": "from-the-proxy"})
        assert r.headers["X-Request-ID"] == "from-the-proxy"

    def test_it_invents_one_when_the_caller_sends_none(self, client):
        r = client.get("/health")
        assert r.headers["X-Request-ID"]
        assert r.headers["X-Request-ID"] != "-"

    def test_two_requests_get_different_ids(self, client):
        first = client.get("/health").headers["X-Request-ID"]
        second = client.get("/health").headers["X-Request-ID"]
        assert first != second

    def test_the_id_reaches_a_sync_route(self, client, probe_routes):
        client.get("/__test/ctx", headers={"X-Request-ID": "sync-1"})
        # A `def` route runs in a threadpool. This asserts the ContextVar survived the hop, which
        # is the only reason one logging mechanism covers both route styles.
        assert probe_routes["sync"] == "sync-1"

    def test_the_id_reaches_an_async_route(self, client, probe_routes):
        client.get("/__test/ctx-async", headers={"X-Request-ID": "async-1"})
        assert probe_routes["async"] == "async-1"

    def test_every_response_is_timed(self, client):
        r = client.get("/health")
        assert float(r.headers["X-Response-Time-Ms"]) >= 0


class TestUnhandledExceptions:
    """The regression tests for the 2026-08-21 CORS-on-500 fix."""

    def test_it_returns_the_standard_error_body(self, client, probe_routes):
        r = client.get("/__test/boom")
        assert r.status_code == 500
        # The SAME shape as every other error in this API — one parser on the frontend.
        assert r.json() == {"message": "Something went wrong on our end.", "fieldErrors": {}}

    def test_it_never_leaks_the_exception(self, client, probe_routes):
        r = client.get("/__test/boom")
        assert "RuntimeError" not in r.text
        assert "deliberate" not in r.text
        assert "Traceback" not in r.text

    def test_a_500_still_carries_cors_headers(self, client, probe_routes):
        """⚠️ THE regression test. Reordering the two add_middleware calls in main.py breaks this
        and nothing else in the suite."""
        r = client.get("/__test/boom", headers={"Origin": ORIGIN})
        assert r.status_code == 500
        assert r.headers.get("access-control-allow-origin") == ORIGIN

    def test_a_500_still_carries_the_request_id(self, client, probe_routes):
        r = client.get("/__test/boom", headers={"X-Request-ID": "boom-1"})
        assert r.headers.get("X-Request-ID") == "boom-1"

    def test_a_handled_error_carries_them_too(self, client):
        """The control. A 404 goes through ExceptionMiddleware, which is a different path
        entirely — it was always fine, and it must stay fine."""
        r = client.get(
            "/api/v1/properties/00000000-0000-0000-0000-000000000000",
            headers={"Origin": ORIGIN, "X-Request-ID": "nf-1"},
        )
        assert r.status_code == 404
        assert r.headers.get("access-control-allow-origin") == ORIGIN
        assert r.headers.get("X-Request-ID") == "nf-1"


@pytest.fixture
def captured_json():
    """Capture what actually lands on the log stream, as text.

    ⚠️ This deliberately REPLACES the root handlers instead of adding one, and that detail is the
    whole point of the fixture.

    The first version of these tests used pytest's `caplog` and asserted on `record.request_id`.
    It passed even with the bug reintroduced — because a LogRecord is ONE object shared by every
    handler, the app's root handler (which carries RequestIdFilter) runs first and mutates it, so
    caplog's handler observed an id that the middleware never supplied. The test was reading the
    filter's work and reporting it as the middleware's.

    Removing the app's handler for the duration means nothing can annotate the record behind the
    assertion's back, and the JSON below is genuinely what the middleware produced.
    """
    import io
    import logging

    from app.core.logging import JsonFormatter

    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(JsonFormatter())  # NOTE: no RequestIdFilter, on purpose

    root = logging.getLogger()
    saved, saved_level = root.handlers[:], root.level
    root.handlers = [handler]
    root.setLevel(logging.INFO)
    try:
        yield stream
    finally:
        root.handlers, root.level = saved, saved_level


def access_lines(stream) -> list[dict]:
    import json

    return [
        json.loads(line)
        for line in stream.getvalue().splitlines()
        if line.strip().startswith("{") and json.loads(line).get("logger") == "stayhub.access"
    ]


class TestAccessLog:
    """Log CONTENT, not just log presence.

    ⚠️ These exist because a real bug shipped past every other test in this file: the ContextVar
    was reset in a `finally:` that ran BEFORE the access-log call, so the access line came out as
    `request_id="-"` while every other line in the same request carried the real id. Nothing
    failed — no test looked at what was written.
    """

    def test_the_access_line_carries_the_request_id(self, client, captured_json):
        client.get("/api/v1/properties/amenities", headers={"X-Request-ID": "logged-1"})

        line = access_lines(captured_json)[0]
        assert line["path"] == "/api/v1/properties/amenities"
        assert line["request_id"] == "logged-1"   # <-- the regression assertion
        assert line["status"] == 200
        assert line["duration_ms"] >= 0

    def test_the_id_is_never_the_placeholder(self, client, captured_json):
        """The exact symptom of the original bug, named."""
        client.get("/api/v1/properties/amenities")
        assert access_lines(captured_json)[0]["request_id"] != "-"

    def test_a_failing_request_logs_at_error(self, client, captured_json, probe_routes):
        client.get("/__test/boom", headers={"X-Request-ID": "err-1"})
        line = access_lines(captured_json)[0]
        assert line["level"] == "ERROR"
        assert line["request_id"] == "err-1"

    def test_a_4xx_logs_at_warning_not_error(self, client, captured_json):
        client.get("/api/v1/properties/00000000-0000-0000-0000-000000000000")
        assert access_lines(captured_json)[0]["level"] == "WARNING"

    def test_health_is_not_logged(self, client, captured_json):
        client.get("/health")
        assert access_lines(captured_json) == []
