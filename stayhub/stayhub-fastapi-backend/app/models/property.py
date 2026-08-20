from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Column, ForeignKey, Integer, Numeric, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, PublicIdMixin, SoftDeleteMixin, TimestampMixin
from app.models.enums import PropertyStatus, PropertyType, RoomType

if TYPE_CHECKING:
    from app.models.booking import Booking
    from app.models.user import User


# A plain association table, not a mapped class: the join carries no data of its own, so there is
# nothing for an entity to hold. Give it one the moment it needs a column.
property_amenities = Table(
    "property_amenities",
    Base.metadata,
    Column("property_id", ForeignKey("properties.id", ondelete="CASCADE"), primary_key=True),
    Column("amenity_id", ForeignKey("amenities.id", ondelete="CASCADE"), primary_key=True),
)


class Amenity(Base, TimestampMixin):
    __tablename__ = "amenities"

    id: Mapped[int] = mapped_column(primary_key=True)
    # `slug` is what code matches on; `name` is what a human reads. Renaming the label should never
    # break a filter.
    slug: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    icon: Mapped[str | None] = mapped_column(String(60))


class PropertyImage(Base, TimestampMixin):
    __tablename__ = "property_images"

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(
        ForeignKey("properties.id", ondelete="CASCADE"), nullable=False, index=True
    )
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    alt_text: Mapped[str | None] = mapped_column(String(255))
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_cover: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    property: Mapped["Property"] = relationship(back_populates="images")


class Property(Base, PublicIdMixin, TimestampMixin, SoftDeleteMixin):
    """A house/apartment a host offers. The README calls these "houses"; the model calls them
    properties because half of them are not houses."""

    __tablename__ = "properties"

    id: Mapped[int] = mapped_column(primary_key=True)
    host_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    property_type: Mapped[str] = mapped_column(
        String(30), default=PropertyType.HOUSE, nullable=False
    )
    room_type: Mapped[str] = mapped_column(String(30), default=RoomType.ENTIRE_PLACE, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default=PropertyStatus.DRAFT, nullable=False, index=True
    )

    address_line1: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    city: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    state: Mapped[str | None] = mapped_column(String(120))
    country: Mapped[str] = mapped_column(String(120), nullable=False, default="United States")
    postal_code: Mapped[str | None] = mapped_column(String(20))
    # Numeric, not float. Coordinates are compared and stored, and binary floating point turns
    # 37.7749 into 37.774899999999995 on the round trip.
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))

    # ⚠️ Money is Numeric(10, 2). NEVER Float — 0.1 + 0.2 is not 0.3 in binary floating point, and
    # a booking total is the last place you want that.
    price_per_night: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    cleaning_fee: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"), nullable=False)

    max_guests: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    bedrooms: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    beds: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    bathrooms: Mapped[Decimal] = mapped_column(Numeric(3, 1), default=Decimal("1"), nullable=False)

    # Denormalised rating, recomputed when a review lands. Search results show it on every card;
    # a subquery per card is the classic N+1 that makes a listing page slow.
    rating_average: Mapped[Decimal] = mapped_column(Numeric(3, 2), default=Decimal("0"), nullable=False)
    rating_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    host: Mapped["User"] = relationship(back_populates="properties")
    images: Mapped[list["PropertyImage"]] = relationship(
        back_populates="property",
        cascade="all, delete-orphan",
        order_by="PropertyImage.sort_order",
    )
    amenities: Mapped[list["Amenity"]] = relationship(secondary=property_amenities)
    bookings: Mapped[list["Booking"]] = relationship(back_populates="property")

    @property
    def cover_image_url(self) -> str | None:
        for image in self.images:
            if image.is_cover:
                return image.url
        return self.images[0].url if self.images else None
