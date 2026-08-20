"""The repository layer: the only place that knows SQLAlchemy exists.

Why a layer at all, when `db.query(...)` works fine from a route? Because a route that builds
queries cannot be read without knowing the schema, and a service that builds queries cannot be
tested without a database. Keeping persistence here means the service layer reads as business
rules and the routes read as HTTP.

⚠️ Repositories NEVER commit. A commit is a transaction boundary, and only the caller knows where
that boundary is — "create a booking AND its payment, or neither" is one transaction spanning two
repositories. `flush()` is used instead where an id is needed before the commit.
"""

from typing import Generic, TypeVar

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base import Base

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository(Generic[ModelT]):
    model: type[ModelT]

    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, id_: int) -> ModelT | None:
        return self.db.get(self.model, id_)

    def get_by_public_id(self, public_id) -> ModelT | None:
        stmt = select(self.model).where(self.model.public_id == public_id)
        return self.db.execute(stmt).scalar_one_or_none()

    def add(self, entity: ModelT) -> ModelT:
        self.db.add(entity)
        # flush, not commit: sends the INSERT so the database assigns an id, but leaves the
        # transaction open for the caller to commit or roll back.
        self.db.flush()
        return entity

    def delete(self, entity: ModelT) -> None:
        """Soft where the model supports it, hard where it does not.

        Order history references users and properties forever, so those are flagged. A row nothing
        points at can genuinely go.
        """
        if hasattr(entity, "deleted"):
            entity.deleted = True
        else:
            self.db.delete(entity)
        self.db.flush()
