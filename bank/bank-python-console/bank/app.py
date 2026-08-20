"""Wiring, and nothing else.

`main` builds the objects and connects them — stores, then services that need stores, then the menu
that needs services. That ordering is not an accident: it is the dependency graph, assembled by
hand. Frameworks do this same job with decorators and config, and it is easier to trust once you
have seen the version that fits on a screen.
"""

from __future__ import annotations

from .console import Console
from .menu import BankMenu
from .services import AuthService, BankService
from .stores import AccountStore, TransactionStore, UserStore, prepare_data_dir, resolve_data_dir


def main() -> None:
    data_dir = prepare_data_dir(resolve_data_dir())

    user_store = UserStore(data_dir)
    account_store = AccountStore(data_dir)
    transaction_store = TransactionStore(data_dir)

    auth = AuthService(user_store)
    bank = BankService(account_store, transaction_store)

    try:
        BankMenu(Console(), auth, bank).run()
    except KeyboardInterrupt:
        # Ctrl-C raises KeyboardInterrupt wherever the program happens to be. Catching it here turns
        # a wall of traceback into a civil goodbye — the one place a broad except is right.
        print()
        print("Goodbye.")
