"""Reading from and writing to the terminal — the only module that calls print() or input().

Keeping every I/O call in one place is what lets the rest of the app be tested without a keyboard.
"""

from __future__ import annotations

from decimal import Decimal

from .money import parse_money


class Console:
    """Prompts and printing.

    `input()` raises EOFError when there is no more input — Ctrl-D, or the end of a piped script.
    Every read here turns that into None, because "there is no more input" is genuinely a different
    thing from "the user pressed enter on an empty line", and a menu that ignores it loops forever.
    """

    @staticmethod
    def print(text: str = "") -> None:
        print(text)

    @staticmethod
    def blank() -> None:
        print()

    @staticmethod
    def heading(text: str) -> None:
        """A heading with a rule under it, sized to the text."""
        print()
        print(text)
        print("=" * len(text))  # Multiplying a string repeats it. A loop here would be four lines.

    @staticmethod
    def error(message: str) -> None:
        print(f"  ⚠  {message}")

    @staticmethod
    def success(message: str) -> None:
        print(f"  ✓  {message}")

    @staticmethod
    def read_line(prompt: str) -> str | None:
        """Prompt, then return the trimmed answer, or None when input has run out."""
        try:
            return input(prompt).strip()
        except EOFError:
            print()  # Leave the cursor on a fresh line rather than mid-prompt.
            return None

    def read_choice(self, prompt: str, low: int, high: int, fallback: int) -> int:
        """Keep asking until the answer is a whole number in range.

        The "loop until valid" shape is the heart of every console app. Note the `fallback` at end
        of input, so a piped script that runs out does not spin forever.
        """
        while True:
            answer = self.read_line(prompt)
            if answer is None:
                return fallback
            try:
                value = int(answer)
            except ValueError:
                # Catching the exception *is* the validation — "ask forgiveness, not permission" is
                # the Python idiom, and there is no is-this-an-int check that does not amount to
                # trying it.
                self.error(f"'{answer}' is not a number.")
                continue
            if not low <= value <= high:
                # Chained comparison: Python allows `low <= value <= high`, which reads as maths.
                self.error(f"Enter a number between {low} and {high}.")
                continue
            return value

    def read_amount(self, prompt: str) -> Decimal | None:
        """Keep asking until the answer is an amount of money. None at end of input."""
        while True:
            answer = self.read_line(prompt)
            if answer is None:
                return None
            try:
                return parse_money(answer)
            except ValueError:
                self.error(f"'{answer}' is not an amount. Try something like 25.50")
