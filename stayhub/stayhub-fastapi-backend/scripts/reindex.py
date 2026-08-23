"""Index maintenance: adopt the alias layout, change a mapping with no downtime, or rebuild.

    python -m scripts.reindex --status     # what the alias points at, and what else exists
    python -m scripts.reindex --adopt      # one-time: concrete index -> alias + generation
    python -m scripts.reindex              # zero-downtime reindex into a new generation
    python -m scripts.reindex --drop-old   # ...and delete the previous one afterwards
    python -m scripts.reindex --rebuild    # throw the index away and refill from Postgres

**--adopt vs the default.** `--adopt` is for a cluster created before the alias existed, where
`stayhub-properties` is a real index. It cannot be done in place: an alias and an index may not
share a name, so the documents move to `stayhub-properties-000001` and the old index is deleted
to free the name — in that order, and only then is the alias created. There is a gap of a few
milliseconds where the alias resolves to nothing, which is why this is a one-time script with a
prompt and not something `ensure_index` does at startup.

**The default (no flags) has no gap at all**, because there is already an alias to move.

**--rebuild is the repair path**, not a migration: it drops everything and re-reads Postgres. It is
correct here only because the index is derived data. Search returns nothing while it runs.
"""

import argparse
import sys

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.enums import PropertyStatus
from app.models.property import Property
from app.search.client import get_es
from app.search.index import ALIAS, INDEX_SETTINGS, current_index, next_generation, reindex_into_new
from app.search.indexer import rebuild_index


def published_properties(db):
    """The same set the indexer considers visible — published and not soft-deleted."""
    return list(
        db.execute(
            select(Property).where(
                Property.status == PropertyStatus.PUBLISHED,
                Property.deleted.is_(False),
            )
        )
        .scalars()
        .unique()
    )


def status(es) -> None:
    print(f"alias:  {ALIAS}")
    target = current_index(es)
    print(f"points at: {target or '(no alias — see --adopt)'}")
    print(f"next generation would be: {next_generation(es)}")
    print("\nindices:")
    for name in sorted(es.indices.get(index=f"{ALIAS}*", ignore_unavailable=True)):
        count = es.count(index=name)["count"]
        aliases = ", ".join(es.indices.get_alias(index=name).get(name, {}).get("aliases", {})) or "-"
        marker = " <- alias" if name == target else ""
        print(f"  {name:32} {count:6} docs   aliases: {aliases}{marker}")


def adopt(es) -> int:
    """Move a pre-alias concrete index onto the generation + alias layout."""
    if current_index(es) is not None:
        print(f"{ALIAS} is already an alias -> {current_index(es)}. Nothing to adopt.")
        return 0
    if not es.indices.exists(index=ALIAS):
        print(f"No index called {ALIAS}. Nothing to adopt — startup will create it.")
        return 0

    new = next_generation(es)
    docs = es.count(index=ALIAS)["count"]
    print(f"{ALIAS} is a concrete index with {docs} documents.")
    print(f"  1. create {new}")
    print(f"  2. reindex {ALIAS} -> {new}")
    print(f"  3. delete {ALIAS}  (frees the name; SEARCH IS DOWN from here)")
    print(f"  4. create alias {ALIAS} -> {new}")
    if input("proceed? [y/N] ").strip().lower() != "y":
        print("aborted")
        return 1

    es.indices.create(index=new, body=INDEX_SETTINGS)
    result = es.reindex(
        body={"source": {"index": ALIAS}, "dest": {"index": new}},
        wait_for_completion=True,
        refresh=True,
    )
    copied = result.get("created", 0)
    if copied != docs:
        # Bail before the destructive step. The old index is still there and still serving.
        print(f"ERROR: copied {copied} of {docs} documents. Old index untouched; fix and retry.")
        es.options(ignore_status=404).indices.delete(index=new)
        return 1

    es.indices.delete(index=ALIAS)
    es.indices.update_aliases(body={"actions": [{"add": {"index": new, "alias": ALIAS}}]})
    print(f"adopted: {ALIAS} -> {new} ({copied} documents)")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--status", action="store_true", help="show the alias and its indices")
    parser.add_argument("--adopt", action="store_true", help="one-time migration off a concrete index")
    parser.add_argument("--rebuild", action="store_true", help="drop and refill from Postgres")
    parser.add_argument("--drop-old", action="store_true", help="delete the previous generation after a reindex")
    args = parser.parse_args()

    es = get_es()

    if args.status:
        status(es)
        return 0
    if args.adopt:
        return adopt(es)

    if args.rebuild:
        with SessionLocal() as db:
            properties = published_properties(db)
            count = rebuild_index(properties, es=es)
        print(f"rebuilt from Postgres: {count} documents")
        return 0

    result = reindex_into_new(es, drop_old=args.drop_old)
    print(f"{result['old']} -> {result['new']} ({result['created']} documents)")
    if not args.drop_old:
        print(f"previous index kept for rollback. Delete it with:  curl -XDELETE $ES/{result['old']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
