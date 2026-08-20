"""Staff endpoints. Everything here requires role ADMIN."""

from uuid import UUID

from fastapi import APIRouter
from sqlalchemy import func, select

from app.core.deps import AdminUser, DbSession
from app.core.exceptions import NotFoundException
from app.models.booking import Booking
from app.models.enums import BookingStatus, PropertyStatus
from app.models.property import Property
from app.models.user import User
from app.repositories.property_repository import PropertyRepository
from app.schemas.common import ApiModel, Message
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


@router.post("/search/reindex", response_model=Message)
def reindex(_: AdminUser, db: DbSession) -> Message:
    """Rebuild the Elasticsearch index from Postgres.

    The repair path for the sync's one weakness: it is not transactional, so a crash between a
    commit and an index call leaves the two out of step. Postgres is the source of truth, so a
    rebuild is always safe.
    """
    count = PropertyService(db).reindex_all()
    return Message(message=f"Reindexed {count} listings.")
