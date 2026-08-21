"""An async engine, alongside the sync one.

StayHub is a sync app and stays one — `def` routes, a `Session` per request, plain SQLAlchemy.
That is the right default: it is simpler, it is what most FastAPI code looks like, and FastAPI
runs `def` routes in a threadpool so they never block the event loop.

This module exists for the ONE case where async genuinely pays: several INDEPENDENT queries that
can run at the same time. `/admin/stats` issues eight aggregates that do not depend on each other.
Sync, that is eight round trips end to end; async with `asyncio.gather`, it is one round trip's
worth of waiting, because the waiting overlaps.

⚠️ Async is not "faster Python". It removes WAITING, not work. A single query does not get quicker
by being awaited — it gets slower, by the overhead. Reach for this only when there is real
concurrency to exploit.

⚠️ Both engines point at the same database and neither knows about the other. An async session and
a sync session are separate connections in separate pools and therefore separate transactions:
work done in one is invisible to the other until it commits. Never split one unit of work across
both.
"""

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

# ⚠️ Same URL, same driver. `postgresql+psycopg://` is psycopg 3, which speaks BOTH protocols —
# `create_engine` gets the sync one and `create_async_engine` the async one, from one connection
# string and one dependency.
#
# This is a psycopg-3 property, not a general one. With psycopg2 the async URL has to change to
# `postgresql+asyncpg://` and asyncpg has to be installed — a second driver with its own type
# handling, which is how a Decimal starts arriving as a float on one code path and not the other.
async_engine = create_async_engine(
    settings.database_url,
    pool_pre_ping=True,
    echo=False,
    # Deliberately small. This pool is IN ADDITION to the sync one, and Postgres counts total
    # connections: workers × (sync pool + async pool) must stay under `max_connections`. An async
    # pool sized like a sync pool is how a 4-worker deploy exhausts a default 100-connection
    # Postgres.
    pool_size=5,
    max_overflow=5,
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine, expire_on_commit=False, autoflush=False
)


async def get_async_db() -> AsyncIterator[AsyncSession]:
    """One async session per request, always closed. The async twin of `get_db`."""
    async with AsyncSessionLocal() as session:
        yield session
