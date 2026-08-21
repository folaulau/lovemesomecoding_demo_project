"""Staff endpoints. Everything here requires role ADMIN."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

import asyncio
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import AdminUser, DbSession
from app.db.async_session import AsyncSessionLocal, get_async_db
from app.core.exceptions import ApiException, NotFoundException
from app.models.booking import Booking
from app.models.enums import BookingStatus, PropertyStatus
from app.models.property import Property
from app.models.user import User
from app.repositories.property_repository import PropertyRepository
from app.schemas.common import ApiModel, Message, Page, PageQuery
from app.schemas.property import PropertyResponse
from app.services.property_service import PropertyService

router = APIRouter(prefix="/admin", tags=["admin"])


class AdminStats(ApiModel):
    total_users: int
    total_hosts: int
    total_properties: int
    published_properties: int
    total_bookings: int
    confirmed_bookings: int
    cancelled_bookings: int
    gross_bookings_value: float


@router.get("/stats", response_model=AdminStats)
def stats(_: AdminUser, db: DbSession) -> AdminStats:
    """Headline numbers, from real aggregates — never mock data.

    ⚠️ Each of these filters `deleted = false` itself. The soft-delete flag is only automatic when
    a query goes through the ORM's own filtering; a hand-written aggregate has to say so. Forgetting
    it counts deleted rows as real ones, and the totals stay plausible while being wrong.
    """
    def scalar(stmt) -> int:
        return db.execute(stmt).scalar_one() or 0

    gross = db.execute(
        select(func.coalesce(func.sum(Booking.total), 0)).where(
            Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.COMPLETED])
        )
    ).scalar_one()

    return AdminStats(
        total_users=scalar(select(func.count(User.id)).where(User.deleted.is_(False))),
        total_hosts=scalar(
            select(func.count(User.id)).where(User.deleted.is_(False), User.is_host.is_(True))
        ),
        total_properties=scalar(
            select(func.count(Property.id)).where(Property.deleted.is_(False))
        ),
        published_properties=scalar(
            select(func.count(Property.id)).where(
                Property.deleted.is_(False), Property.status == PropertyStatus.PUBLISHED
            )
        ),
        total_bookings=scalar(select(func.count(Booking.id))),
        confirmed_bookings=scalar(
            select(func.count(Booking.id)).where(Booking.status == BookingStatus.CONFIRMED)
        ),
        cancelled_bookings=scalar(
            select(func.count(Booking.id)).where(Booking.status == BookingStatus.CANCELLED)
        ),
        gross_bookings_value=float(gross),
    )


class AdminUserRow(ApiModel):
    public_id: UUID
    email: str
    first_name: str
    last_name: str
    role: str
    is_host: bool
    created_at: datetime


class AdminBookingRow(ApiModel):
    public_id: UUID
    status: str
    check_in: date
    check_out: date
    nights: int
    total: Decimal
    guest_email: str
    property_title: str
    created_at: datetime


@router.get("/users", response_model=Page[AdminUserRow])
def list_users(
    _: AdminUser,
    db: DbSession,
    page: PageQuery,
    q: str | None = Query(default=None, max_length=200, description="Matches email or name"),
    is_host: bool | None = Query(default=None, alias="isHost"),
) -> Page[AdminUserRow]:
    """Browse accounts.

    ⚠️ The COUNT and the SELECT must carry the SAME filters. It is easy to build the filtered page
    and then count the whole table — the rows look right, the pager is silently wrong, and nothing
    errors. Both are built from `conditions` below for exactly that reason.
    """
    conditions = [User.deleted.is_(False)]
    if q:
        # Bound parameters — `ilike` here is SQLAlchemy building a parameterised LIKE, not string
        # interpolation. An f-string in a where clause is how SQL injection gets in.
        pattern = f"%{q}%"
        conditions.append(
            User.email.ilike(pattern)
            | User.first_name.ilike(pattern)
            | User.last_name.ilike(pattern)
        )
    if is_host is not None:
        conditions.append(User.is_host.is_(is_host))

    total = db.execute(select(func.count(User.id)).where(*conditions)).scalar_one()

    # ⚠️ ORDER BY is not optional with LIMIT/OFFSET. Postgres makes no promise about row order
    # without it, so the same page-2 request can return rows already seen on page 1. `id` is
    # unique, which is what makes the ordering total rather than merely mostly-stable.
    rows = db.execute(
        select(User)
        .where(*conditions)
        .order_by(User.id.desc())
        .limit(page.page_size)
        .offset(page.offset)
    ).scalars().all()

    return Page.of([AdminUserRow.model_validate(u) for u in rows], total, page)


@router.get("/bookings", response_model=Page[AdminBookingRow])
def list_bookings(
    _: AdminUser,
    db: DbSession,
    page: PageQuery,
    status_filter: BookingStatus | None = Query(default=None, alias="status"),
) -> Page[AdminBookingRow]:
    """Every booking in the system, newest first.

    ⚠️ The join to users and properties is explicit rather than lazy attribute access on each row.
    Reading `b.guest.email` in the loop below would issue one query per booking — the N+1 that
    makes a page of 20 rows cost 41 round trips.
    """
    conditions = []
    if status_filter is not None:
        conditions.append(Booking.status == status_filter)

    total = db.execute(select(func.count(Booking.id)).where(*conditions)).scalar_one()

    rows = db.execute(
        select(Booking, User.email, Property.title)
        .join(User, Booking.guest_id == User.id)
        .join(Property, Booking.property_id == Property.id)
        .where(*conditions)
        .order_by(Booking.id.desc())
        .limit(page.page_size)
        .offset(page.offset)
    ).all()

    items = [
        AdminBookingRow(
            public_id=b.public_id,
            status=b.status,
            check_in=b.check_in,
            check_out=b.check_out,
            nights=b.nights,
            total=b.total,
            guest_email=email,
            property_title=title,
            created_at=b.created_at,
        )
        for b, email, title in rows
    ]
    return Page.of(items, total, page)


AsyncDbSession = Annotated[AsyncSession, Depends(get_async_db)]


@router.get("/stats-async", response_model=AdminStats)
async def stats_async(_: AdminUser, db: AsyncDbSession) -> AdminStats:
    """The same numbers as `/stats`, with the eight aggregates running CONCURRENTLY.

    ⚠️ AND IT IS SLOWER HERE. Measured against this Postgres on 2026-08-21, 30 runs each:

        /admin/stats        (8 serial)      median   7.9ms
        /admin/stats-async  (8 concurrent)  median  19.8ms      <- 2.5x WORSE

    That is not a bug and it is the most useful thing in this file. Async removes WAITING, not
    work, and it charges a fixed overhead — a session and a pooled connection per task, the
    greenlet bridge, asyncio scheduling — to do it. Against a local Postgres answering in under a
    millisecond there is no waiting to remove, so all that is left is the bill.

    Vary only the per-query wait and the crossover is obvious (8 queries, median of 7 runs):

        per-query wait   sync serial   async gather
                  0ms         4.0ms        15.5ms     async 289% slower
                  5ms        59.1ms        22.2ms     async  63% faster
                 50ms       444.9ms        76.2ms     async  83% faster
                200ms      1654.7ms       232.9ms     async  86% faster

    So: concurrency pays in proportion to how long you WAIT. Roughly 1-2ms per call is the break
    even. A database on the same machine is below it; a third-party HTTP API, an S3 upload or a
    database across a network is far above it.

    `/stats` is the endpoint the admin console actually calls, and it stays sync for that reason.

    ⚠️ `asyncio.gather` over ONE AsyncSession would not work — a session is a single connection
    and cannot multiplex. Each task takes its own session out of the pool, which is why
    `pool_size` in db/async_session.py has to be at least as large as the widest gather here.

    ⚠️ `/stats` is NOT deleted or rewritten. It is `def`, runs in a threadpool, is correct, and
    is faster. This sits beside it so the two can be measured — see scripts/bench_stats.py, which
    also asserts they return identical numbers. Rewriting a working sync endpoint to look modern
    is exactly the change the table above says not to make.
    """
    async def scalar(stmt) -> int:
        # Its own session per task. See the ⚠️ above.
        async with AsyncSessionLocal() as s:
            return (await s.execute(stmt)).scalar_one() or 0

    (
        total_users, total_hosts, total_properties, published_properties,
        total_bookings, confirmed_bookings, cancelled_bookings, gross,
    ) = await asyncio.gather(
        scalar(select(func.count(User.id)).where(User.deleted.is_(False))),
        scalar(select(func.count(User.id)).where(
            User.deleted.is_(False), User.is_host.is_(True))),
        scalar(select(func.count(Property.id)).where(Property.deleted.is_(False))),
        scalar(select(func.count(Property.id)).where(
            Property.deleted.is_(False), Property.status == PropertyStatus.PUBLISHED)),
        scalar(select(func.count(Booking.id))),
        scalar(select(func.count(Booking.id)).where(
            Booking.status == BookingStatus.CONFIRMED)),
        scalar(select(func.count(Booking.id)).where(
            Booking.status == BookingStatus.CANCELLED)),
        scalar(select(func.coalesce(func.sum(Booking.total), 0)).where(
            Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.COMPLETED]))),
    )

    return AdminStats(
        total_users=total_users,
        total_hosts=total_hosts,
        total_properties=total_properties,
        published_properties=published_properties,
        total_bookings=total_bookings,
        confirmed_bookings=confirmed_bookings,
        cancelled_bookings=cancelled_bookings,
        gross_bookings_value=float(gross),
    )


@router.post("/properties/{public_id}/suspend", response_model=PropertyResponse)
def suspend_property(public_id: UUID, _: AdminUser, db: DbSession) -> PropertyResponse:
    """Pull a listing off the market. Existing bookings are deliberately left alone."""
    repo = PropertyRepository(db)
    prop = repo.get_by_public_id_full(public_id)
    if prop is None or prop.deleted:
        raise NotFoundException("Listing not found.")

    prop.status = PropertyStatus.SUSPENDED
    db.commit()
    db.refresh(prop)
    from app.search import indexer

    indexer.index_property(prop)  # removes it from the index — SUSPENDED is not visible
    return PropertyResponse.model_validate(prop)


@router.post("/properties/{public_id}/unsuspend", response_model=PropertyResponse)
def unsuspend_property(public_id: UUID, _: AdminUser, db: DbSession) -> PropertyResponse:
    """Put a suspended listing back on the market, and back into search."""
    repo = PropertyRepository(db)
    prop = repo.get_by_public_id_full(public_id)
    if prop is None or prop.deleted:
        raise NotFoundException("Listing not found.")
    if prop.status != PropertyStatus.SUSPENDED:
        raise ApiException("That listing is not suspended.")

    prop.status = PropertyStatus.PUBLISHED
    db.commit()
    db.refresh(prop)
    from app.search import indexer

    indexer.index_property(prop)
    return PropertyResponse.model_validate(prop)


@router.post("/users/{public_id}/deactivate", response_model=Message)
def deactivate_user(public_id: UUID, actor: AdminUser, db: DbSession) -> Message:
    """Soft-delete an account.

    ⚠️ Staff cannot deactivate THEMSELVES. With one admin that locks everyone out of the console
    permanently, and the only way back is a SQL prompt.
    """
    user = db.execute(select(User).where(User.public_id == public_id)).scalar_one_or_none()
    if user is None or user.deleted:
        raise NotFoundException("User not found.")
    if user.id == actor.id:
        raise ApiException("You cannot deactivate your own account.")

    user.deleted = True
    db.commit()

    # Their listings go with them — otherwise a deactivated host's places stay bookable, and the
    # guest who books one has nobody to let them in.
    repo = PropertyRepository(db)
    for prop in repo.list_for_host(user.id):
        prop.deleted = True
        indexer_remove(prop)
    db.commit()

    return Message(message=f"{user.full_name} deactivated.")


def indexer_remove(prop) -> None:
    from app.search import indexer

    indexer.remove_property(str(prop.public_id))


@router.post("/search/reindex", response_model=Message)
def reindex(_: AdminUser, db: DbSession) -> Message:
    """Rebuild the Elasticsearch index from Postgres.

    The repair path for the sync's one weakness: it is not transactional, so a crash between a
    commit and an index call leaves the two out of step. Postgres is the source of truth, so a
    rebuild is always safe.
    """
    count = PropertyService(db).reindex_all()
    return Message(message=f"Reindexed {count} listings.")
