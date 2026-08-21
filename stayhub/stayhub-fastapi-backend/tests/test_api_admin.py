"""The paginated admin endpoints, through the HTTP layer.

This is the file to read for `dependency_overrides`. Two things are swapped out:

  get_db          -> the rollback session from conftest, so these tests leave no trace
  get_current_user -> a fixed admin, so no login round trip and no real password

⚠️ The override targets the FUNCTION OBJECT, not its name or its path. `app.dependency_overrides`
is a plain dict keyed by the callable itself, so importing `get_db` from a different module than
the app did — or overriding `deps.get_current_user` when routes actually depend on the
`CurrentUser` alias built from it — silently does nothing. The test then hits the real dependency,
which usually fails in a way that looks like a bug in the route.
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.core.deps import get_current_user
from app.db.session import get_db
from app.main import app
from app.models.booking import Booking
from app.models.enums import BookingStatus, PropertyStatus, UserRole
from app.models.property import Property
from app.models.user import User

TODAY = datetime.now(UTC).date()


@pytest.fixture
def admin(db) -> User:
    user = User(
        email=f"admin-{datetime.now(UTC).timestamp()}@stayhub.test",
        password_hash="x", first_name="Test", last_name="Admin",
        role=UserRole.ADMIN, is_host=False,
    )
    db.add(user)
    db.flush()
    return user


@pytest.fixture
def client(db, admin) -> TestClient:
    """A client whose requests run inside the test's transaction, authenticated as `admin`."""
    # Yield the SAME session the fixtures wrote into. Handing the route a fresh SessionLocal
    # instead would put it outside this transaction, so it would not see the rows above — and the
    # test would fail with an empty page that looks like a broken query.
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: admin
    yield TestClient(app)
    # ⚠️ Always clear. The dict lives on the app object, which is module-level and shared by every
    # test file in the run — a leftover override leaks into unrelated tests as a phantom failure.
    app.dependency_overrides.clear()


@pytest.fixture
def listing(db, admin) -> Property:
    prop = Property(
        host_id=admin.id, title="Pagination Test Listing", description="x",
        city="Testville", country="United States",
        price_per_night=Decimal("100.00"), max_guests=4, status=PropertyStatus.PUBLISHED,
    )
    db.add(prop)
    db.flush()
    return prop


def make_bookings(db, listing, guest, count: int, status=BookingStatus.CONFIRMED) -> None:
    for i in range(count):
        check_in = TODAY + timedelta(days=400 + i * 3)  # far out, so nothing collides with seed data
        db.add(Booking(
            property_id=listing.id, guest_id=guest.id,
            check_in=check_in, check_out=check_in + timedelta(days=2),
            guests=1, nights=2, nightly_rate=Decimal("100.00"), subtotal=Decimal("200.00"),
            cleaning_fee=Decimal("0"), service_fee=Decimal("24.00"), total=Decimal("224.00"),
            status=status,
        ))
    db.flush()


class TestListUsers:
    def test_it_returns_a_page_envelope_not_a_bare_list(self, client):
        body = client.get("/api/v1/admin/users").json()
        assert set(body) == {"items", "total", "page", "pageSize"}

    def test_the_total_counts_everything_not_just_the_page(self, client, db):
        for i in range(5):
            db.add(User(
                email=f"page-{i}-{datetime.now(UTC).timestamp()}@stayhub.test",
                password_hash="x", first_name="P", last_name=str(i), role=UserRole.CUSTOMER,
            ))
        db.flush()

        body = client.get("/api/v1/admin/users?pageSize=2").json()
        assert len(body["items"]) == 2
        assert body["total"] >= 6  # the 5 above plus the admin fixture

    def test_pages_do_not_repeat_rows(self, client):
        """The ORDER BY test. Without it Postgres may return an already-seen row on page 2."""
        first = client.get("/api/v1/admin/users?pageSize=2&page=1").json()["items"]
        second = client.get("/api/v1/admin/users?pageSize=2&page=2").json()["items"]
        ids = [u["publicId"] for u in first + second]
        assert len(ids) == len(set(ids))

    def test_the_search_filter_applies_to_the_total_as_well(self, client, db):
        stamp = str(datetime.now(UTC).timestamp()).replace(".", "")
        db.add(User(
            email=f"findme-{stamp}@stayhub.test", password_hash="x",
            first_name="Findme", last_name="Unique", role=UserRole.CUSTOMER,
        ))
        db.flush()

        body = client.get(f"/api/v1/admin/users?q=findme-{stamp}").json()
        # ⚠️ The assertion that catches "filtered the rows but counted the whole table" — the bug
        # where the page looks perfect and only the pager is wrong.
        assert body["total"] == 1
        assert len(body["items"]) == 1

    def test_the_search_is_case_insensitive(self, client, db):
        stamp = str(datetime.now(UTC).timestamp()).replace(".", "")
        db.add(User(
            email=f"mixedcase-{stamp}@stayhub.test", password_hash="x",
            first_name="Mixed", last_name="Case", role=UserRole.CUSTOMER,
        ))
        db.flush()
        assert client.get(f"/api/v1/admin/users?q=MIXEDCASE-{stamp}").json()["total"] == 1

    def test_a_quote_in_the_query_is_a_value_not_syntax(self, client):
        """Parameterised, not interpolated. If this 500s, a string is being built into SQL."""
        r = client.get("/api/v1/admin/users?q=%27%20OR%201%3D1%20--")
        assert r.status_code == 200
        assert r.json()["total"] == 0

    def test_page_size_is_capped(self, client):
        assert client.get("/api/v1/admin/users?pageSize=100000").status_code == 422

    def test_page_zero_is_rejected(self, client):
        assert client.get("/api/v1/admin/users?page=0").status_code == 422


class TestListBookings:
    def test_it_filters_by_status(self, client, db, listing, admin):
        make_bookings(db, listing, admin, 3, status=BookingStatus.CANCELLED)
        body = client.get("/api/v1/admin/bookings?status=CANCELLED").json()
        assert body["total"] >= 3
        assert {b["status"] for b in body["items"]} == {"CANCELLED"}

    def test_an_unknown_status_is_rejected_by_the_enum(self, client):
        assert client.get("/api/v1/admin/bookings?status=NOPE").status_code == 422

    def test_each_row_carries_the_joined_guest_and_listing(self, client, db, listing, admin):
        make_bookings(db, listing, admin, 1)
        body = client.get("/api/v1/admin/bookings?pageSize=100").json()
        row = next(b for b in body["items"] if b["propertyTitle"] == "Pagination Test Listing")
        assert row["guestEmail"] == admin.email


class TestAuthorization:
    def test_a_non_admin_is_refused(self, db, admin):
        """The override is what makes this cheap to test: swap in a plain customer and the same
        route must now refuse."""
        customer = User(
            email=f"cust-{datetime.now(UTC).timestamp()}@stayhub.test",
            password_hash="x", first_name="Plain", last_name="Customer", role=UserRole.CUSTOMER,
        )
        db.add(customer)
        db.flush()

        app.dependency_overrides[get_db] = lambda: db
        app.dependency_overrides[get_current_user] = lambda: customer
        try:
            assert TestClient(app).get("/api/v1/admin/users").status_code == 403
        finally:
            app.dependency_overrides.clear()

    def test_an_anonymous_caller_is_refused(self, db):
        app.dependency_overrides[get_db] = lambda: db
        try:
            # No user override at all, so the real bearer dependency runs and finds no header.
            assert TestClient(app).get("/api/v1/admin/users").status_code == 401
        finally:
            app.dependency_overrides.clear()
