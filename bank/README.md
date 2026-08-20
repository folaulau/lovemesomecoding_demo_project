# Bank

A console bank, written **twice** — once in Java and once in Python — over the same CSV files.

It exists to produce tutorial snippets for lovemesomecoding.com. Readability and teachability
outrank cleverness: where a "real production" choice and a "clear teaching example" choice
conflict, the teaching one wins and a comment explains what production would do differently.

```
Welcome to Love Some Coding Bank
================================
Test sign-in: alice@bank.test / password123

Hello, Alice
============
Total balance: $9,650.50

  1) View accounts
  2) Deposit
  3) Withdraw
  4) Transfer between accounts
  5) Transaction history
  6) Sign out
```

## Running it

Nothing to install. Java 21 and Python 3.12 are all it needs — no Maven, no Gradle, no pip, no
virtualenv, no database.

```bash
./bank-java-console/run.sh        # Java
./bank-python-console/run.sh      # Python
./test.sh                         # both suites + the parity check
```

Sign in as `alice@bank.test` / `password123` (two accounts) or `bob@bank.test` / `password123`.

Both apps read and write the **same** `data/*.csv` files, so you can deposit in Java and see it in
Python. Delete `data/*.csv` for a full reset — they are recreated from `data/seed/` on the next run.

## What is in it

| | |
|---|---|
| Sign in | Three attempts, one deliberately vague failure message |
| View accounts | Checking and savings, with a running total |
| Deposit / Withdraw | Validated, capped, never overdraws |
| Transfer | Between the customer's own accounts, both sides saved in one write |
| History | Last 10 transactions per account, newest first, column-aligned |

The "database" is three CSV files, one per table:

```
data/users.csv         id,email,password,full_name,created_at
data/accounts.csv      id,user_id,type,number,balance
data/transactions.csv  id,account_id,type,amount,balance_after,timestamp,description
```

## Layout

The two apps mirror each other file for file, so they can be read side by side:

| Java | Python | What it does |
|---|---|---|
| `model/Money.java` | `money.py` | BigDecimal / Decimal, and why never `double` |
| `model/*.java` | `models.py` | `record` / `@dataclass`, `enum` / `Enum` |
| `error/*.java` | `errors.py` | One exception base class, so one `catch` covers the app |
| `store/CsvTable.java` | `csv_table.py` | Quoting done by hand vs `import csv` |
| `store/CsvStore.java` | `stores.py` | Generics + an abstract base, one implementation of find/save |
| `service/*.java` | `services.py` | Every banking rule, testable without a keyboard |
| `ui/Console.java` | `console.py` | The only file that touches stdin/stdout |
| `ui/BankMenu.java` | `menu.py` | The screens |
| `BankApp.java` | `app.py` | Wiring, and nothing else |

## Tests

```bash
./test.sh                       # everything — 51 Java + 58 Python + 14 end-to-end + 5 parity
./bank-java-console/test.sh     # javac, run the suite, then drive the real console app
./bank-python-console/test.sh   # unittest, then drive the real console app
./parity.sh                     # the two apps must produce identical output and identical files
```

`parity.sh` is the interesting one: it pipes the same keystrokes into both apps and diffs the
console output *and* the CSV files byte for byte. The claim that these are two implementations of
one program is tested, not asserted.

## Fundamentals this covers

**Java** — records · enums with fields and behaviour · classes and encapsulation · interfaces vs
abstract classes · generics · collections · `Optional` · streams, lambdas and method references ·
`switch` expressions · text blocks · checked vs unchecked exceptions · custom exception hierarchies ·
try-with-resources · `BigDecimal` · `java.nio.file` · `String.format` · `LocalDateTime`

**Python** — dataclasses (frozen and not) · `Enum` · `ABC` and `@abstractmethod` · `TypeVar` and
`Generic` · type hints · list comprehensions and generator expressions · lambdas and first-class
functions · dict dispatch · `@property`, `@staticmethod`, `@classmethod` · `__str__` / `__post_init__` /
`__name__` · context managers · exception chaining with `raise … from` · `Decimal` · `pathlib` ·
the `csv` module · f-string formatting · `unittest`

Every non-obvious choice carries a comment explaining *why* — those comments are the tutorial
material.
