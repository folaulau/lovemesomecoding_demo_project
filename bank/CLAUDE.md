# Bank

A console bank written twice — Java and Python — over the same CSV files. It exists to produce
**tutorial snippets** for lovemesomecoding.com, so readability and teachability outrank cleverness.
Where a "real production" choice and a "clear teaching example" choice conflict, prefer the teaching
one and leave a comment explaining what production would do differently.

**`progress_report.md` in this directory is the shared context — read it first when resuming.**
This file is the standing instructions; that one is the state.

---

## The rules that matter

### The two apps must stay mirror images
`parity.sh` pipes the same keystrokes into both and diffs the console output *and* the CSV files
byte for byte. **Change one app, change the other in the same commit**, or parity fails. That
symmetry is the whole product — a reader compares the two files side by side.

### No dependencies, ever
Java 21 and Python 3.12 standard libraries only. No Maven, Gradle, pip, virtualenv or database.
A reader must be able to clone and run with nothing installed. This is also why the Java side
hand-rolls a CSV parser and a test runner: with no build tool there is no way to fetch JUnit, and
seeing the whole of a test framework at once is worth more here than reusing one.

### Comments are the deliverable
Every non-obvious choice explains *why*, because those comments become the tutorial prose. A comment
that restates the code (`// add the amount`) is noise; one that says what breaks without the line is
the point. Keep them accurate — a wrong comment in a teaching repo is worse than none.

### Only `data/seed/` is committed
`data/*.csv` are the working files and are gitignored. Both apps copy from `seed/` on first run, so
running the app can never dirty the repo, and deleting them is a full reset. `BANK_DATA_DIR`
overrides the location, which is how every test runs against a throwaway directory.

---

## Structure

```
bank/
├── data/seed/*.csv            committed; the working data/*.csv is gitignored
├── bank-java-console/         run.sh · test.sh · e2e.sh · src/com/bank/ · test/com/bank/
├── bank-python-console/       run.sh · test.sh · e2e.sh · bank/ · tests/
├── parity.sh                  the two apps must agree, byte for byte
└── test.sh                    everything
```

The modules mirror each other one-to-one — `model/Money.java` ↔ `money.py`, `ui/BankMenu.java` ↔
`menu.py`, and so on. The full table is in `README.md`.

**Layers, in both languages:** models → stores (CSV) → services (all the rules) → console/menu (all
the I/O) → app (wiring only). No balance is ever calculated in a UI file, and no `print` or `input`
appears outside `Console`. That line is what makes the rules testable without a keyboard, and it is
the habit the tutorials are selling.

---

## Gotchas that already cost time — do not rediscover these

- **`csv.DictWriter` defaults to `\r\n`.** The "excel" dialect ends every row with CRLF, so the same
  data written by Python and by Java differs byte for byte, every save flips the whole file in git,
  and parity fails. `lineterminator="\n"` is load-bearing in `csv_table.py`.
- **Re-find the account in the freshly-loaded list before mutating it.** The `Account` the menu holds
  was read from disk earlier and is a *different object* from the one in the list about to be saved.
  Mutate the stale copy and the change silently vanishes — it looks like "the app forgets my
  deposit". `BankService._locate` exists for this and nothing else.
- **A transfer saves both accounts in one write.** Two separate saves would leave the money nowhere
  at all if the process died between them.
- **Python's default rounding is ROUND_HALF_EVEN**, so 2.345 → 2.34 and the two apps disagree on a
  half-cent. `round_money` states `ROUND_HALF_UP` explicitly.
- **Never build a `Decimal`/`BigDecimal` from a float** — the value is already wrong before it gets
  there. Always from a string.
- **`BigDecimal.equals` compares scale too**, so `1.0` does not equal `1.00`. Use `compareTo`.
- A `Runnable` lambda cannot throw a checked exception, which is why the Java tests wrap
  `IOException` in `UncheckedIOException` instead of declaring `throws`.
- The seed data is duplicated in the test files on purpose — the tests must not break when the demo
  data is edited.

## Deliberately out of scope
Registration, admin, closing accounts, interest, overdrafts, multi-currency, concurrency. The app is
kept small enough that a reader can hold all of it in their head; every addition costs that.

⚠️ **Passwords are stored in plaintext** and compared with `==`. That is a conscious choice for a
throwaway teaching fixture with fake data, and both `User` classes say so in a comment. If this ever
points at real data, that is the first thing to fix.

---

## Test

```bash
./test.sh                       # everything — run this
./bank-java-console/test.sh     # 51 unit + 7 end-to-end
./bank-python-console/test.sh   # 58 unit + 7 end-to-end
./parity.sh                     # 5 cross-language checks
```

- Tests assert **after re-reading the files**, never against the in-memory object. A test that skips
  the reload passes even when saving is completely broken.
- Every test builds its own temp directory via `BANK_DATA_DIR`, so order never matters.
- The end-to-end scripts drive the real console by piping keystrokes — the console-app equivalent of
  a browser test, and the only thing that covers the menu and the parsing.
- Aim for ~90% coverage of changes, and cover the refusals (negative amounts, overdrafts, wrong
  passwords) as well as the happy path. A rule that silently stops being enforced looks exactly like
  a passing app.

## Git
- Do **not** add `Co-Authored-By` or any author trailer.
- Do **not** push — the user does that.
- Never commit `out/`, `__pycache__/`, `*.class` or the working `data/*.csv`.
- Write a real commit message explaining *why*, not just what.
