#!/usr/bin/env bash
# Drives the real console app by piping a script of answers into it, then checks what it printed
# and what it wrote to the CSVs. This is the console-app equivalent of a browser test: it exercises
# the menu, the parsing and the file writing together, which no unit test does.
#
# BANK_DATA_DIR points the app at a throwaway copy of the seed data, so a test run never touches
# the real files.
set -e

cd "$(dirname "$0")"

DATA_DIR="$(mktemp -d)"
trap 'rm -rf "$DATA_DIR"' EXIT   # Clean up even if an assertion below fails.
cp ../data/seed/*.csv "$DATA_DIR/"

OUTPUT="$(BANK_DATA_DIR="$DATA_DIR" ./run.sh <<'INPUT'
alice@bank.test
password123
2
1
100.50
Pay day
4
1
2
250
6

INPUT
)"

fail() { echo "  ✗ $1"; echo "$OUTPUT"; exit 1; }
pass() { echo "  ✓ $1"; }

echo
echo "End-to-end"
echo "----------"

grep -q "Signed in as Alice Fifita" <<<"$OUTPUT" || fail "signs in"
pass "signs in"

grep -q "Deposited \$100.50" <<<"$OUTPUT" || fail "deposits"
pass "deposits"

grep -q "Transferred \$250.00" <<<"$OUTPUT" || fail "transfers"
pass "transfers"

grep -q "^1,1,CHECKING,1001-0001,1100.50$" "$DATA_DIR/accounts.csv" || fail "checking balance written"
pass "checking balance written to accounts.csv"

grep -q "^2,1,SAVINGS,1001-0002,8650.50$" "$DATA_DIR/accounts.csv" || fail "savings balance written"
pass "savings balance written to accounts.csv"

# One deposit plus the two halves of the transfer = three new rows on top of the seeded six.
ROWS=$(( $(wc -l < "$DATA_DIR/transactions.csv") - 1 ))
[ "$ROWS" -eq 9 ] || fail "expected 9 transaction rows, found $ROWS"
pass "three transaction rows appended"

# A wrong password must not sign in.
BAD="$(BANK_DATA_DIR="$DATA_DIR" ./run.sh <<'INPUT'
alice@bank.test
wrongpassword

INPUT
)"
grep -q "Invalid email or password" <<<"$BAD" || fail "rejects a bad password"
grep -q "Signed in as" <<<"$BAD" && fail "signed in with a bad password!"
pass "rejects a bad password"

echo
echo "End-to-end passed."
