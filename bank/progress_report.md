# Bank demo app — progress report

Shared context for the bank demo (Java console + Python console, CSV "database").
Read this first when resuming work.

**Status:** Complete and working. Both apps built, both suites green, cross-language parity proven.
**51 Java tests + 58 Python tests + 14 end-to-end + 5 parity checks, all green.**
**Last updated:** 2026-08-20

**Run it:** `./bank-java-console/run.sh` · `./bank-python-console/run.sh`
**Test it:** `./test.sh` (everything) · `./parity.sh` (the two apps must agree byte for byte)
**Demo logins:** `alice@bank.test` / `password123` (two accounts) · `bob@bank.test` / `password123`

Nothing to install: Java 21 and Python 3.12 standard libraries only.

---

## Purpose

A console bank that exists to produce **tutorial snippets** for lovemesomecoding.com, covering Java
and Python fundamentals. Written twice over the same CSV files so a reader can compare the two
languages doing the same job, line for line.

---

## Requirements, and how they were read

From `README.md` as originally written, plus the clarifications below:

| Requirement | Decision |
|---|---|
| Bank console app | ✅ Both languages |
| No database, one CSV per table | ✅ `users.csv`, `accounts.csv`, `transactions.csv` |
| Sign in with a test email and password | ✅ Two seeded customers |
| Deposit and withdraw | ✅ Plus transfer and history — see below |
| Java **and** Python | ✅ Mirrored module for module |
| "Use all Java and Python basic fundamentals" | ✅ Read as the driving constraint, not a nice-to-have |

### Clarified 2026-08-20 (asked, not assumed)

1. **Scope** — *core + history + transfer*, chosen over "exactly the README" and over
   "+ registration and admin". Two accounts per customer (CHECKING, SAVINGS), a transaction ledger,
   and transfers between a customer's own accounts. Enough surface to demo collections, enums,
   streams/comprehensions and sorting, still small enough to read in one sitting.
2. **Java build** — *plain `javac`, no build tool*, chosen over Maven and Gradle. A reader can see
   every command that turns `.java` files into a running program.
   **Consequence:** no way to fetch JUnit, so `test/com/bank/TestRunner.java` is a hand-rolled
   ~60-line test framework. This turned out to be a feature — seeing the whole of a test runner at
   once demystifies the thing — but it is why the Java suite does not look like a normal one.
3. **Passwords** — *plaintext*, chosen over salted SHA-256. Deliberate for a throwaway teaching
   fixture. Both `User` classes carry a comment saying so, and `CLAUDE.md` flags it. **If this ever
   points at real data, that is the first thing to fix.**

---

## Decisions

- **Two apps, one data directory.** Both read and write `data/*.csv`, so a deposit made in Java is
  visible in Python. This is what makes the parity claim demonstrable rather than rhetorical.
- **Only `data/seed/` is committed**; the working files are gitignored and copied from seed on first
  run. Running the app can never dirty the repo, and deleting `data/*.csv` is a full reset.
- **`BANK_DATA_DIR` overrides the data location.** Every test uses it to run against a throwaway
  temp directory. Configuration through the environment, no code change.
- **Layers: models → stores → services → console/menu → app.** No balance is calculated in a UI
  file; no `print`/`input` outside `Console`. That line is what the tutorials are actually selling.
- **The Java side hand-writes a CSV parser; the Python side calls `import csv`.** Deliberate
  asymmetry, and the most instructive pair of files in the project: one shows what quoting involves,
  the other shows that you should not write it yourself when the stdlib has it.
- **`Money`/`money.py` centralise BigDecimal and Decimal.** Both include a test that
  `0.1 + 0.2 != 0.3` in floating point, because that is the whole argument.
- **Every store extends one generic abstract base** (`CsvStore<T>` / `CsvStore(ABC, Generic[T])`),
  so find/save/next_id are written once. Same template-method shape as a real DAO layer.
- **`parity.sh` is a real test, not a demo.** It diffs console output and CSV files byte for byte,
  exempting only the timestamp column.

---

## Gotchas paid for during the build

- **`csv.DictWriter` defaults to `\r\n`.** Caught by the first parity run: identical data, different
  bytes. `lineterminator="\n"` in `csv_table.py` is load-bearing.
- **The stale-object trap.** The `Account` the menu holds is a different object from the one in the
  list about to be saved. Mutate the wrong one and the deposit silently vanishes.
  `BankService._locate` / `locate` exists for this and nothing else, and is commented in both apps.
- **Python's default rounding is banker's rounding**, so `2.345` → `2.34` while Java's HALF_UP gives
  `2.35`. The two apps would disagree on a half-cent. `round_money` states the mode explicitly.
- **A `Runnable` lambda cannot throw a checked exception**, so the Java tests wrap `IOException` in
  `UncheckedIOException` rather than declaring `throws` on every test body.
- **`String == String` almost shipped into a tutorial.** An early `Console.END_OF_INPUT` sentinel
  meant `email == Console.END_OF_INPUT` — correct, since the constant was `null`, but it *reads* as
  reference comparison on Strings, which is the single most common beginner Java bug. Replaced with
  plain `null` checks and a comment about exactly that trap.
- **Python `import os` was left at the bottom of `stores.py`** with a comment excusing it. Moved to
  the top: a teaching repo does not get to model a habit it would tell a reader not to have.

---

## Test coverage

| Suite | Count | Covers |
|---|---|---|
| Java unit | 51 | Money, CSV parsing/escaping, users, sign-in, deposits, withdrawals, transfers, balances, history, stores |
| Java e2e | 7 | The real console driven by piped keystrokes, then the CSVs inspected |
| Python unit | 58 | The same ground, plus dataclass immutability and ABC enforcement |
| Python e2e | 7 | Same as Java's |
| Parity | 5 | Identical console output, identical `users.csv` / `accounts.csv`, identical transactions ignoring timestamps, and Python reading the file Java just wrote |

Refusals are covered as heavily as the happy path — negative amounts, zero amounts, over-limit
amounts, overdrafts by one cent, transfers to the same account, transfers to another customer's
account, wrong passwords, unknown emails — and each of those also asserts that **nothing changed on
disk**. A rule that silently stops being enforced looks exactly like a passing app.

---

## Deliberately out of scope

Registration, admin, closing accounts, interest, overdrafts, multi-currency, concurrency. The app is
kept small enough that a reader can hold all of it in their head; every addition costs that.

## Possible next steps

- [ ] Write the tutorial posts. The comments in the source are the draft prose — the Java-vs-Python
      pairs (`Money.java` / `money.py`, `CsvTable.java` / `csv_table.py`) are the strongest.
- [ ] Consider a third implementation (Go? TypeScript?) if the parity idea proves useful in a post.
- [ ] Nothing is broken or half-finished. Do not "improve" one app without doing the same to the
      other — parity is the product.
