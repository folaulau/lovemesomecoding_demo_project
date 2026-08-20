"""Listings: create, update, publish — and keeping the search index in step."""

import logging
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import ApiException, ForbiddenException, NotFoundException
from app.models.enums import PropertyStatus
from app.models.property import Property, PropertyImage
from app.models.user import User
from app.repositories.property_repository import AmenityRepository, PropertyRepository
from app.schemas.property import (
    PropertyCreateRequest,
    PropertyImageInput,
    PropertyUpdateRequest,
)
from app.search import indexer

logger = logging.getLogger(__name__)


class PropertyService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.properties = PropertyRepository(db)
        self.amenities = AmenityRepository(db)

    # ------------------------------------------------------------------ reads

    def get_for_public(self, public_id: UUID) -> Property:
        prop = self.properties.get_by_public_id_full(public_id)
        if prop is None or prop.deleted or prop.status != PropertyStatus.PUBLISHED:
            # A draft is a 404 to the public, not a 403. Its existence is not public information.
            raise NotFoundException("Listing not found.")
        return prop

    def get_for_owner(self, public_id: UUID, actor: User) -> Property:
        prop = self.properties.get_by_public_id_full(public_id)
        if prop is None or prop.deleted:
            raise NotFoundException("Listing not found.")
        self._assert_owner(prop, actor)
        return prop

    def list_mine(self, host: User) -> list[Property]:
        return self.properties.list_for_host(host.id)

    # ------------------------------------------------------------------ writes

    def create(self, host: User, payload: PropertyCreateRequest) -> Property:
        if not host.is_host:
            raise ForbiddenException("Become a host before adding a listing.")

        prop = Property(
            host_id=host.id,
            title=payload.title.strip(),
            description=payload.description,
            property_type=payload.property_type,
            room_type=payload.room_type,
            address_line1=payload.address_line1,
            city=payload.city.strip(),
            state=payload.state,
            country=payload.country,
            postal_code=payload.postal_code,
            latitude=payload.latitude,
            longitude=payload.longitude,
            price_per_night=payload.price_per_night,
            cleaning_fee=payload.cleaning_fee,
            max_guests=payload.max_guests,
            bedrooms=payload.bedrooms,
            beds=payload.beds,
            bathrooms=payload.bathrooms,
            # A new listing starts as a DRAFT. Publishing is a separate, deliberate act — nobody
            # should accidentally go live halfway through writing a description.
            status=PropertyStatus.DRAFT,
        )
        prop.amenities = self.amenities.get_by_slugs(payload.amenity_slugs)
        self._replace_images(prop, payload.images)

        self.properties.add(prop)
        self.db.commit()
        self.db.refresh(prop)
        # A draft is not indexed, but call it anyway — index_property removes as well as adds, so
        # every write path uses the same one-line call and there is no "did I need to index here?"
        self._sync(prop)
        return prop

    def update(self, public_id: UUID, actor: User, payload: PropertyUpdateRequest) -> Property:
        prop = self.get_for_owner(public_id, actor)

        # `exclude_unset` is the difference between PATCH and PUT: only fields the client actually
        # SENT are applied. Without it, every field the client omitted arrives as None and wipes
        # the stored value.
        data = payload.model_dump(exclude_unset=True)
        data.pop("amenity_slugs", None)
        images = data.pop("images", None)

        for field, value in data.items():
            setattr(prop, field, value)

        if payload.amenity_slugs is not None:
            prop.amenities = self.amenities.get_by_slugs(payload.amenity_slugs)
        if images is not None:
            self._replace_images(prop, [PropertyImageInput(**i) for i in images])

        self.db.commit()
        self.db.refresh(prop)
        self._sync(prop)
        return prop

    def publish(self, public_id: UUID, actor: User) -> Property:
        prop = self.get_for_owner(public_id, actor)

        # Publishing has entry requirements. Enforcing them here rather than in the form means an
        # incomplete listing cannot reach search results no matter what client submitted it.
        missing: list[str] = []
        if not prop.images:
            missing.append("at least one photo")
        if len(prop.description or "") < 20:
            missing.append("a description of at least 20 characters")
        if prop.price_per_night <= 0:
            missing.append("a nightly price")
        if missing:
            raise ApiException("Before publishing, add " + ", and ".join(missing) + ".")

        prop.status = PropertyStatus.PUBLISHED
        self.db.commit()
        self.db.refresh(prop)
        self._sync(prop)
        return prop

    def unpublish(self, public_id: UUID, actor: User) -> Property:
        prop = self.get_for_owner(public_id, actor)
        prop.status = PropertyStatus.DRAFT
        self.db.commit()
        self.db.refresh(prop)
        # Existing bookings deliberately survive. Taking a listing off the market must not cancel
        # stays people have already paid for.
        self._sync(prop)
        return prop

    def delete(self, public_id: UUID, actor: User) -> None:
        prop = self.get_for_owner(public_id, actor)
        self.properties.delete(prop)  # soft — bookings reference this row forever
        self.db.commit()
        indexer.remove_property(str(prop.public_id))

    def reindex_all(self) -> int:
        """Rebuild the whole search index from Postgres. The repair button."""
        return indexer.rebuild_index(self.properties.all_for_reindex())

    # ------------------------------------------------------------------ helpers

    def _sync(self, prop: Property) -> None:
        """⚠️ Called AFTER commit, never before — see app/search/indexer.py for why.

        It cannot raise: a search cluster having a bad day must not fail a host's save.
        """
        indexer.index_property(prop)

    def _replace_images(self, prop: Property, images: list[PropertyImageInput]) -> None:
        """Images are replaced wholesale rather than diffed.

        The gallery is small and ordered, so "here is the new list" is both simpler to reason about
        and simpler for the client than a set of add/remove/reorder operations. `delete-orphan` on
        the relationship is what actually removes the old rows.
        """
        prop.images.clear()
        cover_seen = False
        for order, image in enumerate(images):
            is_cover = image.is_cover and not cover_seen
            cover_seen = cover_seen or is_cover
            prop.images.append(
                PropertyImage(
                    url=image.url,
                    alt_text=image.alt_text,
                    sort_order=order,
                    is_cover=is_cover,
                )
            )
        # Exactly one cover, always. If the client marked none, the first photo is it — otherwise
        # a listing with photos shows a blank card in search results.
        if prop.images and not cover_seen:
            prop.images[0].is_cover = True

    def _assert_owner(self, prop: Property, actor: User) -> None:
        if actor.role == "ADMIN":
            return
        if prop.host_id != actor.id:
            # 404 again, for the same reason as everywhere else: 403 would confirm the id is real.
            raise NotFoundException("Listing not found.")
