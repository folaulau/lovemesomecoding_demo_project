"""Password hashing, and the JWT that Hasura also verifies."""

import pytest
from jose import jwt

from app.core.config import settings
from app.core.security import (
    HASURA_CLAIMS_NAMESPACE,
    create_access_token,
    decode_access_token,
    hash_password,
    hasura_roles,
    verify_password,
)


def test_password_round_trip():
    hashed = hash_password("correct horse battery staple")
    assert verify_password("correct horse battery staple", hashed)
    assert not verify_password("wrong horse battery staple", hashed)


def test_hashes_are_salted():
    """The same password twice must not produce the same hash, or a leaked table reveals which
    accounts share a password."""
    assert hash_password("same-password") != hash_password("same-password")


def test_the_hash_is_not_the_password():
    hashed = hash_password("plaintext-please-no")
    assert "plaintext-please-no" not in hashed


def test_long_passwords_do_not_explode():
    """⚠️ bcrypt truncates at 72 BYTES and some bindings raise rather than truncate. The service
    truncates explicitly so a 200-character passphrase is accepted rather than 500ing."""
    long_password = "a" * 200
    hashed = hash_password(long_password)
    assert verify_password(long_password, hashed)


class TestHasuraRoles:
    def test_a_plain_customer(self):
        default, allowed = hasura_roles("CUSTOMER", is_host=False)
        assert default == "customer"
        assert "host" not in allowed

    def test_a_host_is_also_a_customer(self):
        """Hosting is a MODE, not a rank — a host still books stays."""
        default, allowed = hasura_roles("CUSTOMER", is_host=True)
        assert default == "host"
        assert "customer" in allowed

    def test_staff_is_never_called_admin(self):
        """⚠️ `admin` is RESERVED in Hasura: it is what the admin SECRET grants, it always
        bypasses every permission, and metadata cannot define rules for it. Minting a token with
        that role would produce a user whose permissions can never be declared."""
        default, allowed = hasura_roles("ADMIN", is_host=False)
        assert default == "staff"
        assert "admin" not in allowed


class TestAccessToken:
    def test_it_carries_the_hasura_claims_namespace(self):
        token = create_access_token(user_public_id="abc-123", role="CUSTOMER", is_host=False)
        claims = decode_access_token(token)
        assert claims is not None
        assert HASURA_CLAIMS_NAMESPACE in claims

    def test_every_hasura_claim_is_a_string(self):
        """⚠️ Hasura compares session variables as TEXT. A JSON number or boolean here fails
        inside a permission check, blaming the table rather than the token."""
        token = create_access_token(user_public_id="abc-123", role="CUSTOMER", is_host=True)
        claims = decode_access_token(token)[HASURA_CLAIMS_NAMESPACE]

        for key, value in claims.items():
            if key == "x-hasura-allowed-roles":
                assert all(isinstance(role, str) for role in value)
            else:
                assert isinstance(value, str), f"{key} is {type(value).__name__}, not str"

    def test_the_default_role_is_in_the_allowed_list(self):
        for role, is_host in (("CUSTOMER", False), ("CUSTOMER", True), ("ADMIN", False)):
            claims = decode_access_token(
                create_access_token(user_public_id="x", role=role, is_host=is_host)
            )[HASURA_CLAIMS_NAMESPACE]
            assert claims["x-hasura-default-role"] in claims["x-hasura-allowed-roles"]

    def test_a_tampered_token_is_rejected(self):
        token = create_access_token(user_public_id="abc", role="CUSTOMER", is_host=False)
        header, payload, signature = token.split(".")
        forged = f"{header}.{payload}.{signature[:-4]}AAAA"
        assert decode_access_token(forged) is None

    def test_a_token_signed_with_another_key_is_rejected(self):
        """The whole basis of the FastAPI ↔ Hasura trust: only the shared secret can mint one."""
        forged = jwt.encode(
            {"sub": "attacker", HASURA_CLAIMS_NAMESPACE: {"x-hasura-default-role": "staff"}},
            "not-the-real-secret",
            algorithm=settings.jwt_algorithm,
        )
        assert decode_access_token(forged) is None

    def test_garbage_is_rejected_without_raising(self):
        for junk in ("", "not-a-token", "a.b.c", "..."):
            assert decode_access_token(junk) is None
