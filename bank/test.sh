#!/usr/bin/env bash
# Everything: the Java suite, the Python suite, and the cross-language parity check.
# This is the one to run.
set -e

cd "$(dirname "$0")"

echo "════════ Java ════════"
./bank-java-console/test.sh

echo
echo "════════ Python ════════"
./bank-python-console/test.sh

echo
echo "════════ Parity ════════"
./parity.sh
