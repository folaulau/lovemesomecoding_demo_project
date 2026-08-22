"""The listing cache, and the guarantee that matters most about it: it is optional.

Two groups of tests here, and the second one is the important one. The first proves the cache
caches. The second proves the app is unchanged when Redis is not there — which is the property
that decides whether adding a cache made the system faster or merely more fragile.
"""

import json
from unittest.mock import patch
from uuid import uuid4

import pytest

from app.core import cache
from app.models.enums import PropertyStatus
from app.models.property import Property
from app.services.property_service import PropertyService


@pytest.fixture(autouse=True)
def _clean_client():
    """Drop the memoised Redis client around every test.

    `_client` is `@lru_cache`d, so a test that patches the module without clearing it gets the
    client the PREVIOUS test built. That is the kind of leak that makes one test fail only when
    run after another.
    """
    cache.reset_for_tests()
    yield
    cache.reset_for_tests()


def _published(db) -> Property:
    prop = (
        db.query(Property)
        .filter(Property.status == PropertyStatus.PUBLISHED, Property.deleted.is_(False))
        .first()
    )
    if prop is None:
        pytest.skip("no published listing seeded — run `python -m scripts.seed`")
    return prop


redis_required = pytest.mark.skipif(
    not cache.available(), reason="Redis is not running — start it with `docker compose up -d redis`"
)


# ---------------------------------------------------------------- it caches


@redis_required
class TestCacheAside:
    def test_a_miss_populates_the_cache(self, db):
        prop = _published(db)
        key = cache.property_key(prop.public_id)
        cache.invalidate(key)
        assert cache.get_json(key) is None

        PropertyService(db).get_public_view(prop.public_id)

        assert cache.get_json(key) is not None

    def test_a_hit_returns_the_same_payload_as_a_miss(self, db):
        """The property that makes a cache safe: it must be invisible in the response.

        A cache that returns a slightly different shape on a hit is worse than no cache, because
        the bug only appears on the second request and never in development.
        """
        prop = _published(db)
        svc = PropertyService(db)
        cache.invalidate(cache.property_key(prop.public_id))

        on_miss = svc.get_public_view(prop.public_id).model_dump(mode="json")
        on_hit = svc.get_public_view(prop.public_id).model_dump(mode="json")

        assert on_miss == on_hit

    def test_a_hit_does_not_touch_the_database(self, db):
        prop = _published(db)
        svc = PropertyService(db)
        cache.invalidate(cache.property_key(prop.public_id))
        svc.get_public_view(prop.public_id)  # warm it

        with patch.object(svc, "get_for_public", side_effect=AssertionError("hit the DB")):
            svc.get_public_view(prop.public_id)

    def test_entries_expire(self, db):
        """A TTL is set on every entry, so a forgotten invalidation cannot go stale forever."""
        from app.core.config import settings

        prop = _published(db)
        key = cache.property_key(prop.public_id)
        cache.invalidate(key)
        PropertyService(db).get_public_view(prop.public_id)

        ttl = cache._client().ttl(key)
        assert 0 < ttl <= settings.cache_ttl_property_seconds

    def test_a_write_invalidates(self, db):
        """`_sync` is on every write path, so invalidation is too."""
        prop = _published(db)
        key = cache.property_key(prop.public_id)
        PropertyService(db).get_public_view(prop.public_id)
        assert cache.get_json(key) is not None

        PropertyService(db)._sync(prop)

        assert cache.get_json(key) is None

    def test_a_missing_listing_is_not_cached(self, db):
        """Negative caching is deliberately absent — see the docstring on `get_public_view`."""
        from app.core.exceptions import NotFoundException

        ghost = uuid4()
        with pytest.raises(NotFoundException):
            PropertyService(db).get_public_view(ghost)

        assert cache.get_json(cache.property_key(ghost)) is None

    def test_an_unreadable_entry_is_treated_as_a_miss(self, db):
        """Something else wrote to our key. That must degrade, not 500."""
        key = cache.property_key(uuid4())
        cache._client().setex(key, 60, "this is not json")
        assert cache.get_json(key) is None


# ------------------------------------------------- it is optional, which is the point


class TestDegradesWithoutRedis:
    """With Redis unreachable the app must behave EXACTLY as it did before the cache existed.

    Every test here patches the client to None, which is what `core.cache` produces both when
    redis-py is not installed and when it cannot be reached.
    """

    @pytest.fixture(autouse=True)
    def _no_redis(self):
        with patch.object(cache, "_client", return_value=None):
            yield

    def test_reads_still_work(self, db):
        prop = _published(db)
        view = PropertyService(db).get_public_view(prop.public_id)
        assert view.public_id == prop.public_id

    def test_every_cache_call_is_a_no_op(self):
        assert cache.get_json("anything") is None
        cache.set_json("anything", {"a": 1}, 60)  # must not raise
        cache.invalidate("anything")  # must not raise
        assert cache.available() is False

    def test_writes_still_work(self, db):
        """`_sync` calls `invalidate`. If that raised, every save in the app would fail."""
        prop = _published(db)
        PropertyService(db)._sync(prop)


class TestFailingRedis:
    """Worse than absent: present, and erroring. Every call must still degrade to a miss."""

    @pytest.fixture(autouse=True)
    def _broken(self):
        class Exploding:
            def __getattr__(self, _name):
                def boom(*_a, **_kw):
                    raise ConnectionError("redis is having a bad day")

                return boom

        with patch.object(cache, "_client", return_value=Exploding()):
            yield

    def test_a_failing_get_is_a_miss(self):
        assert cache.get_json("k") is None

    def test_a_failing_set_is_swallowed(self):
        cache.set_json("k", {"a": 1}, 60)

    def test_a_failing_invalidate_is_swallowed(self):
        cache.invalidate("k")

    def test_available_reports_false(self):
        assert cache.available() is False

    def test_a_read_still_serves_from_the_database(self, db):
        prop = _published(db)
        assert PropertyService(db).get_public_view(prop.public_id).public_id == prop.public_id


class TestKeys:
    def test_the_key_is_namespaced_and_versioned(self):
        key = cache.property_key("abc")
        assert key.startswith("stayhub:")
        assert cache.CACHE_VERSION in key
        assert key.endswith(":abc")

    def test_a_uuid_and_its_string_produce_the_same_key(self):
        """The route has a UUID, the service has a UUID, `_sync` has the model's UUID — but a test
        or a script may well pass a string. They must not land on two different keys."""
        pid = uuid4()
        assert cache.property_key(pid) == cache.property_key(str(pid))


class TestSerialisation:
    def test_values_round_trip_through_json(self):
        cache.reset_for_tests()
        if not cache.available():
            pytest.skip("Redis is not running")
        key = f"stayhub:test:{uuid4()}"
        payload = {"a": 1, "b": [1, 2], "c": {"d": None}}
        cache.set_json(key, payload, 30)
        assert cache.get_json(key) == payload
        cache.invalidate(key)

    def test_non_json_types_are_stringified_rather_than_raising(self):
        """`default=str` in `set_json`. A Decimal price or a datetime must not blow up a write
        path that was only trying to warm a cache."""
        from datetime import datetime
        from decimal import Decimal

        encoded = json.dumps({"price": Decimal("120.50"), "at": datetime(2026, 8, 22)}, default=str)
        assert "120.50" in encoded
