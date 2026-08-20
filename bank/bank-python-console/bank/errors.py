"""The app's own exceptions.

Python has no checked exceptions, so there is no `throws` to declare and nothing forces a caller to
handle anything. That freedom is why a shared base class matters even more here than in Java: one
`except BankError` at the menu catches every rule this app enforces, and nothing else. Catching bare
`Exception` would swallow the typos in your own code along with it.
"""

from __future__ import annotations

from decimal import Decimal


class BankError(Exception):
    """Base class for everything this app raises on purpose.

    Subclassing Exception (not BaseException) is the rule — BaseException also covers
    KeyboardInterrupt and SystemExit, and code that catches those stops Ctrl-C from working.
    """


class AuthenticationError(BankError):
    """Sign-in failed.

    The message is deliberately vague — "Invalid email or password" rather than "no such email".
    Saying which half was wrong tells an attacker which addresses are real accounts.
    """


class ValidationError(BankError):
    """The request was well-formed but broke a rule: a negative deposit, a transfer to itself."""


class InsufficientFundsError(BankError):
    """Not enough money in the account.

    Carrying the two figures as attributes lets the message be built once, here, and lets a caller
    that wants the numbers get them without parsing the string.
    """

    def __init__(self, requested: Decimal, available: Decimal) -> None:
        # The parent's __init__ is what sets up `args` and makes str(error) work. Forgetting this
        # super() call gives an exception that prints as an empty string.
        super().__init__(
            f"Insufficient funds: you asked for ${requested:,.2f} "
            f"but only ${available:,.2f} is available."
        )
        self.requested = requested
        self.available = available

    @property
    def shortfall(self) -> Decimal:
        """How much short the account is.

        A @property is a method called like an attribute: `error.shortfall`, no parentheses. Use it
        for things that are cheap and feel like data; use a plain method for anything that does
        real work, or the caller gets a surprise.
        """
        return self.requested - self.available
