"""Push metadata.py into a running Hasura.

    python -m scripts.apply

Uses the metadata API's `replace_metadata` — the whole document at once, so what runs is exactly
what is in the file. Applying table-by-table would leave whatever a previous run created and make
the file a wish rather than a description.
"""

import json
import os
import sys
import urllib.error
import urllib.request

from metadata import build

HASURA_URL = os.getenv("HASURA_URL", "http://localhost:8081")
ADMIN_SECRET = os.getenv("HASURA_ADMIN_SECRET", "stayhub-admin-secret")


def call(payload: dict) -> dict:
    request = urllib.request.Request(
        f"{HASURA_URL}/v1/metadata",
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            # The admin secret bypasses every permission rule. It belongs in scripts and in the
            # console — never in a frontend, where it would hand every visitor the admin role.
            "x-hasura-admin-secret": ADMIN_SECRET,
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as exc:
        body = exc.read().decode()
        print(f"Hasura rejected the request ({exc.code}):", file=sys.stderr)
        try:
            print(json.dumps(json.loads(body), indent=2), file=sys.stderr)
        except json.JSONDecodeError:
            print(body, file=sys.stderr)
        raise SystemExit(1) from exc


def main() -> None:
    print(f"Applying metadata to {HASURA_URL} …")
    call({
        "type": "replace_metadata",
        "args": {
            # Refuse rather than silently drop anything metadata.py does not mention. If a table
            # was tracked by hand in the console, this makes that visible instead of erasing it.
            "allow_inconsistent_metadata": False,
            "metadata": build(),
        },
    })

    # `replace_metadata` returning 200 only means Hasura ACCEPTED the document. Asking for the
    # inconsistency list is what confirms every table and relationship actually resolved.
    inconsistencies = call({"type": "get_inconsistent_metadata", "args": {}})
    problems = inconsistencies.get("inconsistent_objects", [])
    if problems:
        print(f"\n{len(problems)} inconsistent object(s):", file=sys.stderr)
        for item in problems:
            print(f"  - {item.get('reason')}", file=sys.stderr)
        raise SystemExit(1)

    doc = build()
    tables = doc["sources"][0]["tables"]
    print(f"  {len(tables)} tables tracked, metadata consistent")
    print()
    print("  ⚠️ No insert/update/delete permissions exist for ANY role — deliberately.")
    print("     Every write goes through FastAPI, which is what makes server-side pricing,")
    print("     the availability check and the cancellation rule impossible to bypass.")
    print()
    print(f"  Console: {HASURA_URL}  (admin secret: {ADMIN_SECRET})")


if __name__ == "__main__":
    main()
