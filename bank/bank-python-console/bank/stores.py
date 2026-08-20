"""The stores: one per CSV file, each mapping rows to objects and back.

`CsvStore` is generic and abstract — it implements find/save once, and each subclass fills in the
three holes that need to know about the specific type. That is the same template-method shape as
`store/CsvStore.java`, and the reason DAO layers in larger apps look the way they do.
"""

from __future__ import annotations

import os
import shutil
from abc import ABC, abstractmethod
from datetime import datetime
from pathlib import Path
from typing import Callable, Generic, TypeVar

from .csv_table import CsvTable
from .models import Account, AccountType, Transaction, TransactionType, User
from .money import money, to_csv

# A TypeVar is the `<T>` of Python's type hints: `CsvStore[User]` returns Users, `CsvStore[Account]`
# returns Accounts. Nothing checks it at runtime — a type checker like mypy does, and so does your
# editor while you type. That is the whole benefit: mistakes caught while writing, not while running.
T = TypeVar("T")


class CsvStore(ABC, Generic[T]):
    """The shared behaviour of every store, written once.

    ABC means "abstract base class". A subclass that forgets one @abstractmethod cannot be
    instantiated at all — the error arrives at construction, naming the missing method, rather than
    as an AttributeError somewhere later.
    """

    #: Filled in by each subclass. Class attributes like these are the declarative part of the store.
    file_name: str = ""
    header: list[str] = []

    def __init__(self, data_dir: Path) -> None:
        self.table = CsvTable(data_dir / self.file_name, self.header)

    @abstractmethod
    def from_row(self, row: dict[str, str]) -> T:
        """Row → object."""

    @abstractmethod
    def to_row(self, item: T) -> dict[str, str]:
        """Object → row. The exact inverse of from_row; if they disagree, data is lost on save."""

    @abstractmethod
    def id_of(self, item: T) -> int:
        """Every record's id, so this class can work out the next one."""

    def find_all(self) -> list[T]:
        # A list comprehension: build a list by transforming each row. The `for` loop version is
        # three lines and reads no better once you know this shape.
        return [self.from_row(row) for row in self.table.read_all()]

    def find(self, test: Callable[[T], bool]) -> list[T]:
        """Every record matching the test, which is any function taking one item and returning a
        bool — usually a lambda: `find(lambda a: a.user_id == 1)`."""
        return [item for item in self.find_all() if test(item)]

    def find_first(self, test: Callable[[T], bool]) -> T | None:
        """The first match, or None.

        Python has no Optional to force the caller's hand the way Java's does, so the `| None` in
        the return type is the whole warning — heed it, or meet AttributeError on NoneType.

        The generator expression inside next() is lazy: it stops at the first match instead of
        building the whole list. `None` is the default next() returns when nothing matches; without
        it, next() raises StopIteration.
        """
        return next((item for item in self.find_all() if test(item)), None)

    def find_by_id(self, item_id: int) -> T | None:
        return self.find_first(lambda item: self.id_of(item) == item_id)

    def save_all(self, items: list[T]) -> None:
        """Write the given list out, replacing everything currently in the file."""
        self.table.write_all([self.to_row(item) for item in items])

    def add(self, item: T) -> None:
        self.save_all([*self.find_all(), item])  # * unpacks the list into a new one.

    def add_all(self, items: list[T]) -> None:
        """Append several rows in one rewrite of the file, which is what a transfer needs."""
        self.save_all([*self.find_all(), *items])

    def next_id(self) -> int:
        """The next free id.

        A database does this with an auto-increment column. Doing it by hand is fine for one
        process; two copies of the app running at once would both read the same max and collide.
        That race is exactly what a database's sequence exists to prevent.

        `default=0` is what stops max() raising ValueError on an empty table.
        """
        return max((self.id_of(item) for item in self.find_all()), default=0) + 1


class UserStore(CsvStore[User]):
    """users.csv."""

    file_name = "users.csv"
    header = ["id", "email", "password", "full_name", "created_at"]

    def from_row(self, row: dict[str, str]) -> User:
        return User(
            id=int(row["id"]),
            email=row["email"],
            password=row["password"],
            full_name=row["full_name"],
            # fromisoformat is the counterpart of datetime.isoformat() — the pair round-trips, which
            # is exactly what a file format needs. Java writes the same ISO-8601 text.
            created_at=datetime.fromisoformat(row["created_at"]),
        )

    def to_row(self, user: User) -> dict[str, str]:
        return {
            "id": str(user.id),
            "email": user.email,
            "password": user.password,
            "full_name": user.full_name,
            "created_at": user.created_at.isoformat(),
        }

    def id_of(self, user: User) -> int:
        return user.id

    def find_by_email(self, email: str | None) -> User | None:
        """Case-insensitive, because nobody types their email the same way twice."""
        normalised = (email or "").strip().lower()
        return self.find_first(lambda user: user.email == normalised)

    def create(self, email: str, password: str, full_name: str) -> User:
        user = User(self.next_id(), email, password, full_name, datetime.now())
        self.add(user)
        return user


class AccountStore(CsvStore[Account]):
    """accounts.csv."""

    file_name = "accounts.csv"
    header = ["id", "user_id", "type", "number", "balance"]

    def from_row(self, row: dict[str, str]) -> Account:
        return Account(
            id=int(row["id"]),
            user_id=int(row["user_id"]),
            type=AccountType.from_csv(row["type"]),
            number=row["number"],
            balance=money(row["balance"]),
        )

    def to_row(self, account: Account) -> dict[str, str]:
        return {
            "id": str(account.id),
            "user_id": str(account.user_id),
            "type": account.type.name,  # .name is "CHECKING"; .value would be "Checking".
            "number": account.number,
            "balance": to_csv(account.balance),
        }

    def id_of(self, account: Account) -> int:
        return account.id

    def find_by_user(self, user_id: int) -> list[Account]:
        """This customer's accounts, CHECKING before SAVINGS so the menu numbering is stable.

        `key=` says what to sort by. Returning a tuple sorts by the first element and uses the
        second as a tiebreaker — the equivalent of Java's Comparator.thenComparing. Enum members are
        not orderable by default, so the sort uses the declaration order via `list(AccountType)`.
        """
        order = list(AccountType)
        return sorted(
            self.find(lambda account: account.user_id == user_id),
            key=lambda account: (order.index(account.type), account.id),
        )


class TransactionStore(CsvStore[Transaction]):
    """transactions.csv — append-only in practice: a statement line is never edited."""

    file_name = "transactions.csv"
    header = ["id", "account_id", "type", "amount", "balance_after", "timestamp", "description"]

    def from_row(self, row: dict[str, str]) -> Transaction:
        return Transaction(
            id=int(row["id"]),
            account_id=int(row["account_id"]),
            type=TransactionType.from_csv(row["type"]),
            amount=money(row["amount"]),
            balance_after=money(row["balance_after"]),
            timestamp=datetime.fromisoformat(row["timestamp"]),
            description=row["description"],
        )

    def to_row(self, transaction: Transaction) -> dict[str, str]:
        return {
            "id": str(transaction.id),
            "account_id": str(transaction.account_id),
            "type": transaction.type.name,
            "amount": to_csv(transaction.amount),
            "balance_after": to_csv(transaction.balance_after),
            "timestamp": transaction.timestamp.isoformat(),
            "description": transaction.description,
        }

    def id_of(self, transaction: Transaction) -> int:
        return transaction.id

    def find_by_account(self, account_id: int, limit: int) -> list[Transaction]:
        """The statement for one account, newest first, at most `limit` lines."""
        rows = self.find(lambda t: t.account_id == account_id)
        rows.sort(key=lambda t: t.timestamp, reverse=True)
        return rows[:limit]  # Slicing past the end is fine — no IndexError, just a shorter list.


# --- the data directory -------------------------------------------------------------------------

DATA_FILES = ("users.csv", "accounts.csv", "transactions.csv")


def resolve_data_dir() -> Path:
    """Find the CSV "database".

    BANK_DATA_DIR overrides it, which is how the tests point the app at a throwaway directory
    instead of the real data. Configuration through the environment, no code change.
    """
    override = os.environ.get("BANK_DATA_DIR", "").strip()
    if override:
        return Path(override)
    # Relative to this file, not to the shell's working directory: `bank/stores.py` → up two → the
    # project root → `data`. This is why the app works no matter where it is started from.
    return Path(__file__).resolve().parent.parent.parent / "data"


def prepare_data_dir(data_dir: Path) -> Path:
    """Copy any missing file out of data/seed/. Existing files are never touched.

    The working files are gitignored and the seed copies are committed, so running the app can never
    dirty the repository, and deleting the working files is a full reset.
    """
    data_dir.mkdir(parents=True, exist_ok=True)
    seed_dir = data_dir / "seed"
    for name in DATA_FILES:
        target = data_dir / name
        seed = seed_dir / name
        if not target.exists() and seed.exists():
            shutil.copyfile(seed, target)
    return data_dir
