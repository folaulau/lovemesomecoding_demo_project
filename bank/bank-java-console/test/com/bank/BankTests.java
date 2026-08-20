package com.bank;

import static com.bank.TestRunner.assertEquals;
import static com.bank.TestRunner.assertThrows;
import static com.bank.TestRunner.assertTrue;

import com.bank.error.AuthenticationException;
import com.bank.error.InsufficientFundsException;
import com.bank.error.ValidationException;
import com.bank.model.Account;
import com.bank.model.AccountType;
import com.bank.model.Money;
import com.bank.model.Transaction;
import com.bank.model.TransactionType;
import com.bank.model.User;
import com.bank.service.AuthService;
import com.bank.service.BankService;
import com.bank.store.AccountStore;
import com.bank.store.CsvTable;
import com.bank.store.TransactionStore;
import com.bank.store.UserStore;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

/**
 * The test suite.
 *
 * <p>Each test builds a fresh CSV "database" in a temporary directory, so tests cannot affect each
 * other or the real data — the same isolation a database-backed suite gets from rolling back a
 * transaction. Order between tests never matters, which is the property that keeps a suite
 * trustworthy as it grows.
 */
public class BankTests {

    public static void main(String[] args) {
        // try-with-resources: close() runs at the end of the block, printing the summary, whether
        // the block finished normally or blew up.
        try (TestRunner t = new TestRunner()) {

            t.section("Money");

            t.test("parses plain numbers to two decimal places", () ->
                    assertEquals("1200.50", "1200.50", Money.parse("1200.5").toPlainString()));

            t.test("parses formatted input like $1,200.50", () ->
                    assertEquals("1200.50", Money.of("1200.50"), Money.parse("$1,200.50")));

            t.test("rounds half up", () ->
                    assertEquals("2.35", "2.35", Money.round(new BigDecimal("2.345")).toPlainString()));

            t.test("rejects text that is not a number", () ->
                    assertThrows("abc is not money", NumberFormatException.class, () -> Money.parse("abc")));

            t.test("addition is exact, unlike double", () -> {
                // The whole reason BigDecimal is here: as doubles, 0.1 + 0.2 is 0.30000000000000004.
                BigDecimal sum = Money.of("0.10").add(Money.of("0.20"));
                assertEquals("0.30", "0.30", sum.toPlainString());
            });

            t.test("compares by value, ignoring scale", () ->
                    assertTrue("1.0 equals 1.00 by compareTo",
                            Money.of("1.0").compareTo(new BigDecimal("1.00")) == 0));

            t.section("CSV parsing");

            t.test("splits a simple line", () ->
                    assertEquals("three fields", List.of("1", "a", "2.00"), CsvTable.parseLine("1,a,2.00")));

            t.test("keeps a comma inside a quoted field", () -> {
                // The bug that split(",") would introduce: four fields instead of three.
                List<String> fields = CsvTable.parseLine("1,\"Tupou, Bob\",5.00");
                assertEquals("three fields", 3, fields.size());
                assertEquals("name intact", "Tupou, Bob", fields.get(1));
            });

            t.test("unescapes a doubled quote", () ->
                    assertEquals("quote inside", "say \"hi\"", CsvTable.parseLine("1,\"say \"\"hi\"\"\"").get(1)));

            t.test("keeps an empty trailing field", () ->
                    assertEquals("three fields", 3, CsvTable.parseLine("1,2,").size()));

            t.test("escape quotes only what needs it", () -> {
                assertEquals("plain text untouched", "hello", CsvTable.escape("hello"));
                assertEquals("comma gets quoted", "\"a,b\"", CsvTable.escape("a,b"));
            });

            t.test("a row survives a write/read round trip", () -> {
                Path dir = tempDir();
                UserStore store = new UserStore(dir);
                store.create("Odd@Bank.test", "pw", "Tupou, Bob \"BJ\"");
                User read = store.findByEmail("odd@bank.test").orElseThrow();
                assertEquals("name survived the commas and quotes", "Tupou, Bob \"BJ\"", read.fullName());
            });

            t.section("Users and sign-in");

            t.test("email is normalised on the way in", () -> {
                User user = new User(1, "  Alice@BANK.test ", "pw", "Alice Fifita", LocalDateTime.now());
                assertEquals("lowercased and trimmed", "alice@bank.test", user.email());
            });

            t.test("a user must have an email", () ->
                    assertThrows("blank email rejected", IllegalArgumentException.class,
                            () -> new User(1, "  ", "pw", "Nobody", LocalDateTime.now())));

            t.test("firstName takes the first word", () ->
                    assertEquals("Alice", "Alice",
                            new User(1, "a@b.test", "pw", "Alice Fifita", LocalDateTime.now()).firstName()));

            t.test("sign-in succeeds with the right password", () -> {
                Fixture f = new Fixture();
                assertEquals("signed in", "alice@bank.test", f.auth.signIn("alice@bank.test", "password123").email());
            });

            t.test("sign-in ignores email case and whitespace", () ->
                    assertEquals("signed in", "alice@bank.test",
                            new Fixture().auth.signIn("  ALICE@bank.test  ", "password123").email()));

            t.test("a wrong password is rejected", () ->
                    assertThrows("bad password", AuthenticationException.class,
                            () -> new Fixture().auth.signIn("alice@bank.test", "wrong")));

            t.test("an unknown email is rejected", () ->
                    assertThrows("no such user", AuthenticationException.class,
                            () -> new Fixture().auth.signIn("nobody@bank.test", "password123")));

            t.test("a null password does not blow up", () ->
                    assertThrows("null password", AuthenticationException.class,
                            () -> new Fixture().auth.signIn("alice@bank.test", null)));

            t.test("both failures give the same message, so neither confirms an account exists", () -> {
                Fixture f = new Fixture();
                String unknownEmail = messageOf(() -> f.auth.signIn("nobody@bank.test", "password123"));
                String wrongPassword = messageOf(() -> f.auth.signIn("alice@bank.test", "wrong"));
                assertEquals("identical messages", unknownEmail, wrongPassword);
            });

            t.section("Deposits");

            t.test("a deposit raises the balance and is written to disk", () -> {
                Fixture f = new Fixture();
                f.bank.deposit(f.checking(), Money.of("100.00"), "Pay day");
                // Re-read from the file rather than trusting the object in memory. A test that only
                // checks the in-memory value passes even when saving is completely broken.
                assertEquals("1350.00", Money.of("1350.00"), f.reload().checking().balance());
            });

            t.test("a deposit records a transaction", () -> {
                Fixture f = new Fixture();
                Transaction record = f.bank.deposit(f.checking(), Money.of("100.00"), "Pay day");
                assertEquals("type", TransactionType.DEPOSIT, record.type());
                assertEquals("balance after", Money.of("1350.00"), record.balanceAfter());
                assertEquals("description kept", "Pay day", record.description());
            });

            t.test("a blank description falls back to the type label", () -> {
                Fixture f = new Fixture();
                assertEquals("Deposit", "Deposit", f.bank.deposit(f.checking(), Money.of("5.00"), "  ").description());
            });

            t.test("a zero deposit is refused", () ->
                    assertThrows("zero", ValidationException.class, () -> {
                        Fixture f = new Fixture();
                        f.bank.deposit(f.checking(), Money.of("0.00"), "nothing");
                    }));

            t.test("a negative deposit is refused", () ->
                    assertThrows("negative", ValidationException.class, () -> {
                        Fixture f = new Fixture();
                        f.bank.deposit(f.checking(), Money.of("-10.00"), "cheeky");
                    }));

            t.test("a deposit over the per-transaction limit is refused", () ->
                    assertThrows("over the limit", ValidationException.class, () -> {
                        Fixture f = new Fixture();
                        f.bank.deposit(f.checking(), Money.of("50000.01"), "fat finger");
                    }));

            t.test("a refused deposit changes nothing on disk", () -> {
                Fixture f = new Fixture();
                try {
                    f.bank.deposit(f.checking(), Money.of("-10.00"), "cheeky");
                } catch (ValidationException expected) {
                    // The point of the test is what happens after the throw.
                }
                assertEquals("balance untouched", Money.of("1250.00"), f.reload().checking().balance());
            });

            t.section("Withdrawals");

            t.test("a withdrawal lowers the balance", () -> {
                Fixture f = new Fixture();
                f.bank.withdraw(f.checking(), Money.of("250.00"), "Rent");
                assertEquals("1000.00", Money.of("1000.00"), f.reload().checking().balance());
            });

            t.test("withdrawing the whole balance is allowed", () -> {
                Fixture f = new Fixture();
                f.bank.withdraw(f.checking(), Money.of("1250.00"), "Everything");
                assertEquals("0.00", Money.of("0.00"), f.reload().checking().balance());
            });

            t.test("overdrawing by a cent is refused", () ->
                    assertThrows("one cent too far", InsufficientFundsException.class, () -> {
                        Fixture f = new Fixture();
                        f.bank.withdraw(f.checking(), Money.of("1250.01"), "Too much");
                    }));

            t.test("the insufficient-funds error carries both figures", () -> {
                Fixture f = new Fixture();
                try {
                    f.bank.withdraw(f.checking(), Money.of("2000.00"), "Too much");
                    throw new AssertionError("should have thrown");
                } catch (InsufficientFundsException e) {
                    assertEquals("requested", Money.of("2000.00"), e.requested());
                    assertEquals("available", Money.of("1250.00"), e.available());
                    assertEquals("shortfall", Money.of("750.00"), e.shortfall());
                }
            });

            t.test("a refused withdrawal leaves the balance alone", () -> {
                Fixture f = new Fixture();
                try {
                    f.bank.withdraw(f.checking(), Money.of("9999.00"), "Too much");
                } catch (InsufficientFundsException expected) {
                    // Expected.
                }
                assertEquals("balance untouched", Money.of("1250.00"), f.reload().checking().balance());
            });

            t.test("an account refuses to go negative even when called directly", () ->
                    assertThrows("the model guards itself too", IllegalStateException.class, () -> {
                        Account account = new Account(1, 1, AccountType.CHECKING, "1001-0001", Money.of("10.00"));
                        account.debit(Money.of("10.01"));
                    }));

            t.section("Transfers");

            t.test("a transfer moves money between both accounts", () -> {
                Fixture f = new Fixture();
                f.bank.transfer(f.checking(), f.savings(), Money.of("250.00"));
                Fixture after = f.reload();
                assertEquals("source debited", Money.of("1000.00"), after.checking().balance());
                assertEquals("target credited", Money.of("8650.50"), after.savings().balance());
            });

            t.test("a transfer leaves the customer's total unchanged", () -> {
                Fixture f = new Fixture();
                BigDecimal before = f.bank.totalBalance(f.alice());
                f.bank.transfer(f.checking(), f.savings(), Money.of("500.00"));
                assertEquals("money is conserved", before, f.reload().bank.totalBalance(f.alice()));
            });

            t.test("a transfer writes two statement lines", () -> {
                Fixture f = new Fixture();
                List<Transaction> records = f.bank.transfer(f.checking(), f.savings(), Money.of("100.00"));
                assertEquals("two records", 2, records.size());
                assertEquals("out first", TransactionType.TRANSFER_OUT, records.get(0).type());
                assertEquals("in second", TransactionType.TRANSFER_IN, records.get(1).type());
                assertTrue("the two rows have different ids",
                        records.get(0).id() != records.get(1).id());
            });

            t.test("transferring to the same account is refused", () ->
                    assertThrows("same account", ValidationException.class, () -> {
                        Fixture f = new Fixture();
                        f.bank.transfer(f.checking(), f.checking(), Money.of("10.00"));
                    }));

            t.test("transferring to someone else's account is refused", () ->
                    assertThrows("not your account", ValidationException.class, () -> {
                        Fixture f = new Fixture();
                        f.bank.transfer(f.checking(), f.bobChecking(), Money.of("10.00"));
                    }));

            t.test("a transfer larger than the balance is refused and changes nothing", () -> {
                Fixture f = new Fixture();
                try {
                    // Over the 1250.00 balance, but under the 50000.00 per-transaction limit, so it is
                    // insufficient funds that stops it and not the limit check.
                    f.bank.transfer(f.checking(), f.savings(), Money.of("5000.00"));
                    throw new AssertionError("should have thrown");
                } catch (InsufficientFundsException expected) {
                    // Expected.
                }
                Fixture after = f.reload();
                assertEquals("source untouched", Money.of("1250.00"), after.checking().balance());
                assertEquals("target untouched", Money.of("8400.50"), after.savings().balance());
            });

            t.section("Balances and history");

            t.test("the total is the sum of the customer's accounts only", () -> {
                Fixture f = new Fixture();
                // Alice's 1250.00 + 8400.50. Bob's accounts must not be counted.
                assertEquals("9650.50", Money.of("9650.50"), f.bank.totalBalance(f.alice()));
            });

            t.test("accounts are listed checking first", () -> {
                Fixture f = new Fixture();
                List<Account> accounts = f.bank.accountsOf(f.alice());
                assertEquals("two accounts", 2, accounts.size());
                assertEquals("checking first", AccountType.CHECKING, accounts.get(0).type());
            });

            t.test("history is newest first", () -> {
                Fixture f = new Fixture();
                f.bank.deposit(f.checking(), Money.of("10.00"), "First");
                f.bank.deposit(f.reload().checking(), Money.of("20.00"), "Second");
                List<Transaction> history = f.reload().bank.statement(f.checking(), 10);
                assertEquals("newest first", "Second", history.get(0).description());
            });

            t.test("history is capped at the requested limit", () -> {
                Fixture f = new Fixture();
                for (int i = 0; i < 6; i++) {
                    f.bank.deposit(f.reload().checking(), Money.of("1.00"), "Deposit " + i);
                }
                assertEquals("capped at 3", 3, f.bank.statement(f.checking(), 3).size());
            });

            t.test("history only shows the account asked for", () -> {
                Fixture f = new Fixture();
                f.bank.deposit(f.savings(), Money.of("10.00"), "Savings only");
                long savingsId = f.savings().id();
                assertTrue("every row belongs to that account",
                        f.bank.statement(f.savings(), 50).stream().allMatch(x -> x.accountId() == savingsId));
            });

            t.test("balance_after on each row matches the running balance", () -> {
                // The check that catches a ledger drifting out of step with its account.
                Fixture f = new Fixture();
                f.bank.deposit(f.checking(), Money.of("100.00"), "One");
                f.bank.withdraw(f.reload().checking(), Money.of("50.00"), "Two");
                Fixture after = f.reload();
                Transaction newest = after.bank.statement(after.checking(), 1).get(0);
                assertEquals("ledger agrees with the account",
                        after.checking().balance(), newest.balanceAfter());
            });

            t.test("a signed amount reads like a statement", () -> {
                Fixture f = new Fixture();
                Transaction record = f.bank.withdraw(f.checking(), Money.of("40.00"), "Cash");
                assertEquals("negative for a withdrawal", Money.of("-40.00"), record.signedAmount());
            });

            t.section("Stores");

            t.test("nextId starts at 1 on an empty table", () -> {
                UserStore store = new UserStore(tempDir());
                assertEquals("first id", 1L, store.nextId());
            });

            t.test("nextId follows the highest existing id", () -> {
                Fixture f = new Fixture();
                assertEquals("after the seeded two", 3L, f.users.nextId());
            });

            t.test("findById returns empty rather than null for a missing row", () -> {
                Fixture f = new Fixture();
                assertTrue("empty Optional", f.accounts.findById(999).isEmpty());
            });

            t.test("findByUser returns nothing for an unknown customer", () -> {
                Fixture f = new Fixture();
                assertTrue("no accounts", f.accounts.findByUser(999).isEmpty());
            });
        }
    }

    /** Runs the body and returns the exception message, so two failures can be compared. */
    private static String messageOf(Runnable body) {
        try {
            body.run();
            throw new AssertionError("expected an exception");
        } catch (RuntimeException e) {
            return e.getMessage();
        }
    }

    /**
     * A fresh throwaway directory.
     *
     * <p>createTempDirectory throws a <em>checked</em> IOException, and a lambda passed to
     * {@code t.test(...)} is a {@link Runnable}, which is declared to throw nothing. So every test
     * body would need its own try/catch. Wrapping once, here, in an unchecked UncheckedIOException
     * keeps the tests readable — the same trade-off {@code CsvTable} makes for the same reason.
     *
     * <p>deleteOnExit is not called: the OS clears its temp directory, and leaving the files behind
     * is handy when a test fails and you want to look at what it wrote.
     */
    private static Path tempDir() {
        try {
            return Files.createTempDirectory("bank-test");
        } catch (IOException e) {
            throw new java.io.UncheckedIOException("Could not create a temp directory for the test", e);
        }
    }

    /**
     * The test fixture: a throwaway data directory seeded with two customers.
     *
     * <p>Building it fresh per test is what keeps the suite order-independent. {@link #reload()}
     * returns a second Fixture over the <em>same</em> directory, which is how a test asserts that
     * something really reached the disk rather than only the object in memory.
     */
    private static class Fixture {
        final Path dir;
        final UserStore users;
        final AccountStore accounts;
        final TransactionStore transactions;
        final AuthService auth;
        final BankService bank;

        Fixture() {
            this(seed(tempDir()));
        }

        Fixture(Path dir) {
            this.dir = dir;
            this.users = new UserStore(dir);
            this.accounts = new AccountStore(dir);
            this.transactions = new TransactionStore(dir);
            this.auth = new AuthService(users);
            this.bank = new BankService(accounts, transactions);
        }

        Fixture reload() {
            return new Fixture(dir);
        }

        User alice() {
            return users.findByEmail("alice@bank.test").orElseThrow();
        }

        Account checking() {
            return ofAlice(0);
        }

        Account savings() {
            return ofAlice(1);
        }

        Account bobChecking() {
            return accounts.findByUser(users.findByEmail("bob@bank.test").orElseThrow().id()).get(0);
        }

        private Account ofAlice(int index) {
            return accounts.findByUser(alice().id()).stream()
                    .sorted(Comparator.comparing(Account::id))
                    .toList()
                    .get(index);
        }

        private static Path seed(Path dir) {
            try {
                Files.writeString(dir.resolve("users.csv"), """
                    id,email,password,full_name,created_at
                    1,alice@bank.test,password123,Alice Fifita,2026-01-15T09:12:00
                    2,bob@bank.test,password123,Bob Tupou,2026-02-03T14:40:00
                    """);
                Files.writeString(dir.resolve("accounts.csv"), """
                    id,user_id,type,number,balance
                    1,1,CHECKING,1001-0001,1250.00
                    2,1,SAVINGS,1001-0002,8400.50
                    3,2,CHECKING,1002-0001,310.75
                    """);
                Files.writeString(dir.resolve("transactions.csv"), """
                    id,account_id,type,amount,balance_after,timestamp,description
                    1,1,DEPOSIT,1500.00,1500.00,2026-01-15T09:15:00,Opening deposit
                    """);
            } catch (IOException e) {
                throw new java.io.UncheckedIOException("Could not seed the test data", e);
            }
            return dir;
        }
    }
}
