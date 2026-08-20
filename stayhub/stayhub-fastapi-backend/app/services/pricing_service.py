"""Every figure a guest is charged is computed here, and only here.

This module is the security boundary for money. The client sends dates and a guest count; it never
sends a price. If a total can be influenced by a request body, the API can be talked into selling
a $400 stay for $4.

⚠️ Decimal throughout, never float. `0.1 + 0.2 == 0.30000000000000004` in binary floating point,
and a booking total is the last place that should be true.
"""

from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from app.core.config import settings
from app.models.property import Property
from app.schemas.booking import PriceBreakdown

CENTS = Decimal("0.01")


def _money(value: Decimal) -> Decimal:
    """Round to cents, half-up.

    ⚠️ Python's default is ROUND_HALF_EVEN ("banker's rounding"), so `round(Decimal("0.125"), 2)`
    gives 0.12, not 0.13. That is a defensible convention and the wrong one here: guests expect
    what a shop till does, and a mismatch with Stripe's own half-up rounding shows up as a
    one-cent discrepancy nobody can explain.
    """
    return value.quantize(CENTS, rounding=ROUND_HALF_UP)


def nights_between(check_in: date, check_out: date) -> int:
    """Half-open: check-in counts, check-out does not.

    A stay from the 1st to the 2nd is ONE night. Counting both ends is the single most common
    booking bug, and it overcharges — which is the version customers notice.
    """
    return (check_out - check_in).days


def quote(prop: Property, check_in: date, check_out: date) -> PriceBreakdown:
    nights = nights_between(check_in, check_out)
    nightly_rate = Decimal(prop.price_per_night)

    subtotal = _money(nightly_rate * nights)
    cleaning_fee = _money(Decimal(prop.cleaning_fee))

    # StayHub's cut, charged on the stay only — not on the cleaning fee, which is the host's cost
    # pass-through rather than revenue.
    service_fee = _money(subtotal * Decimal(str(settings.service_fee_rate)))

    total = _money(subtotal + cleaning_fee + service_fee)

    return PriceBreakdown(
        nights=nights,
        nightly_rate=_money(nightly_rate),
        subtotal=subtotal,
        cleaning_fee=cleaning_fee,
        service_fee=service_fee,
        total=total,
    )
