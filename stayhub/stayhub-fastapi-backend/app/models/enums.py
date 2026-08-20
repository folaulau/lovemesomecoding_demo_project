"""Domain enums.

These are plain `str` enums stored as VARCHAR, not Postgres ENUM types. A native ENUM needs an
`ALTER TYPE` migration to add a value and cannot easily drop one; the check constraint is worth
less than the ability to change your mind. Hasura also exposes VARCHAR far more simply.
"""

from enum import StrEnum


class UserRole(StrEnum):
    CUSTOMER = "CUSTOMER"
    ADMIN = "ADMIN"


class PropertyStatus(StrEnum):
    DRAFT = "DRAFT"          # host is still writing it; visible only to the host
    PUBLISHED = "PUBLISHED"  # bookable, indexed in Elasticsearch
    SUSPENDED = "SUSPENDED"  # staff pulled it; existing bookings survive


class RoomType(StrEnum):
    ENTIRE_PLACE = "ENTIRE_PLACE"
    PRIVATE_ROOM = "PRIVATE_ROOM"
    SHARED_ROOM = "SHARED_ROOM"


class PropertyType(StrEnum):
    HOUSE = "HOUSE"
    APARTMENT = "APARTMENT"
    CABIN = "CABIN"
    CONDO = "CONDO"
    LOFT = "LOFT"
    VILLA = "VILLA"


class BookingStatus(StrEnum):
    PENDING = "PENDING"      # dates held, not yet paid
    CONFIRMED = "CONFIRMED"  # paid
    CANCELLED = "CANCELLED"
    COMPLETED = "COMPLETED"

    @classmethod
    def blocking(cls) -> tuple["BookingStatus", ...]:
        """The statuses that occupy a property's calendar.

        Used by both the availability service and the database's exclusion constraint — they must
        agree, so they read the same definition.
        """
        return (cls.PENDING, cls.CONFIRMED, cls.COMPLETED)


class PaymentStatus(StrEnum):
    REQUIRES_PAYMENT = "REQUIRES_PAYMENT"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"
