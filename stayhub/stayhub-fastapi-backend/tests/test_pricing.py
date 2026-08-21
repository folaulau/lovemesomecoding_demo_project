"""Pricing — the security boundary for money."""

from decimal import Decimal
from datetime import date

import pytest

from app.models.property import Property
from app.services import pricing_service


def make_property(price: str, cleaning: str = "0") -> Property:
    # A detached ORM object, never added to a session. Pricing only reads two fields, so a
    # database is not needed to test it — which is the point of keeping the rule in its own module.
    return Property(price_per_night=Decimal(price), cleaning_fee=Decimal(cleaning))


@pytest.mark.parametrize(
    "check_in,check_out,expected",
    [
        (date(2026, 9, 1), date(2026, 9, 2), 1),   # one night, not two
        (date(2026, 9, 1), date(2026, 9, 4), 3),
        (date(2026, 9, 28), date(2026, 10, 2), 4), # across a month boundary
        (date(2026, 2, 27), date(2026, 3, 1), 2),  # 2026 is not a leap year
        (date(2024, 2, 27), date(2024, 3, 1), 3),  # 2024 is
    ],
)
def test_nights_are_half_open(check_in, check_out, expected):
    """Check-in counts, check-out does not. Counting both ends overcharges by a night."""
    assert pricing_service.nights_between(check_in, check_out) == expected


def test_quote_adds_cleaning_and_service_fee():
    prop = make_property("100.00", "50.00")
    quote = pricing_service.quote(prop, date(2026, 9, 1), date(2026, 9, 4))

    assert quote.nights == 3
    assert quote.subtotal == Decimal("300.00")
    assert quote.cleaning_fee == Decimal("50.00")
    # 12% of the STAY, not of the cleaning fee — that is a cost pass-through, not revenue.
    assert quote.service_fee == Decimal("36.00")
    assert quote.total == Decimal("386.00")


def test_service_fee_ignores_the_cleaning_fee():
    """Two listings with the same nightly rate must charge the same service fee, however
    different their cleaning fees are."""
    cheap = pricing_service.quote(make_property("200.00", "0"), date(2026, 9, 1), date(2026, 9, 3))
    pricey = pricing_service.quote(make_property("200.00", "500"), date(2026, 9, 1), date(2026, 9, 3))
    assert cheap.service_fee == pricey.service_fee


def test_money_is_exact_not_floating_point():
    """⚠️ The reason every amount is Decimal. 0.1 + 0.2 != 0.3 in binary floating point, and
    a nightly rate of 33.33 over 3 nights is exactly the shape that exposes it."""
    quote = pricing_service.quote(make_property("33.33"), date(2026, 9, 1), date(2026, 9, 4))
    assert quote.subtotal == Decimal("99.99")
    # The float version of this arithmetic gives 99.99000000000001.
    assert str(quote.subtotal) == "99.99"


@pytest.mark.parametrize(
    "raw,expected",
    [("0.125", "0.13"), ("0.135", "0.14"), ("2.005", "2.01"), ("1.004", "1.00")],
)
def test_rounding_is_half_up_not_bankers(raw, expected):
    """⚠️ Python's default is ROUND_HALF_EVEN ("banker's rounding"), which sends 0.125 DOWN to
    0.12 and 0.135 UP to 0.14 — it rounds to the nearest EVEN digit. Guests expect what a shop
    till does, and Stripe rounds half-up too, so a mismatch shows up as a one-cent discrepancy
    nobody can explain.

    This tests `_money` directly rather than going through `quote`, because 12% of a 2-decimal
    subtotal can never land exactly on a half-cent — the rule is real, but that path cannot reach
    it. Testing the rule where it lives is the honest option.
    """
    assert pricing_service._money(Decimal(raw)) == Decimal(expected)


def test_the_default_rounding_would_have_been_wrong():
    """Proof the parametrised case above is not vacuous: Python's own default disagrees."""
    assert round(Decimal("0.125"), 2) == Decimal("0.12")      # banker's — what we do NOT want
    assert pricing_service._money(Decimal("0.125")) == Decimal("0.13")  # half-up — what we do


def test_every_figure_is_quantized_to_cents():
    quote = pricing_service.quote(make_property("199.995", "0.001"), date(2026, 9, 1), date(2026, 9, 3))
    for amount in (quote.nightly_rate, quote.subtotal, quote.cleaning_fee,
                   quote.service_fee, quote.total):
        assert amount.as_tuple().exponent == -2, f"{amount} is not exactly 2 decimal places"


def test_total_is_the_sum_of_its_parts():
    quote = pricing_service.quote(make_property("187.77", "63.50"), date(2026, 9, 1), date(2026, 9, 6))
    assert quote.total == quote.subtotal + quote.cleaning_fee + quote.service_fee
