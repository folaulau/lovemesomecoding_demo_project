from uuid import UUID

from fastapi import APIRouter, status

from app.core.deps import CurrentUser, DbSession, HostUser
from app.repositories.property_repository import AmenityRepository
from app.schemas.common import Message
from app.schemas.property import (
    AmenityResponse,
    PropertyCreateRequest,
    PropertyResponse,
    PropertyUpdateRequest,
)
from app.services.property_service import PropertyService

router = APIRouter(prefix="/properties", tags=["properties"])


@router.get("/amenities", response_model=list[AmenityResponse])
def list_amenities(db: DbSession) -> list[AmenityResponse]:
    """The amenity vocabulary, for the listing form and the search filter panel.

    A read on the write service, deliberately: it is a tiny static lookup, and routing it through
    Hasura would mean the listing form needs a GraphQL client just for this.
    """
    return [AmenityResponse.model_validate(a) for a in AmenityRepository(db).list_all()]


@router.get("/mine", response_model=list[PropertyResponse])
def my_listings(host: HostUser, db: DbSession) -> list[PropertyResponse]:
    """A host's own listings, drafts included.

    Also a read here rather than in Hasura, and for a better reason: drafts are invisible to the
    public, so this needs the "only your own rows" rule. Hasura CAN express that with a row-level
    permission on `host_id` — and does, for the /hosts pages. This endpoint exists so the API is
    usable without a GraphQL client.
    """
    return [PropertyResponse.model_validate(p) for p in PropertyService(db).list_mine(host)]


@router.get("/{public_id}", response_model=PropertyResponse)
def get_property(public_id: UUID, db: DbSession) -> PropertyResponse:
    """The public listing page. Cached — see `PropertyService.get_public_view`.

    The route calls a method that returns an already-built `PropertyResponse` rather than doing
    its own `model_validate`, because the cached value IS the serialised response. Validating here
    would mean the cache stores one shape and the route produces another.
    """
    return PropertyService(db).get_public_view(public_id)


@router.post("", response_model=PropertyResponse, status_code=status.HTTP_201_CREATED)
def create_property(
    payload: PropertyCreateRequest, host: HostUser, db: DbSession
) -> PropertyResponse:
    """Create a listing. It starts as a DRAFT — publishing is a separate call."""
    return PropertyResponse.model_validate(PropertyService(db).create(host, payload))


@router.patch("/{public_id}", response_model=PropertyResponse)
def update_property(
    public_id: UUID, payload: PropertyUpdateRequest, user: CurrentUser, db: DbSession
) -> PropertyResponse:
    """PATCH, not PUT: only the fields present in the body are changed."""
    return PropertyResponse.model_validate(PropertyService(db).update(public_id, user, payload))


@router.post("/{public_id}/publish", response_model=PropertyResponse)
def publish_property(public_id: UUID, user: CurrentUser, db: DbSession) -> PropertyResponse:
    """Go live. Checks the listing is complete, then indexes it into Elasticsearch."""
    return PropertyResponse.model_validate(PropertyService(db).publish(public_id, user))


@router.post("/{public_id}/unpublish", response_model=PropertyResponse)
def unpublish_property(public_id: UUID, user: CurrentUser, db: DbSession) -> PropertyResponse:
    """Back to draft and out of search. Existing bookings are untouched."""
    return PropertyResponse.model_validate(PropertyService(db).unpublish(public_id, user))


@router.delete("/{public_id}", response_model=Message)
def delete_property(public_id: UUID, user: CurrentUser, db: DbSession) -> Message:
    """Soft delete — bookings reference this row forever."""
    PropertyService(db).delete(public_id, user)
    return Message(message="Listing removed.")
