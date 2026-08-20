from sqlalchemy import func, select

from app.models.user import User
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    model = User

    def get_by_email(self, email: str) -> User | None:
        # Emails are matched case-insensitively — nobody thinks Ada@x.com and ada@x.com are two
        # accounts. `func.lower` on both sides means the stored casing is preserved for display.
        #
        # ⚠️ This will not use a plain index on `email`. At real scale the fix is a functional
        # index — `CREATE INDEX ON users (lower(email))` — or a citext column.
        stmt = select(User).where(
            func.lower(User.email) == email.strip().lower(),
            User.deleted.is_(False),
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def email_exists(self, email: str) -> bool:
        return self.get_by_email(email) is not None
