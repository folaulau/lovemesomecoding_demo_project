#!/usr/bin/env bash
# Run the bank console app.
#
# No virtualenv and no pip install: the app uses only the standard library, so there is nothing to
# install. `python3 -m bank` runs the package — it finds bank/__main__.py and executes it.
set -e

cd "$(dirname "$0")"

python3 -m bank "$@"
