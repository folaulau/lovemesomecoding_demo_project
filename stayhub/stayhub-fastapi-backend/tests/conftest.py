"""Shared fixtures.

These tests run against the SAME Postgres the app uses, in a transaction that is rolled back after
every test. That is a deliberate trade: a separate test database would be cleaner, but this keeps
the setup to `docker compose up` and still leaves no trace.
"""

import pytest
from sqlalchemy.orm import Session

from app.db.session import SessionLocal, engine


@pytest.fixture
def db() -> Session:
    """A session whose work is always rolled back.

    ⚠️ The rollback is bound to an OUTER transaction on the connection, not to the session. Code
    under test calls `db.commit()` — that commits the session's nested work, but the outer
    transaction here still owns it, so the final rollback undoes everything regardless.
    """
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()
