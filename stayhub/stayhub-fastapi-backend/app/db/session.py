"""Engine, session factory, and the FastAPI dependency that hands a session to a route."""

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

engine = create_engine(
    settings.database_url,
    # Verifies a pooled connection is alive before handing it out. Without it, a connection that
    # Postgres closed while idle surfaces as a random "server closed the connection unexpectedly"
    # on some unlucky request rather than being quietly replaced.
    pool_pre_ping=True,
    echo=False,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """One session per request, always closed.

    `expire_on_commit=False` above matters for FastAPI specifically: with the default, reading an
    attribute off an object after `commit()` triggers a refresh query, and serialising the response
    happens after the route returns — sometimes after the session is gone.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
