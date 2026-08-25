"""Importing every model here is what makes Alembic autogenerate see them.

`alembic/env.py` imports this package and reads `Base.metadata`. A model in a file nobody imports
is invisible to that metadata, and autogenerate cheerfully writes a migration that DROPs its table.
"""

from app.db.base import Base
from app.models.booking import Booking, Payment, Review
from app.models.oauth_account import OAuthAccount
from app.models.outbox import OutboxMessage
from app.models.property import Amenity, Property, PropertyImage, property_amenities
from app.models.user import User

__all__ = [
    "Base",
    "User",
    "OAuthAccount",
    "OutboxMessage",
    "Property",
    "PropertyImage",
    "Amenity",
    "property_amenities",
    "Booking",
    "Payment",
    "Review",
]
