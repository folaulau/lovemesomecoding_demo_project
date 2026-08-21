"""Upload guards, each one actually fired.

Every check in routes/uploads.py is a security control, and a security control that has never been
observed to reject anything is a comment. One test per guard.
"""

import io
import shutil
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.deps import get_current_user
from app.db.session import get_db
from app.main import app
from app.models.enums import PropertyStatus, UserRole
from app.models.property import Property
from app.models.user import User

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64
WEBP = b"RIFF" + b"\x00\x00\x00\x00" + b"WEBP" + b"\x00" * 64
NOT_AN_IMAGE = b"<?php system($_GET['c']); ?>"


@pytest.fixture
def host(db) -> User:
    user = User(
        email=f"uphost-{datetime.now(UTC).timestamp()}@stayhub.test",
        password_hash="x", first_name="Up", last_name="Host",
        role=UserRole.CUSTOMER, is_host=True,
    )
    db.add(user)
    db.flush()
    return user


@pytest.fixture
def listing(db, host) -> Property:
    prop = Property(
        host_id=host.id, title="Upload Test Listing", description="x",
        city="Testville", country="United States",
        price_per_night=Decimal("100.00"), max_guests=2, status=PropertyStatus.PUBLISHED,
    )
    db.add(prop)
    db.flush()
    return prop


@pytest.fixture
def client(db, host, listing) -> TestClient:
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: host
    yield TestClient(app)
    app.dependency_overrides.clear()
    # Anything written to disk is outside the database transaction, so the rollback does not undo
    # it. These tests clean up after themselves explicitly.
    shutil.rmtree(Path(settings.upload_dir) / str(listing.public_id), ignore_errors=True)


def post(client, listing, content: bytes, name: str, content_type: str):
    return client.post(
        f"/api/v1/uploads/property-image/{listing.public_id}",
        files={"file": (name, io.BytesIO(content), content_type)},
    )


class TestAccepts:
    @pytest.mark.parametrize(
        "content, name, ctype",
        [(PNG, "a.png", "image/png"), (JPEG, "a.jpg", "image/jpeg"), (WEBP, "a.webp", "image/webp")],
    )
    def test_it_stores_a_real_image(self, client, listing, content, name, ctype):
        r = post(client, listing, content, name, ctype)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["contentType"] == ctype
        assert body["sizeBytes"] == len(content)
        assert Path(settings.upload_dir, str(listing.public_id), body["filename"]).exists()

    def test_the_stored_name_is_generated_not_the_clients(self, client, listing):
        body = post(client, listing, PNG, "my holiday photo.png", "image/png").json()
        assert "holiday" not in body["filename"]
        assert body["filename"].endswith(".png")

    def test_two_uploads_of_the_same_name_do_not_collide(self, client, listing):
        first = post(client, listing, PNG, "same.png", "image/png").json()["filename"]
        second = post(client, listing, PNG, "same.png", "image/png").json()["filename"]
        assert first != second


class TestRejects:
    def test_a_declared_type_that_is_not_allowed(self, client, listing):
        r = post(client, listing, NOT_AN_IMAGE, "shell.php", "application/x-php")
        assert r.status_code == 400
        assert "JPEG, PNG or WebP" in r.json()["message"]

    def test_a_forged_content_type(self, client, listing):
        """The guard that matters: a PHP payload labelled image/png.

        Checking only `file.content_type` accepts this, because that header is whatever the client
        typed. Sniffing the leading bytes is what catches it.
        """
        r = post(client, listing, NOT_AN_IMAGE, "shell.png", "image/png")
        assert r.status_code == 400
        assert "not the image type it claims" in r.json()["message"]

    def test_a_png_labelled_as_jpeg(self, client, listing):
        """Also caught — the sniffed type must MATCH the declared one, not merely be some image."""
        assert post(client, listing, PNG, "x.jpg", "image/jpeg").status_code == 400

    def test_a_file_over_the_size_limit(self, client, listing):
        oversize = PNG + b"\x00" * (settings.max_upload_bytes + 1)
        r = post(client, listing, oversize, "big.png", "image/png")
        assert r.status_code == 400
        assert "larger than" in r.json()["message"]

    def test_an_oversize_upload_leaves_no_partial_file(self, client, listing):
        post(client, listing, PNG + b"\x00" * (settings.max_upload_bytes + 1), "b.png", "image/png")
        stored = Path(settings.upload_dir) / str(listing.public_id)
        # The write is aborted mid-stream, so the cleanup in the `except` is the only thing
        # standing between this and a 5 MB fragment on disk per rejected request.
        assert not any(stored.iterdir()) if stored.exists() else True

    def test_a_listing_someone_else_owns(self, db, client, host):
        stranger = User(
            email=f"stranger-{datetime.now(UTC).timestamp()}@stayhub.test",
            password_hash="x", first_name="Some", last_name="Stranger",
            role=UserRole.CUSTOMER, is_host=True,
        )
        db.add(stranger)
        db.flush()
        other = Property(
            host_id=stranger.id, title="Not Yours", description="x",
            city="Elsewhere", country="United States",
            price_per_night=Decimal("50.00"), max_guests=1, status=PropertyStatus.PUBLISHED,
        )
        db.add(other)
        db.flush()
        r = post(client, other, PNG, "a.png", "image/png")
        # 404, not 403 — a 403 would confirm the listing exists.
        assert r.status_code == 404


class TestDelete:
    def test_it_removes_the_file(self, client, listing):
        name = post(client, listing, PNG, "a.png", "image/png").json()["filename"]
        path = Path(settings.upload_dir, str(listing.public_id), name)
        assert path.exists()

        assert client.delete(
            f"/api/v1/uploads/property-image/{listing.public_id}/{name}"
        ).status_code == 200
        assert not path.exists()

    def test_path_traversal_is_refused(self, client, listing):
        """`....//` and encoded separators are why the guard resolves paths instead of looking
        for '..' in the string."""
        for attempt in ["..%2F..%2F.env", "....//....//.env", "%2e%2e%2f.env"]:
            r = client.delete(f"/api/v1/uploads/property-image/{listing.public_id}/{attempt}")
            assert r.status_code == 404, attempt
        # The thing it was reaching for is still there.
        assert Path(".env").exists()
