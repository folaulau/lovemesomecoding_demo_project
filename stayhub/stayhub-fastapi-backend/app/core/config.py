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
    # ⚠️ An ALIAS, not an index. `app/search/index.py` keeps the concrete indices behind it
    # (`stayhub-properties-000001`, …) so a mapping change can be a reindex + alias flip with no
    # downtime instead of a delete and a rebuild.
    elasticsearch_index: str = "stayhub-properties"

    # Credentials — EMPTY by default, because the default cluster in docker-compose.yml runs with
    # `xpack.security.enabled: false` and would reject a request that carried them.
    #
    # `docker compose --profile secure up -d elasticsearch-secure` starts a second cluster on 9201
    # with security ON. Point `elasticsearch_url` at it and set ONE of these:
    #
    #   elasticsearch_api_key   preferred. Scoped to exactly the privileges this app needs, and
    #                           revocable on its own without touching any other client.
    #   elasticsearch_username / _password
    #                           the `elastic` superuser is a bootstrap credential, not a runtime
    #                           one. Anything that can read your index can also delete every index
    #                           in the cluster.
    #
    # See scripts/es_security.py, which mints the scoped key.
    elasticsearch_api_key: str = ""
    elasticsearch_username: str = ""
    elasticsearch_password: str = ""

    # ⚠️ 6380, not Redis's default 6379 — same reason Postgres is on 5433. Redis is the single
    # most commonly already-running service on a developer machine (Homebrew installs one, and
    # half the other projects on this box ship one in Compose). Binding the default means StayHub
    # silently shares a keyspace with whatever else is there, and the symptom is not an error: it
    # is another project's keys in your cache and yours in theirs.
    redis_url: str = "redis://localhost:6380/0"

    # How long a cached listing may be stale. Five minutes is a backstop, not the mechanism —
    # every write path invalidates explicitly, so this only bounds the damage from a write path
    # that forgets to. See the module docstring in core/cache.py.
    cache_ttl_property_seconds: int = 300

    # Rate limits, as "this many at once, refilling over this many seconds".
    #
    # Login is strict because the endpoint guards a password: 10 attempts, refilling over 5
    # minutes. A person who mistypes twice never notices; a script trying a wordlist gets 10 tries
    # per five minutes per address, which turns a feasible attack into an infeasible one.
    #
    # Search is generous because it is protecting a SERVER, not a secret: 60 at once, refilling
    # over a minute. Nobody browsing can reach that; a runaway `while True` loop reaches it in
    # under a second, which is exactly who it is for.
    rate_limit_login_capacity: int = 10
    rate_limit_login_seconds: int = 300
    rate_limit_search_capacity: int = 60
    rate_limit_search_seconds: int = 60

    # The off switch. Rate limiting that cannot be turned off without a deploy is rate limiting you
    # cannot turn off during the incident it is causing.
    rate_limit_enabled: bool = True

    log_level: str = "INFO"
    # Human-readable locally, JSON wherever something is collecting it. Default off so `uvicorn
    # --reload` stays readable; the Dockerfile sets STAYHUB_LOG_JSON=true.
    log_json: bool = False

    # Uploads. 5 MB is generous for a listing photo and small enough that a hostile client cannot
    # fill the disk one request at a time.
    max_upload_bytes: int = 5 * 1024 * 1024
    upload_dir: str = "uploads"

    # ---------------------------------------------------------------------
    # OAuth2 sign-in with a provider
    # ---------------------------------------------------------------------
    # Empty by default, and `get_provider` raises when they are. A provider is switched ON by
    # supplying credentials, not by a feature flag — one source of truth instead of a flag and a
    # secret that can disagree.
    oauth_google_client_id: str = ""
    oauth_google_client_secret: str = ""
    oauth_github_client_id: str = ""
    oauth_github_client_secret: str = ""

    # ⚠️ The base the redirect_uri is BUILT from, and it must match what is registered in the
    # provider's console character for character — scheme, host, port, path, trailing slash.
    # Google compares the string, not the URL: http vs https, or a stray slash, is
    # `redirect_uri_mismatch` and nothing else. Deriving it from the request's Host header instead
    # would follow whatever a proxy put there. See `oauth.redirect_uri_for`.
    oauth_redirect_base: str = "http://localhost:8000"

    # Where the callback sends the browser once StayHub has minted its own token.
    oauth_success_redirect: str = "http://localhost:5174/auth/callback"

    # How long someone has to finish signing in at the provider. Ten minutes is generous for a
    # consent screen and short enough that an abandoned `state` is not sitting in Redis for hours.
    oauth_state_ttl_seconds: int = 600

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
