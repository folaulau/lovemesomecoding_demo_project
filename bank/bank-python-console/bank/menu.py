"""The screens: sign in, then a menu loop until the customer signs out.

Everything here is reading input and printing output. Not one balance is calculated in this file —
that all lives in `services.py`. Keeping the line between them sharp is the single most useful habit
in this whole project.
"""

from __future__ import annotations

from .console import Console
from .errors import BankError
from .models import Account, User
from .money import format_money
from .services import AuthService, BankService

STATEMENT_LINES = 10
MAX_SIGN_IN_ATTEMPTS = 3


class BankMenu:
    def __init__(self, console: Console, auth: AuthService, bank: BankService) -> None:
        self.console = console
        self.auth = auth
        self.bank = bank

    def run(self) -> None:
        """The outer loop: sign in, bank, sign out, repeat."""
        self.console.heading("Welcome to Love Some Coding Bank")
        self.console.print("Test sign-in: alice@bank.test / password123")

        while True:
            user = self._sign_in()
            if user is None:
                self.console.blank()
                self.console.print("Goodbye.")
                return
            self._session(user)

    def _sign_in(self) -> User | None:
        """Three attempts, then out — the standard shape, and it stops a piped script looping."""
        for attempt in range(1, MAX_SIGN_IN_ATTEMPTS + 1):
            # range(1, 4) is 1, 2, 3 — the end is exclusive. Counting from 1 here because the
            # number is shown to a person, and people do not count attempts from zero.
            self.console.heading("Sign in")
            email = self.console.read_line("Email (blank to quit): ")
            if not email:
                # Covers both None (input ran out) and "" (they pressed enter to quit), because
                # both end the app. Where they mean different things — as in read_choice — check
                # `is None` explicitly instead.
                return None
            password = self.console.read_line("Password: ")
            if password is None:
                return None

            try:
                user = self.auth.sign_in(email, password)
            except BankError as error:
                # One except for every failure the services raise — the reason BankError has
                # subclasses rather than being four unrelated classes.
                self.console.error(f"{error} (attempt {attempt} of {MAX_SIGN_IN_ATTEMPTS})")
            else:
                # An `else` on a try block runs only when nothing was raised. It keeps the success
                # path out of the try, so a BankError raised by the lines below is never mistaken
                # for a sign-in failure.
                self.console.success(f"Signed in as {user.full_name}")
                return user

        self.console.error("Too many failed attempts.")
        return None

    def _session(self, user: User) -> None:
        """The menu, for as long as this customer stays signed in."""
        # A dict of choice → method. Python has no switch statement worth the name before 3.10's
        # match, and a dispatch dict is the idiomatic replacement: adding a menu item is one entry
        # and one method, with no growing if/elif chain to edit.
        actions = {
            1: ("View accounts", self._view_accounts),
            2: ("Deposit", self._deposit),
            3: ("Withdraw", self._withdraw),
            4: ("Transfer between accounts", self._transfer),
            5: ("Transaction history", self._history),
        }
        sign_out = len(actions) + 1

        while True:
            self.console.heading(f"Hello, {user.first_name}")
            self.console.print(f"Total balance: {format_money(self.bank.total_balance(user))}")
            self.console.blank()
            for number, (label, _) in actions.items():
                self.console.print(f"  {number}) {label}")
            self.console.print(f"  {sign_out}) Sign out")
            self.console.blank()

            choice = self.console.read_choice(f"Choose 1-{sign_out}: ", 1, sign_out, sign_out)
            if choice == sign_out:
                self.console.success("Signed out.")
                return

            try:
                # actions[choice] is the (label, method) pair; [1] is the method, and calling it
                # runs it. Methods are ordinary values in Python, which is what makes this work.
                actions[choice][1](user)
            except BankError as error:
                # Any rule the services enforce surfaces here as a message, and the loop continues.
                # One handler for the whole menu beats a try/except inside each action.
                self.console.error(str(error))

    def _view_accounts(self, user: User) -> None:
        self.console.heading("Your accounts")
        self._print_accounts(self.bank.accounts_of(user))

    def _deposit(self, user: User) -> None:
        self.console.heading("Deposit")
        account = self._choose_account(user, "Deposit into which account")
        if account is None:
            return
        amount = self.console.read_amount("Amount to deposit: ")
        if amount is None:
            return
        note = self.console.read_line("Description (optional): ") or ""

        record = self.bank.deposit(account, amount, note)
        self.console.success(
            f"Deposited {format_money(record.amount)}. "
            f"New balance: {format_money(record.balance_after)}"
        )

    def _withdraw(self, user: User) -> None:
        self.console.heading("Withdraw")
        account = self._choose_account(user, "Withdraw from which account")
        if account is None:
            return
        amount = self.console.read_amount("Amount to withdraw: ")
        if amount is None:
            return
        note = self.console.read_line("Description (optional): ") or ""

        record = self.bank.withdraw(account, amount, note)
        self.console.success(
            f"Withdrew {format_money(record.amount)}. "
            f"New balance: {format_money(record.balance_after)}"
        )

    def _transfer(self, user: User) -> None:
        self.console.heading("Transfer")
        if len(self.bank.accounts_of(user)) < 2:
            self.console.error("You need at least two accounts to transfer between them.")
            return

        source = self._choose_account(user, "Transfer from")
        if source is None:
            return
        target = self._choose_account(user, "Transfer to")
        if target is None:
            return
        amount = self.console.read_amount("Amount to transfer: ")
        if amount is None:
            return

        self.bank.transfer(source, target, amount)
        self.console.success(
            f"Transferred {format_money(amount)} from {source.number} to {target.number}."
        )
        self._print_accounts(self.bank.accounts_of(user))

    def _history(self, user: User) -> None:
        self.console.heading("Transaction history")
        account = self._choose_account(user, "History for which account")
        if account is None:
            return

        transactions = self.bank.statement(account, STATEMENT_LINES)
        self.console.blank()
        self.console.print(str(self.bank.refresh(account)))
        self.console.blank()
        if not transactions:
            self.console.print("  No transactions yet.")
            return

        self.console.print(
            f"  {'WHEN':<16}  {'WHAT':<14}  {'AMOUNT':>12}  {'BALANCE':>14}  DESCRIPTION"
        )
        for transaction in transactions:
            self.console.print(f"  {transaction.to_statement_line()}")

    def _choose_account(self, user: User, prompt: str) -> Account | None:
        """Print a numbered list of the customer's accounts and return the one they pick."""
        accounts = self.bank.accounts_of(user)
        if not accounts:
            self.console.error("You have no accounts.")
            return None
        if len(accounts) == 1:
            return accounts[0]  # Nothing to choose — do not make them press 1.

        self._print_accounts(accounts)
        choice = self.console.read_choice(
            f"{prompt} (1-{len(accounts)}, 0 to cancel): ", 0, len(accounts), 0
        )
        if choice == 0:
            return None
        # The menu is 1-based and the list is 0-based. The classic off-by-one, in its natural home.
        return accounts[choice - 1]

    def _print_accounts(self, accounts: list[Account]) -> None:
        self.console.blank()
        # enumerate(..., start=1) gives the 1-based number and the item together. Writing
        # `for i in range(len(accounts))` and indexing is the habit this replaces.
        for number, account in enumerate(accounts, start=1):
            self.console.print(f"  {number}) {account}")
