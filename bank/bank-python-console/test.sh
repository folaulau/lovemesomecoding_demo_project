#!/usr/bin/env bash
# The whole Python suite: unit tests, then the end-to-end console run.
set -e

cd "$(dirname "$0")"

# discover finds every test_*.py under tests/ — a new test file is picked up with no list to edit.
python3 -m unittest discover -s tests "$@"

./e2e.sh
