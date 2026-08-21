"""Application settings, read once from the environment.

`pydantic-settings` gives typed, validated config with a single source of truth. Reading
`os.environ` scattered through the code is the thing this replaces: a typo in a variable name
becomes a startup error here instead of a `None` that surfaces three layers deep at request time.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="STAYHUB_",
        extra="ignore",
    )

    app_name: str = "StayHub API"
    api_v1_prefix: str = "/api/v1"

    database_url: str = "postgresql+psycopg://stayhub:stayhub@localhost:5433/stayhub"

    # Shared with Hasura. See docker-compose.yml — if these two ever drift, every authenticated
    # GraphQL query fails while the REST API keeps working, which is a confusing way to find out.
    jwt_secret: str = "dev-only-change-me-in-any-real-deployment-0123456789"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7

    elasticsearch_url: str = "http://localhost:9200"
    elasticsearch_index: str = "stayhub-properties"

    log_level: str = "INFO"
    # Human-readable locally, JSON wherever something is collecting it. Default off so `uvicorn
    # --reload` stays readable; the Dockerfile sets STAYHUB_LOG_JSON=true.
    log_json: bool = False

    # Uploads. 5 MB is generous for a listing photo and small enough that a hostile client cannot
    # fill the disk one request at a time.
    max_upload_bytes: int = 5 * 1024 * 1024
    upload_dir: str = "uploads"

    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    # Public by design — it identifies the account and can only create payment attempts, never
    # move money. The API hands it to the browser alongside the client_secret so the frontend
    # needs no Stripe configuration of its own.
    stripe_publishable_key: str = ""

    # The two Vite dev servers. Anything else fails CORS, and the symptom in the browser is a
    # blank page rather than an error anyone would recognise.
    cors_origins: list[str] = [
        "http://localhost:5174",
        "http://localhost:5175",
    ]

    # A guest may cancel until this many days before check-in. The README's rule, in one place.
    cancellation_cutoff_days: int = 2

    # What StayHub charges on top of the host's nightly rate.
    service_fee_rate: float = 0.12


@lru_cache
def get_settings() -> Settings:
    """Cached so the .env file is parsed once per process, not once per request."""
    return Settings()


settings = get_settings()
