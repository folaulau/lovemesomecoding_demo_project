"""The FastAPI application.

Responsibilities, in order: CORS, error handling, routes, health. Business logic lives in
`app/services`, persistence in `app/repositories`. Nothing in this file should know what a booking
costs.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.api.v1.routes.uploads import mount_static
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging
from app.core.middleware import RequestContextMiddleware
from app.schemas.common import ApiModel
from app.search.client import es_available, get_es
from app.search.index import ensure_index

configure_logging(level=settings.log_level, json_output=settings.log_json)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Startup and shutdown, in one function.

    ⚠️ Creating the search index here must NOT be able to stop the app booting. If Elasticsearch
    is slow to start — and it always is, it is a JVM — a hard failure here means the API is down
    because *search* is not ready. Everything except search works fine without it.
    """
    if es_available():
        try:
            ensure_index(get_es())
            logger.info("Elasticsearch index ready")
        except Exception:  # noqa: BLE001
            logger.exception("Could not prepare the search index — search will be degraded")
    else:
        logger.warning(
            "Elasticsearch is not reachable at %s — search will return 503 until it is",
            settings.elasticsearch_url,
        )
    yield


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description=(
        "StayHub — the WRITE side of an Airbnb-style app.\n\n"
        "Every create, update and delete lives here. Reads come from Hasura GraphQL "
        "(http://localhost:8081) with ONE deliberate exception: `GET /api/v1/search`, which "
        "queries Elasticsearch. Both accept the same JWT this API issues."
    ),
    lifespan=lifespan,
    docs_url="/docs",
)

# ⚠️ ORDER IS LOAD-BEARING, and it reads backwards.
#
# `add_middleware` INSERTS AT THE FRONT of the list, so the LAST call here is the OUTERMOST
# layer. These two are therefore added inner-first: RequestContextMiddleware, then CORS around it.
#
# CORS MUST be outside. RequestContextMiddleware turns an unhandled exception into a 500 response
# (see the ⚠️ in core/middleware.py); CORS only adds `Access-Control-Allow-Origin` to responses
# that pass back through it. Swap these two calls and every 500 reaches the browser without CORS
# headers, the browser reports a CORS failure instead, and the frontend's error parser never sees
# the body. Verified both ways on 2026-08-21.
app.add_middleware(RequestContextMiddleware)

# ⚠️ allow_credentials=True forbids `allow_origins=["*"]` — the browser rejects a wildcard when
# credentials are involved, and the failure shows up as a CORS error with no useful detail. The
# origins are therefore named explicitly in config.py.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)
app.include_router(api_router, prefix=settings.api_v1_prefix)

# Serves uploaded listing photos. See the ⚠️ in routes/uploads.py — a CDN does this in production.
mount_static(app)


class Health(ApiModel):
    status: str
    database: bool
    elasticsearch: bool


@app.get("/health", response_model=Health, tags=["health"])
def health() -> Health:
    """Reports each dependency separately.

    A single boolean would answer "is it up?" but not "what is broken?", which is the only thing
    anyone actually wants from a health check at 3am.
    """
    from sqlalchemy import text

    from app.db.session import engine

    db_ok = True
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001
        db_ok = False

    es_ok = es_available()
    return Health(
        status="ok" if db_ok else "degraded", database=db_ok, elasticsearch=es_ok
    )
