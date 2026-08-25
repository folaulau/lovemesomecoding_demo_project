"""The link between a StayHub user and an account at a provider.

A separate table rather than two columns on `users`, because one person can sign in with Google
today and add GitHub tomorrow and expect to land in the same account. Columns would allow exactly
one provider and the migration to a second is the one nobody budgets for.
"""

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


class OAuthAccount(Base, TimestampMixin):
    __tablename__ = "oauth_accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    provider: Mapped[str] = mapped_column(String(32), nullable=False)

    # ⚠️ The provider's `sub`, never the email. Addresses get reassigned — a company deletes
    # alex@ and issues it to a new hire eighteen months later, and if the email is the join key
    # that person signs straight into Alex's account, bookings and saved cards included. `sub` is
    # the provider's permanent, opaque id for one account and it is the only safe thing to key on.
    subject: Mapped[str] = mapped_column(String(255), nullable=False)

    # Kept for support ("which address did they use?") and never used to find the user.
    email: Mapped[str] = mapped_column(String(255), nullable=False)

    user: Mapped["User"] = relationship()

    __table_args__ = (
        # ⚠️ On the PAIR. `subject` alone is not unique — Google and GitHub both number their own
        # accounts from their own sequences, so a unique index on `subject` starts rejecting real
        # logins the day the second provider is switched on, with a constraint error that names a
        # column and explains nothing.
        # Unnamed on purpose: `NAMING_CONVENTION` in db/base.py renders it
        # `uq_oauth_accounts_provider`, and a hand-written name here would differ from what
        # Alembic autogenerates — so every later `--autogenerate` proposes dropping and
        # recreating a constraint that is already correct.
        UniqueConstraint("provider", "subject"),
    )
