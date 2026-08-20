"""SQLAlchemy declarative base and the columns every table shares."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, MetaData, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# Naming every constraint means Alembic can autogenerate a migration that DROPs one. Without this,
# Postgres invents names like `ck_bookings_1a2b3c` and a downgrade cannot refer to them.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class PublicIdMixin:
    """A UUID the API exposes, alongside the BIGINT primary key the database joins on.

    Two ids per row is deliberate. Integers make fast, small foreign keys; a sequential integer in
    a URL also tells the world how many rows you have and invites `/properties/1`, `/properties/2`.
    The UUID is the only id that ever leaves the process.
    """

    public_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), default=uuid.uuid4, unique=True, nullable=False, index=True
    )


class SoftDeleteMixin:
    """Rows are flagged, never removed — a booking's history references them forever."""

    deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
