"""Listings: create, update, publish — and keeping the search index in step."""

import logging
from uuid import UUID

from sqlalchemy.orm import Session

from app.core import cache
from app.core.config import settings
from app.core.exceptions import ApiException, ForbiddenException, NotFoundException
from app.models.enums import PropertyStatus
from app.models.property import Property, PropertyImage
from app.models.user import User
from app.repositories.property_repository import AmenityRepository, PropertyRepository
from app.schemas.property import (
    PropertyCreateRequest,
    PropertyImageInput,
    PropertyResponse,
    PropertyUpdateRequest,
)
from app.search import indexer
from app.services import outbox_service

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

    def get_public_view(self, public_id: UUID) -> PropertyResponse:
        """The public listing page, cache-aside over Redis.

        This is the only cached read in StayHub, and it earns it on all three counts: it is the
        hottest read in the app (a guest opens a dozen listings while comparing), the most
        expensive (`get_by_public_id_full` joins images, amenities and the host), and the least
        volatile (a host edits a listing a handful of times a year).

        The shape is the classic one, and the order of the four steps is the whole pattern:

            look in the cache  ->  hit?  return it
                               ->  miss? read the database, store, return

        Two things worth noticing about what is NOT here.

        **The 404 is not cached.** `get_for_public` raises for a draft or a deleted listing, and
        that exception propagates past the `set_json` below without ever reaching it. Caching it
        would mean a host who publishes a listing is told for the next five minutes that it does
        not exist — and the ids are UUIDs, so there is no lookup flood to absorb in exchange.

        **A cache failure is not handled here.** There is no try/except in this method because
        there is nothing to catch: every function in `core.cache` returns "miss" instead of
        raising. With Redis stopped, `get_json` returns None, the database read happens, `set_json`
        does nothing, and this method behaves exactly as it did before the cache existed.

        ⚠️ The DTO is cached, not the SQLAlchemy object. A `Property` is bound to a Session and
        carries lazy relationships; pickling one and reviving it in another request is a
        DetachedInstanceError waiting to happen. `PropertyResponse` is a plain, already-validated
        value — and serialising it here also means the cache stores exactly what the route returns,
        so a cache hit and a cache miss cannot produce different JSON.
        """
        key = cache.property_key(public_id)

        cached = cache.get_json(key)
        if cached is not None:
            return PropertyResponse.model_validate(cached)

        view = PropertyResponse.model_validate(self.get_for_public(public_id))
        cache.set_json(key, view.model_dump(mode="json"), settings.cache_ttl_property_seconds)
        return view

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
        # Not via _sync: that would re-index a row that must leave the index.
        cache.invalidate(cache.property_key(prop.public_id))

    def reindex_all(self) -> int:
        """Rebuild the whole search index from Postgres. The repair button."""
        return indexer.rebuild_index(self.properties.all_for_reindex())

    # ------------------------------------------------------------------ helpers

    def _sync(self, prop: Property) -> None:
        """Push a committed change outward: into the search index, and out of the cache.

        ⚠️ Called AFTER commit, never before — see app/search/indexer.py for why.

        It cannot raise: neither a search cluster nor a cache having a bad day may fail a host's
        save. Both calls below swallow their own transport errors for that reason.

        **Every write path already calls this**, which is the entire reason cache invalidation
        lives here rather than in `update`, `publish`, `unpublish` and `create` separately. The
        classic invalidation bug is a new write path that forgets one of four identical lines; a
        new write path here forgets `_sync` — and then it does not index either, which is loud and
        obvious the first time a listing fails to appear in search. Coupling the quiet failure to
        the loud one is deliberate.

        `delete` is the exception and calls `indexer.remove_property` plus `invalidate` itself,
        because by then the object is soft-deleted and re-indexing it would put it back.
        """
        indexed = indexer.index_property(prop)
        cache.invalidate(cache.property_key(prop.public_id))

        if not indexed:
            # Elasticsearch refused the write. Queue a retry rather than leaving the index wrong
            # until somebody notices and runs rebuild_index.
            #
            # ⚠️ This enqueue needs its own commit, and that is NOT the transactional outbox — the
            # property was committed several lines ago by the caller. It cannot be: this method
            # runs after the commit ON PURPOSE (indexing inside the transaction would let a slow
            # search cluster fail a host's save), so the message is genuinely a second write.
            #
            # The residual gap is real and worth naming: crash between the commit and this line
            # and the index change is lost with nothing queued. `reindex_all` remains the backstop
            # for exactly that. The booking path in booking_service.create has no such gap because
            # its enqueue is inside the transaction — compare the two.
            outbox_service.enqueue(
                self.db,
                indexer.TOPIC_PROPERTY_CHANGED,
                {"propertyId": str(prop.public_id), "reason": "index-write-failed"},
            )
            self.db.commit()
            logger.warning(
                "Indexing property %s failed — queued for retry via the outbox", prop.public_id
            )

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
