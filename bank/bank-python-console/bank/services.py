"""Every rule about signing in and moving money, in one place.

The console never adjusts a balance itself — it collects input and calls a method here. Keeping the
rules off the screen is what makes them testable, and it is the difference between an app you can
add a second interface to (a web UI, an API) and one you cannot.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from .errors import AuthenticationError, InsufficientFundsError, ValidationError
from .models import Account, Transaction, TransactionType, User
from .money import MAX_TRANSACTION, ZERO, format_money
from .stores import AccountStore, TransactionStore, UserStore


class AuthService:
    """Sign-in.

    Small enough to fold into the menu, kept separate anyway: the menu's job is reading and
    printing, this one's is deciding. Split that way, the rule can be tested without a keyboard.
    """

    def __init__(self, user_store: UserStore) -> None:
        # The store arrives as an argument rather than being created here. That is dependency
        # injection, in its plainest form — and it is why the tests can hand this class a store
        # pointed at a temp directory.
        self.user_store = user_store

    def sign_in(self, email: str | None, password: str | None) -> User:
        """Raise AuthenticationError when the email is unknown *or* the password is wrong.

        One message for both, on purpose: saying which half failed tells an attacker which email
        addresses are real accounts. Note the single `if` — two branches with two messages is
        exactly the mistake this avoids.
        """
        user = self.user_store.find_by_email(email)
        if user is None or not user.password_matches(password):
            raise AuthenticationError("Invalid email or password.")
        return user


class BankService:
    """Deposits, withdrawals, transfers and statements."""

    def __init__(self, account_store: AccountStore, transaction_store: TransactionStore) -> None:
        self.account_store = account_store
        self.transaction_store = transaction_store

    def accounts_of(self, user: User) -> list[Account]:
        return self.account_store.find_by_user(user.id)

    def statement(self, account: Account, limit: int = 10) -> list[Transaction]:
        return self.transaction_store.find_by_account(account.id, limit)

    def total_balance(self, user: User) -> Decimal:
        """The customer's total across all their accounts.

        `sum` with `start=ZERO` — the default start is the integer 0, and mixing int and Decimal
        works here but is the kind of thing that eventually bites.
        """
        return sum((account.balance for account in self.accounts_of(user)), start=ZERO)

    def deposit(self, account: Account, amount: Decimal, description: str = "") -> Transaction:
        """Pay money in. Returns the resulting statement line."""
        self._validate_amount(amount)
        accounts = self.account_store.find_all()
        live = self._locate(accounts, account.id)

        live.credit(amount)
        record = self._record(live, TransactionType.DEPOSIT, amount, description)

        self.account_store.save_all(accounts)
        self.transaction_store.add(record)
        return record

    def withdraw(self, account: Account, amount: Decimal, description: str = "") -> Transaction:
        """Take money out, refusing to overdraw."""
        self._validate_amount(amount)
        accounts = self.account_store.find_all()
        live = self._locate(accounts, account.id)

        # Check before mutating. Account.debit raises too, but this produces the message the
        # customer should see, with both figures in it.
        if not live.can_cover(amount):
            raise InsufficientFundsError(amount, live.balance)

        live.debit(amount)
        record = self._record(live, TransactionType.WITHDRAWAL, amount, description)

        self.account_store.save_all(accounts)
        self.transaction_store.add(record)
        return record

    def transfer(self, source: Account, target: Account, amount: Decimal) -> list[Transaction]:
        """Move money between two of the same customer's accounts.

        Both balances change in the in-memory list and the list is saved **once**. Two separate
        saves would leave the money nowhere at all if the process died between them. A real database
        wraps this in a transaction; a single rewrite of one file is the closest this app can get,
        and it is worth noticing that the problem is the same problem.
        """
        self._validate_amount(amount)
        if source.id == target.id:
            raise ValidationError("Choose two different accounts.")
        if source.user_id != target.user_id:
            # Belt and braces: the menu only ever offers the signed-in customer's own accounts.
            raise ValidationError("You can only transfer between your own accounts.")

        accounts = self.account_store.find_all()
        live_source = self._locate(accounts, source.id)
        live_target = self._locate(accounts, target.id)

        if not live_source.can_cover(amount):
            raise InsufficientFundsError(amount, live_source.balance)

        live_source.debit(amount)
        live_target.credit(amount)

        next_id = self.transaction_store.next_id()
        now = datetime.now()
        records = [
            Transaction(
                id=next_id,
                account_id=live_source.id,
                type=TransactionType.TRANSFER_OUT,
                amount=amount,
                balance_after=live_source.balance,
                timestamp=now,
                description=f"To {live_target.number}",
            ),
            Transaction(
                id=next_id + 1,
                account_id=live_target.id,
                type=TransactionType.TRANSFER_IN,
                amount=amount,
                balance_after=live_target.balance,
                timestamp=now,
                description=f"From {live_source.number}",
            ),
        ]

        self.account_store.save_all(accounts)
        self.transaction_store.add_all(records)
        return records

    def refresh(self, account: Account) -> Account:
        """Re-read one account, so a caller holding a stale copy still sees the new balance."""
        found = self.account_store.find_by_id(account.id)
        if found is None:
            raise ValidationError("That account no longer exists.")
        return found

    def _record(
        self, account: Account, type_: TransactionType, amount: Decimal, description: str
    ) -> Transaction:
        # `type_` with a trailing underscore: `type` is a builtin, and shadowing it inside a
        # function is the sort of thing that works fine until the day it does not.
        return Transaction(
            id=self.transaction_store.next_id(),
            account_id=account.id,
            type=type_,
            amount=amount,
            balance_after=account.balance,
            timestamp=datetime.now(),
            description=description.strip() or type_.label,
        )

    @staticmethod
    def _locate(accounts: list[Account], account_id: int) -> Account:
        """Find the account inside the freshly-loaded list.

        The Account the menu is holding was read from disk earlier and is a different object. Fail
        to do this and you mutate the stale copy, save the list you loaded, and the change vanishes
        — a bug that looks like "the app forgets my deposit" and is genuinely hard to spot.
        """
        for account in accounts:
            if account.id == account_id:
                return account
        raise ValidationError("That account no longer exists.")

    @staticmethod
    def _validate_amount(amount: Decimal | None) -> None:
        if amount is None or amount <= 0:
            raise ValidationError("Amount must be greater than zero.")
        if amount > MAX_TRANSACTION:
            raise ValidationError(
                f"Amount is above the {format_money(MAX_TRANSACTION)} per-transaction limit."
            )
