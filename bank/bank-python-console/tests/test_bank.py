"""The test suite, using `unittest` from the standard library.

No pytest, deliberately: unittest ships with Python, so this runs anywhere with no install step.
pytest is nicer — plain `assert`, fixtures, better failure output — and is what most projects use.

Each test builds a fresh CSV "database" in a temporary directory, so tests cannot affect each other
or the real data. `setUp` runs before every single test, which is what keeps them order-independent
— the property that keeps a suite trustworthy as it grows.

Run it with:  python3 -m unittest discover -s tests -v
"""

from __future__ import annotations

import csv
import tempfile
import unittest
from datetime import datetime
from decimal import Decimal
from pathlib import Path

from bank.errors import AuthenticationError, InsufficientFundsError, ValidationError
from bank.models import Account, AccountType, Transaction, TransactionType, User
from bank.money import format_money, money, parse_money, round_money, to_csv
from bank.services import AuthService, BankService
from bank.stores import AccountStore, TransactionStore, UserStore, prepare_data_dir

USERS_CSV = """id,email,password,full_name,created_at
1,alice@bank.test,password123,Alice Fifita,2026-01-15T09:12:00
2,bob@bank.test,password123,Bob Tupou,2026-02-03T14:40:00
"""

ACCOUNTS_CSV = """id,user_id,type,number,balance
1,1,CHECKING,1001-0001,1250.00
2,1,SAVINGS,1001-0002,8400.50
3,2,CHECKING,1002-0001,310.75
"""

TRANSACTIONS_CSV = """id,account_id,type,amount,balance_after,timestamp,description
1,1,DEPOSIT,1500.00,1500.00,2026-01-15T09:15:00,Opening deposit
"""


class MoneyTest(unittest.TestCase):
    """Decimal behaviour — the part everyone gets wrong with floats."""

    def test_parses_plain_numbers_to_two_places(self):
        self.assertEqual("1200.50", str(parse_money("1200.5")))

    def test_parses_formatted_input(self):
        self.assertEqual(money("1200.50"), parse_money("$1,200.50"))

    def test_rounds_half_up_not_half_even(self):
        # Python's default rounding would give 2.34 here. This is why round_money states it.
        self.assertEqual("2.35", str(round_money(Decimal("2.345"))))

    def test_rejects_text_that_is_not_a_number(self):
        # assertRaises as a context manager reads as "this block must raise".
        with self.assertRaises(ValueError):
            parse_money("abc")

    def test_rejects_an_empty_amount(self):
        with self.assertRaises(ValueError):
            parse_money("   ")

    def test_addition_is_exact_unlike_float(self):
        # As floats, 0.1 + 0.2 is 0.30000000000000004. This is the entire reason for Decimal.
        self.assertEqual(Decimal("0.30"), money("0.10") + money("0.20"))
        self.assertNotEqual(0.1 + 0.2, 0.3)  # The float version, for contrast.

    def test_building_from_a_float_still_lands_on_the_right_value(self):
        # money() goes via str() precisely so this does not become 0.1000000000000000055511151231.
        self.assertEqual(Decimal("0.10"), money(0.1))

    def test_formats_a_negative_as_a_statement_would(self):
        self.assertEqual("-$40.00", format_money(money("-40")))
        self.assertEqual("$1,250.00", format_money(money("1250")))

    def test_csv_form_has_no_symbols(self):
        self.assertEqual("1250.00", to_csv(money("1250")))


class CsvTest(unittest.TestCase):
    """Reading and writing the files."""

    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())

    def test_a_name_with_a_comma_survives_a_round_trip(self):
        # The case that breaks a hand-rolled split(",") parser.
        store = UserStore(self.dir)
        store.create("odd@bank.test", "pw", 'Tupou, Bob "BJ"')
        read = store.find_by_email("odd@bank.test")
        self.assertEqual('Tupou, Bob "BJ"', read.full_name)

    def test_the_file_is_quoted_correctly_on_disk(self):
        store = UserStore(self.dir)
        store.create("odd@bank.test", "pw", "Tupou, Bob")
        with (self.dir / "users.csv").open(newline="", encoding="utf-8") as handle:
            rows = list(csv.reader(handle))
        self.assertEqual("Tupou, Bob", rows[1][3])

    def test_files_use_unix_line_endings(self):
        # The Java app beside this one writes \n. If the csv module's \r\n default leaked through,
        # the two apps would produce byte-different files from identical data.
        store = UserStore(self.dir)
        store.create("a@bank.test", "pw", "A B")
        self.assertNotIn(b"\r\n", (self.dir / "users.csv").read_bytes())

    def test_reading_a_missing_file_gives_an_empty_list(self):
        self.assertEqual([], UserStore(self.dir).find_all())

    def test_seeding_copies_the_files_once(self):
        seed_dir = self.dir / "seed"
        seed_dir.mkdir()
        (seed_dir / "users.csv").write_text(USERS_CSV)
        prepare_data_dir(self.dir)
        self.assertTrue((self.dir / "users.csv").exists())

        # A second run must not overwrite work already done.
        (self.dir / "users.csv").write_text(USERS_CSV + "3,c@bank.test,pw,C D,2026-05-05T00:00:00\n")
        prepare_data_dir(self.dir)
        self.assertEqual(3, len(UserStore(self.dir).find_all()))


class ModelTest(unittest.TestCase):
    """The rules the models enforce on themselves."""

    def test_email_is_normalised_on_the_way_in(self):
        user = User(1, "  Alice@BANK.test ", "pw", "Alice Fifita", datetime.now())
        self.assertEqual("alice@bank.test", user.email)

    def test_a_user_must_have_an_email(self):
        with self.assertRaises(ValueError):
            User(1, "   ", "pw", "Nobody", datetime.now())

    def test_first_name_is_the_first_word(self):
        self.assertEqual("Alice", User(1, "a@b.test", "pw", "Alice Fifita", datetime.now()).first_name)

    def test_a_frozen_user_cannot_be_edited(self):
        # frozen=True turns assignment into an error. This is the guarantee the app relies on.
        user = User(1, "a@b.test", "pw", "Alice Fifita", datetime.now())
        with self.assertRaises(Exception):
            user.email = "someone@else.test"

    def test_an_account_refuses_to_go_negative(self):
        account = Account(1, 1, AccountType.CHECKING, "1001-0001", money("10.00"))
        with self.assertRaises(RuntimeError):
            account.debit(money("10.01"))

    def test_account_type_parses_case_insensitively(self):
        self.assertEqual(AccountType.CHECKING, AccountType.from_csv("checking"))

    def test_an_unknown_account_type_is_rejected(self):
        with self.assertRaises(ValueError):
            AccountType.from_csv("CHEKING")

    def test_a_withdrawal_is_signed_negative(self):
        self.assertEqual(money("-40"), TransactionType.WITHDRAWAL.signed(money("40")))
        self.assertEqual(money("40"), TransactionType.DEPOSIT.signed(money("40")))


class BankTestCase(unittest.TestCase):
    """Base class holding the fixture, so every test below starts from the same clean bank.

    Inheriting the setup rather than repeating it is the same reason the stores share a base class.
    """

    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        (self.dir / "users.csv").write_text(USERS_CSV)
        (self.dir / "accounts.csv").write_text(ACCOUNTS_CSV)
        (self.dir / "transactions.csv").write_text(TRANSACTIONS_CSV)
        self._wire()

    def _wire(self):
        """Build the services. Called again by `reload` to re-read everything from disk."""
        self.users = UserStore(self.dir)
        self.accounts = AccountStore(self.dir)
        self.transactions = TransactionStore(self.dir)
        self.auth = AuthService(self.users)
        self.bank = BankService(self.accounts, self.transactions)

    def reload(self):
        """Throw away every object and read the files again.

        Asserting after a reload is what proves a change reached the disk. A test that only checks
        the in-memory value passes even when saving is completely broken.
        """
        self._wire()
        return self

    @property
    def alice(self) -> User:
        return self.users.find_by_email("alice@bank.test")

    @property
    def checking(self) -> Account:
        return self.accounts.find_by_id(1)

    @property
    def savings(self) -> Account:
        return self.accounts.find_by_id(2)

    @property
    def bob_checking(self) -> Account:
        return self.accounts.find_by_id(3)


class SignInTest(BankTestCase):
    def test_signs_in_with_the_right_password(self):
        self.assertEqual("alice@bank.test", self.auth.sign_in("alice@bank.test", "password123").email)

    def test_ignores_email_case_and_whitespace(self):
        self.assertEqual("alice@bank.test", self.auth.sign_in("  ALICE@bank.test  ", "password123").email)

    def test_rejects_a_wrong_password(self):
        with self.assertRaises(AuthenticationError):
            self.auth.sign_in("alice@bank.test", "wrong")

    def test_rejects_an_unknown_email(self):
        with self.assertRaises(AuthenticationError):
            self.auth.sign_in("nobody@bank.test", "password123")

    def test_a_none_password_does_not_blow_up(self):
        with self.assertRaises(AuthenticationError):
            self.auth.sign_in("alice@bank.test", None)

    def test_both_failures_give_the_same_message(self):
        # Different messages would confirm which email addresses are real accounts.
        with self.assertRaises(AuthenticationError) as unknown_email:
            self.auth.sign_in("nobody@bank.test", "password123")
        with self.assertRaises(AuthenticationError) as wrong_password:
            self.auth.sign_in("alice@bank.test", "wrong")
        self.assertEqual(str(unknown_email.exception), str(wrong_password.exception))


class DepositTest(BankTestCase):
    def test_a_deposit_raises_the_balance_on_disk(self):
        self.bank.deposit(self.checking, money("100.00"), "Pay day")
        self.assertEqual(money("1350.00"), self.reload().checking.balance)

    def test_a_deposit_records_a_transaction(self):
        record = self.bank.deposit(self.checking, money("100.00"), "Pay day")
        self.assertEqual(TransactionType.DEPOSIT, record.type)
        self.assertEqual(money("1350.00"), record.balance_after)
        self.assertEqual("Pay day", record.description)

    def test_a_blank_description_falls_back_to_the_type_label(self):
        self.assertEqual("Deposit", self.bank.deposit(self.checking, money("5.00"), "   ").description)

    def test_a_zero_deposit_is_refused(self):
        with self.assertRaises(ValidationError):
            self.bank.deposit(self.checking, money("0.00"), "nothing")

    def test_a_negative_deposit_is_refused(self):
        with self.assertRaises(ValidationError):
            self.bank.deposit(self.checking, money("-10.00"), "cheeky")

    def test_a_deposit_over_the_limit_is_refused(self):
        with self.assertRaises(ValidationError):
            self.bank.deposit(self.checking, money("50000.01"), "fat finger")

    def test_a_refused_deposit_changes_nothing_on_disk(self):
        with self.assertRaises(ValidationError):
            self.bank.deposit(self.checking, money("-10.00"), "cheeky")
        self.assertEqual(money("1250.00"), self.reload().checking.balance)


class WithdrawTest(BankTestCase):
    def test_a_withdrawal_lowers_the_balance(self):
        self.bank.withdraw(self.checking, money("250.00"), "Rent")
        self.assertEqual(money("1000.00"), self.reload().checking.balance)

    def test_withdrawing_the_whole_balance_is_allowed(self):
        self.bank.withdraw(self.checking, money("1250.00"), "Everything")
        self.assertEqual(money("0.00"), self.reload().checking.balance)

    def test_overdrawing_by_a_cent_is_refused(self):
        with self.assertRaises(InsufficientFundsError):
            self.bank.withdraw(self.checking, money("1250.01"), "Too much")

    def test_the_error_carries_both_figures(self):
        with self.assertRaises(InsufficientFundsError) as raised:
            self.bank.withdraw(self.checking, money("2000.00"), "Too much")
        self.assertEqual(money("2000.00"), raised.exception.requested)
        self.assertEqual(money("1250.00"), raised.exception.available)
        self.assertEqual(money("750.00"), raised.exception.shortfall)

    def test_a_refused_withdrawal_leaves_the_balance_alone(self):
        with self.assertRaises(InsufficientFundsError):
            self.bank.withdraw(self.checking, money("9999.00"), "Too much")
        self.assertEqual(money("1250.00"), self.reload().checking.balance)


class TransferTest(BankTestCase):
    def test_a_transfer_moves_money_between_both_accounts(self):
        self.bank.transfer(self.checking, self.savings, money("250.00"))
        after = self.reload()
        self.assertEqual(money("1000.00"), after.checking.balance)
        self.assertEqual(money("8650.50"), after.savings.balance)

    def test_a_transfer_conserves_the_total(self):
        before = self.bank.total_balance(self.alice)
        self.bank.transfer(self.checking, self.savings, money("500.00"))
        self.assertEqual(before, self.reload().bank.total_balance(self.alice))

    def test_a_transfer_writes_two_statement_lines(self):
        records = self.bank.transfer(self.checking, self.savings, money("100.00"))
        self.assertEqual(2, len(records))
        self.assertEqual(TransactionType.TRANSFER_OUT, records[0].type)
        self.assertEqual(TransactionType.TRANSFER_IN, records[1].type)
        self.assertNotEqual(records[0].id, records[1].id)

    def test_transferring_to_the_same_account_is_refused(self):
        with self.assertRaises(ValidationError):
            self.bank.transfer(self.checking, self.checking, money("10.00"))

    def test_transferring_to_someone_elses_account_is_refused(self):
        with self.assertRaises(ValidationError):
            self.bank.transfer(self.checking, self.bob_checking, money("10.00"))

    def test_a_transfer_larger_than_the_balance_changes_nothing(self):
        with self.assertRaises(InsufficientFundsError):
            # Over the 1250.00 balance but under the 50000.00 limit, so it is insufficient funds
            # that stops it and not the limit check.
            self.bank.transfer(self.checking, self.savings, money("5000.00"))
        after = self.reload()
        self.assertEqual(money("1250.00"), after.checking.balance)
        self.assertEqual(money("8400.50"), after.savings.balance)


class BalanceAndHistoryTest(BankTestCase):
    def test_the_total_counts_only_this_customers_accounts(self):
        # Alice's 1250.00 + 8400.50. Bob's 310.75 must not be counted.
        self.assertEqual(money("9650.50"), self.bank.total_balance(self.alice))

    def test_accounts_are_listed_checking_first(self):
        accounts = self.bank.accounts_of(self.alice)
        self.assertEqual(2, len(accounts))
        self.assertEqual(AccountType.CHECKING, accounts[0].type)

    def test_history_is_newest_first(self):
        self.bank.deposit(self.checking, money("10.00"), "First")
        self.bank.deposit(self.reload().checking, money("20.00"), "Second")
        self.assertEqual("Second", self.reload().bank.statement(self.checking, 10)[0].description)

    def test_history_respects_the_limit(self):
        for i in range(6):
            self.bank.deposit(self.reload().checking, money("1.00"), f"Deposit {i}")
        self.assertEqual(3, len(self.bank.statement(self.checking, 3)))

    def test_history_only_shows_the_account_asked_for(self):
        self.bank.deposit(self.savings, money("10.00"), "Savings only")
        rows = self.bank.statement(self.savings, 50)
        self.assertTrue(all(row.account_id == 2 for row in rows))

    def test_balance_after_matches_the_running_balance(self):
        # The check that catches a ledger drifting out of step with its account.
        self.bank.deposit(self.checking, money("100.00"), "One")
        self.bank.withdraw(self.reload().checking, money("50.00"), "Two")
        after = self.reload()
        newest = after.bank.statement(after.checking, 1)[0]
        self.assertEqual(after.checking.balance, newest.balance_after)

    def test_a_statement_line_is_column_aligned(self):
        record = self.bank.withdraw(self.checking, money("40.00"), "Cash")
        self.assertIn("-$40.00", record.to_statement_line())
        self.assertIn("Cash", record.to_statement_line())


class StoreTest(BankTestCase):
    def test_next_id_starts_at_one_on_an_empty_table(self):
        self.assertEqual(1, UserStore(Path(tempfile.mkdtemp())).next_id())

    def test_next_id_follows_the_highest_existing_id(self):
        self.assertEqual(3, self.users.next_id())

    def test_find_by_id_returns_none_for_a_missing_row(self):
        self.assertIsNone(self.accounts.find_by_id(999))

    def test_find_by_user_returns_nothing_for_an_unknown_customer(self):
        self.assertEqual([], self.accounts.find_by_user(999))

    def test_a_store_cannot_be_built_without_its_three_methods(self):
        # The payoff of ABC: the mistake is caught at construction, naming what is missing.
        from bank.stores import CsvStore

        class Broken(CsvStore[Transaction]):
            file_name = "x.csv"
            header = ["id"]

        with self.assertRaises(TypeError):
            Broken(self.dir)


if __name__ == "__main__":
    unittest.main()
