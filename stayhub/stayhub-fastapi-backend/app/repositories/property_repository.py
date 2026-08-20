from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.enums import PropertyStatus
from app.models.property import Amenity, Property
from app.repositories.base import BaseRepository


class PropertyRepository(BaseRepository[Property]):
    model = Property

    def get_by_public_id_full(self, public_id: UUID) -> Property | None:
        """Load a property with its images, amenities and host in ONE round trip.

        Without the `joinedload`s this is the textbook N+1: serialising the response touches
        `.images`, `.amenities` and `.host`, and each one fires its own SELECT — four queries for
        one listing, and one per card on a page of twenty.
        """
        stmt = (
            select(Property)
            .options(
                joinedload(Property.images),
                joinedload(Property.amenities),
                joinedload(Property.host),
            )
            .where(Property.public_id == public_id, Property.deleted.is_(False))
        )
        # ⚠️ `.unique()` is REQUIRED after a joinedload against a collection, and SQLAlchemy 2.0
        # raises rather than guessing. The join multiplies the parent row once per child; unique()
        # collapses them back to one object.
        return self.db.execute(stmt).unique().scalar_one_or_none()

    def list_for_host(self, host_id: int) -> list[Property]:
        stmt = (
            select(Property)
            .options(joinedload(Property.images))
            .where(Property.host_id == host_id, Property.deleted.is_(False))
            .order_by(Property.created_at.desc())
        )
        return list(self.db.execute(stmt).unique().scalars())

    def list_published(self, limit: int = 100, offset: int = 0) -> list[Property]:
        stmt = (
            select(Property)
            .options(joinedload(Property.images), joinedload(Property.amenities))
            .where(
                Property.status == PropertyStatus.PUBLISHED,
                Property.deleted.is_(False),
            )
            .order_by(Property.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(self.db.execute(stmt).unique().scalars())

    def all_for_reindex(self) -> list[Property]:
        """Everything the search index should contain — used by the full-rebuild path."""
        stmt = (
            select(Property)
            .options(joinedload(Property.images), joinedload(Property.amenities))
            .where(
                Property.status == PropertyStatus.PUBLISHED,
                Property.deleted.is_(False),
            )
        )
        return list(self.db.execute(stmt).unique().scalars())


class AmenityRepository(BaseRepository[Amenity]):
    model = Amenity

    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get_by_slugs(self, slugs: list[str]) -> list[Amenity]:
        if not slugs:
            return []
        stmt = select(Amenity).where(Amenity.slug.in_(slugs))
        return list(self.db.execute(stmt).scalars())

    def list_all(self) -> list[Amenity]:
        return list(self.db.execute(select(Amenity).order_by(Amenity.name)).scalars())
