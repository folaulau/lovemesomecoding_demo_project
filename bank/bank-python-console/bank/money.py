"""Money helpers.

**Never use float for money.** `0.1 + 0.2` is `0.30000000000000004` in Python exactly as it is in
Java, because both use binary floating point and neither can represent 0.1 exactly. Python's answer
is `decimal.Decimal` — and unlike Java's BigDecimal it keeps the normal operators, so `a + b` works
and reads like arithmetic.

The one rule that catches everyone: build a Decimal from a **string**, never from a float.
`Decimal(0.1)` is 0.1000000000000000055511151231257827 because the float was already wrong before
Decimal saw it. `Decimal("0.1")` is exactly 0.1.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

# Module-level constants. UPPER_CASE by convention; Python has no `final`, the naming is the
# contract. Two places is one decimal point, currency style.
CENTS = Decimal("0.01")
ZERO = Decimal("0.00")

#: The per-transaction cap, so a fat-fingered extra zero is caught rather than deposited.
MAX_TRANSACTION = Decimal("50000.00")


def money(value: str | int | Decimal) -> Decimal:
    """Build a rounded Decimal.

    `str(value)` first, so passing a float still goes through the string route rather than
    inheriting the float's error. Being forgiving here costs nothing and removes a whole class of
    bug from every caller.
    """
    return round_money(Decimal(str(value)))


def round_money(value: Decimal) -> Decimal:
    """Round to cents.

    ROUND_HALF_UP is what people expect: 2.345 becomes 2.35. Python's *default* is
    ROUND_HALF_EVEN ("banker's rounding"), which sends 2.345 to 2.34 — statistically fairer over
    many roundings, and completely baffling on a single receipt. State the rounding you want.
    """
    return value.quantize(CENTS, rounding=ROUND_HALF_UP)


def parse_money(text: str) -> Decimal:
    """Parse typed input, tolerating "$1,200.50" as well as "1200.5".

    Raises:
        ValueError: when the text is not a number at all.
    """
    cleaned = text.strip().replace("$", "").replace(",", "")
    if not cleaned:
        raise ValueError("No amount entered")
    try:
        return round_money(Decimal(cleaned))
    except InvalidOperation as error:
        # Decimal raises InvalidOperation, which nobody expects to catch. Re-raise as the ValueError
        # every caller already handles. `from error` keeps the original in the traceback — dropping
        # it is how you lose the line that actually broke.
        raise ValueError(f"'{text}' is not an amount") from error


def format_money(value: Decimal) -> str:
    """'$1,250.00'. The `,` in the format spec inserts thousands separators; `.2f` fixes it at cents."""
    # A negative reads as -$40.00 rather than $-40.00, which is how a statement is written.
    sign = "-" if value < 0 else ""
    return f"{sign}${abs(value):,.2f}"


def to_csv(value: Decimal) -> str:
    """The plain '1250.00' form written to file — no currency symbol, no separators."""
    return f"{round_money(value):f}"
