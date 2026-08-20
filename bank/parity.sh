#!/usr/bin/env bash
# Proves the two implementations are interchangeable.
#
# The same script of answers is piped into the Java app and the Python app, each against its own
# copy of the seed data. Then both the console output and the resulting CSV files are compared.
# They must match byte for byte — that is the claim the tutorials make about this project, so it
# gets tested rather than asserted.
#
# The only column allowed to differ is a timestamp, because the two runs happen at different
# instants. Everything else — balances, ids, alignment, currency formatting, line endings — is
# required to be identical.
set -e

cd "$(dirname "$0")"

JAVA_DIR="$(mktemp -d)"
PY_DIR="$(mktemp -d)"
OUT_DIR="$(mktemp -d)"
trap 'rm -rf "$JAVA_DIR" "$PY_DIR" "$OUT_DIR"' EXIT

cp data/seed/*.csv "$JAVA_DIR/"
cp data/seed/*.csv "$PY_DIR/"

SCRIPT='alice@bank.test
password123
1
2
1
100.50
Pay day
3
2
25
Coffee
4
1
2
250
5
1
6
'

echo
echo "Parity: Java vs Python"
echo "----------------------"

echo "$SCRIPT" | BANK_DATA_DIR="$JAVA_DIR" ./bank-java-console/run.sh > "$OUT_DIR/java.txt" 2>&1
echo "$SCRIPT" | BANK_DATA_DIR="$PY_DIR" ./bank-python-console/run.sh > "$OUT_DIR/python.txt" 2>&1

fail() { echo "  ✗ $1"; shift; "$@"; exit 1; }

# The statement screen prints the times of the transactions just made, so those lines legitimately
# differ between the two runs. Blank them out before comparing; nothing else is exempt.
strip_times() { sed -E 's/[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}/<TIME>/g' "$1"; }

diff <(strip_times "$OUT_DIR/java.txt") <(strip_times "$OUT_DIR/python.txt") \
  || fail "console output differs" true
echo "  ✓ identical console output"

diff "$JAVA_DIR/accounts.csv" "$PY_DIR/accounts.csv" || fail "accounts.csv differs" true
echo "  ✓ identical accounts.csv (byte for byte)"

diff "$JAVA_DIR/users.csv" "$PY_DIR/users.csv" || fail "users.csv differs" true
echo "  ✓ identical users.csv (byte for byte)"

# Every column of transactions.csv except the timestamp.
diff <(cut -d, -f1-5,7 "$JAVA_DIR/transactions.csv") \
     <(cut -d, -f1-5,7 "$PY_DIR/transactions.csv") || fail "transactions.csv differs" true
echo "  ✓ identical transactions.csv (ignoring timestamps)"

# Cross-check: the Python app must read the file the Java app just wrote, and agree on the total.
JAVA_TOTAL=$(grep -E '^[12],1,' "$JAVA_DIR/accounts.csv" | cut -d, -f5 | paste -sd+ - | bc)
PY_TOTAL=$(BANK_DATA_DIR="$JAVA_DIR" ./bank-python-console/run.sh <<'INPUT' | grep -m1 'Total balance' | tr -d '$,'
alice@bank.test
password123
6

INPUT
)
PY_TOTAL=${PY_TOTAL##*: }
[ "$JAVA_TOTAL" = "$PY_TOTAL" ] || fail "Python read $PY_TOTAL from the Java app's file, expected $JAVA_TOTAL" true
echo "  ✓ Python reads the file the Java app wrote and agrees on the total"

echo
echo "Parity passed."
