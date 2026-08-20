#!/usr/bin/env bash
# Compile and run the bank console app.
#
# No Maven or Gradle on purpose: a reader can see every command that turns .java files into a
# running program. `set -e` stops the script the moment javac fails, instead of running a stale
# build and leaving you debugging the wrong code.
set -e

cd "$(dirname "$0")"

mkdir -p out
# Compile every source file into out/. -d sets the output directory; the package structure is
# recreated underneath it.
javac -d out $(find src -name '*.java')

# -cp out tells java where the compiled classes live; then the fully-qualified class with main().
java -cp out com.bank.BankApp "$@"
