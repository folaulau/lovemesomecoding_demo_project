#!/usr/bin/env bash
# The whole Java suite: unit tests, then the end-to-end console run.
set -e

cd "$(dirname "$0")"

mkdir -p out
javac -d out $(find src test -name '*.java')
java -cp out com.bank.BankTests

./e2e.sh
