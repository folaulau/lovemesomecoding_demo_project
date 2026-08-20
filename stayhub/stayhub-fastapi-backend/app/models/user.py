from typing import TYPE_CHECKING

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, PublicIdMixin, SoftDeleteMixin, TimestampMixin
from app.models.enums import UserRole

if TYPE_CHECKING:
    from app.models.booking import Booking
    from app.models.property import Property


class User(Base, PublicIdMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500))

    # ⚠️ Role can NEVER come from a request body — registration always writes CUSTOMER. The only
    # way to become an ADMIN is a seed script or another admin. See services/auth_service.py.
    role: Mapped[str] = mapped_column(String(20), default=UserRole.CUSTOMER, nullable=False)

    # Hosting is a MODE, not a role (decision D1 in progress_report.md). One account books stays
    # and lists them; flipping this flag never grants staff access.
    is_host: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    host_bio: Mapped[str | None] = mapped_column(String(1000))

    properties: Mapped[list["Property"]] = relationship(back_populates="host")
    bookings: Mapped[list["Booking"]] = relationship(back_populates="guest")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"
