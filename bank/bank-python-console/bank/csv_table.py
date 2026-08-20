"""Reading and writing one CSV file — this app's stand-in for a database table.

Compare this with `store/CsvTable.java`, which hand-writes a parser to show what quoting actually
involves. Python ships `csv` in the standard library, so the right answer here is to use it: it
already handles commas inside quoted fields, doubled quotes, and newlines inside a value. Writing
your own when the standard library has one is how you end up with a rare bug in someone's surname.

Every write rewrites the whole file. That is O(n) per save and would be indefensible in a real
system; it is chosen here because it is obvious. A database does the clever version for you, which
is rather the point of using one.
"""

from __future__ import annotations

import csv
import os
import tempfile
from pathlib import Path


class CsvTable:
    """One CSV file, addressed by column name."""

    def __init__(self, file: Path, header: list[str]) -> None:
        self.file = file
        # tuple(), not list(): a tuple is immutable, so a caller cannot change the header later by
        # holding on to the list they passed in. Python's version of a defensive copy.
        self.header = tuple(header)

    def read_all(self) -> list[dict[str, str]]:
        """Every row, as a dict keyed by column name. Empty list when the file does not exist yet.

        `row["user_id"]` survives someone adding a column; `row[1]` does not.
        """
        if not self.file.exists():
            return []

        # `with` is a context manager: the file is closed when the block ends, even if the code in
        # it raises. Python's answer to try-with-resources, and the reason you rarely see .close().
        #
        # newline="" is required by the csv module — it does its own newline handling, and without
        # this a quoted field containing a newline is split into two rows on Windows.
        with self.file.open(newline="", encoding="utf-8") as handle:
            # DictReader takes the first line as the header and yields a dict per row.
            return [dict(row) for row in csv.DictReader(handle)]

    def write_all(self, rows: list[dict[str, str]]) -> None:
        """Replace the file contents with these rows, header first."""
        self.file.parent.mkdir(parents=True, exist_ok=True)

        # Write to a temp file in the same directory, then rename it over the original. os.replace
        # is atomic on every OS Python supports, so a crash mid-write leaves the old file intact
        # rather than a half-written one. Cheap insurance, and a good habit.
        handle = tempfile.NamedTemporaryFile(
            mode="w", newline="", encoding="utf-8", dir=self.file.parent, delete=False
        )
        try:
            with handle:
                # lineterminator="\n" is not optional here. The csv module defaults to the
                # "excel" dialect, which ends every row with \r\n — so the same data written by
                # this app and by the Java one beside it differs byte for byte, every save flips
                # the whole file in git, and anything comparing the two files disagrees about
                # identical content. Say which line ending you want.
                writer = csv.DictWriter(handle, fieldnames=self.header, lineterminator="\n")
                writer.writeheader()
                for row in rows:
                    # Fill in any missing column rather than letting DictWriter raise.
                    writer.writerow({column: row.get(column, "") for column in self.header})
            os.replace(handle.name, self.file)
        except BaseException:
            # If anything went wrong the temp file is litter — remove it before re-raising.
            # A bare `raise` re-raises the original exception with its traceback intact.
            Path(handle.name).unlink(missing_ok=True)
            raise
