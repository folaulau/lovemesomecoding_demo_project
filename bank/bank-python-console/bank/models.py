"""The things the bank is made of: users, accounts, transactions.

Two Python features carry this file:

* `Enum` for the fixed sets of values, so a typo like "CHEKING" fails loudly instead of quietly.
* `@dataclass` for the value-holding classes — it writes `__init__`, `__repr__` and `__eq__` from
  the annotated fields, which is the same job Java's `record` does. `frozen=True` makes instances
  immutable, the equivalent of a record's final fields.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from enum import Enum

from .money import ZERO, format_money, round_money


class AccountType(Enum):
    """The kinds of account. The value is the human label; the *name* is what goes in the CSV."""

    CHECKING = "Checking"
    SAVINGS = "Savings"

    @property
    def label(self) -> str:
        return self.value

    @classmethod
    def from_csv(cls, value: str) -> "AccountType":
        """Parse the CSV value, with a message that names the file's problem.

        A @classmethod receives the class as `cls`, which is what lets it return an instance. This
        is Python's usual way of writing an alternative constructor.
        """
        try:
            return cls[value.strip().upper()]  # Look up by NAME. cls(value) looks up by value.
        except KeyError as error:
            raise ValueError(f"Unknown account type in CSV: {value}") from error


class TransactionType(Enum):
    """Every way money can move. Each member carries its label and whether it adds to the balance."""

    DEPOSIT = ("Deposit", True)
    WITHDRAWAL = ("Withdrawal", False)
    TRANSFER_IN = ("Transfer in", True)
    TRANSFER_OUT = ("Transfer out", False)

    def __init__(self, label: str, credit: bool) -> None:
        # An Enum whose value is a tuple gets it unpacked into __init__, which is how a member
        # ends up with more than one piece of data attached.
        self.label = label
        self.credit = credit

    def signed(self, amount: Decimal) -> Decimal:
        """The amount as a statement shows it: -25.00 for a withdrawal.

        Behaviour on the enum stops every caller writing the same if/else.
        """
        return amount if self.credit else -amount

    @classmethod
    def from_csv(cls, value: str) -> "TransactionType":
        try:
            return cls[value.strip().upper()]
        except KeyError as error:
            raise ValueError(f"Unknown transaction type in CSV: {value}") from error


@dataclass(frozen=True)
class User:
    """A customer. Frozen, because nothing in this app edits a user after loading them."""

    id: int
    email: str
    password: str
    full_name: str
    created_at: datetime

    def __post_init__(self) -> None:
        """Validation, run by the generated __init__ after the fields are set.

        On a frozen dataclass the fields cannot simply be reassigned — `self.email = ...` raises —
        so normalising one takes object.__setattr__, the same back door the generated __init__
        itself uses. Doing it here means an un-normalised User cannot exist anywhere in the app.
        """
        if not self.email or not self.email.strip():
            raise ValueError("A user must have an email")
        object.__setattr__(self, "email", self.email.strip().lower())

    @property
    def first_name(self) -> str:
        """'Alice' — the first word, for greeting the customer."""
        return self.full_name.split(" ")[0]

    def password_matches(self, attempt: str | None) -> bool:
        """⚠️ Plaintext comparison, deliberately, because this is a teaching fixture with throwaway
        data. Real software never stores a password it can read back: it stores a slow salted hash
        (bcrypt or argon2) and compares hashes. If you copy one method out of this project into
        something real, do not let it be this one.
        """
        return self.password == (attempt or "")


@dataclass
class Account:
    """One account. **Not** frozen, unlike User — the balance changes.

    `credit` and `debit` are the only ways to move the balance, and both enforce the rules. Python
    cannot truly stop someone writing `account.balance = -5`, the way Java's `private` can; the
    convention is that the methods are the door and reaching past them is on you.
    """

    id: int
    user_id: int
    type: AccountType
    number: str
    balance: Decimal = field(default=ZERO)

    def __post_init__(self) -> None:
        self.balance = round_money(self.balance)

    def credit(self, amount: Decimal) -> None:
        self._require_positive(amount)
        self.balance = round_money(self.balance + amount)

    def debit(self, amount: Decimal) -> None:
        """Remove money.

        Raises:
            RuntimeError: if the balance cannot cover it. The service checks first and raises the
                friendly InsufficientFundsError, so reaching this means a caller skipped it.
        """
        self._require_positive(amount)
        if self.balance < amount:
            raise RuntimeError("Balance cannot go negative")
        self.balance = round_money(self.balance - amount)

    def can_cover(self, amount: Decimal) -> bool:
        return self.balance >= amount

    @staticmethod
    def _require_positive(amount: Decimal) -> None:
        # A leading underscore means "internal" — a convention, not enforcement. Python trusts you.
        if amount <= 0:
            raise ValueError("Amount must be greater than zero")

    def __str__(self) -> str:
        """'Checking (1001-0001) — $1,250.00'.

        `__str__` is for people, `__repr__` for developers. The dataclass already generated a
        useful `__repr__`; this adds the one the menu prints.
        """
        return f"{self.type.label} ({self.number}) — {format_money(self.balance)}"


@dataclass(frozen=True)
class Transaction:
    """One line on a statement. Frozen: once money has moved, the history of it never changes.

    `balance_after` is stored rather than recalculated. Real ledgers do this too — it makes each row
    independently meaningful, and it is how you notice later that a balance drifted.
    """

    id: int
    account_id: int
    type: TransactionType
    amount: Decimal
    balance_after: Decimal
    timestamp: datetime
    description: str

    @property
    def signed_amount(self) -> Decimal:
        return self.type.signed(self.amount)

    def to_statement_line(self) -> str:
        """One column-aligned statement line.

        `:<14` left-aligns in 14 characters, `:>12` right-aligns. Nested braces let a computed
        string be padded: `{format_money(...):>12}`.
        """
        when = self.timestamp.strftime("%Y-%m-%d %H:%M")
        return (
            f"{when:<16}  {self.type.label:<14}  "
            f"{format_money(self.signed_amount):>12}  "
            f"{format_money(self.balance_after):>14}  {self.description}"
        )
