"""Snapshot and restore the search index — and an honest answer about whether it is worth it.

    python -m scripts.snapshot --register        # once per cluster: create the repository
    python -m scripts.snapshot --create          # take a snapshot
    python -m scripts.snapshot --list            # what exists, and how big
    python -m scripts.snapshot --restore <name>  # put it back
    python -m scripts.snapshot --policy          # install an SLM policy (nightly, keep 7)

⚠️ **StayHub does not actually need this, and saying so is the lesson.** The index is derived data;
`python -m scripts.reindex --rebuild` regenerates every document from Postgres, which is both
faster and guaranteed current. A snapshot of derived data restores you to a stale copy of something
you can rebuild exactly.

Snapshots earn their place when the index IS the source of truth — log and metrics clusters, where
nothing else holds the data — or when a rebuild is too slow to be an outage plan. A hundred million
documents reindexed from Postgres is hours; restored from a snapshot it is minutes, because a
restore copies segment files rather than re-analysing text.

The mechanics are the same either way, which is why they are worth knowing before you need them.
"""

import argparse
import sys
from datetime import datetime, timezone

from app.search.client import get_es
from app.search.index import ALIAS, current_index

REPO = "stayhub-backups"
# Must be under the container's `path.repo` (see docker-compose.yml) or registration is refused.
REPO_LOCATION = "/usr/share/elasticsearch/snapshots"
POLICY = "stayhub-nightly"

es = get_es()


def register() -> None:
    es.snapshot.create_repository(
        name=REPO,
        body={
            "type": "fs",
            "settings": {
                "location": REPO_LOCATION,
                # Snapshots are incremental at the SEGMENT level: a second snapshot only stores
                # segments the first one did not. Compression applies to the metadata, not the
                # already-compressed segment files, so the win is small but free.
                "compress": True,
            },
        },
    )
    # `verify` writes and reads back a marker file from every node. On a single node this is
    # ceremony; on a cluster it is the check that catches the classic misconfiguration — a repo on
    # a local disk rather than shared storage, where every node writes its own private half of a
    # snapshot that can never be restored.
    result = es.snapshot.verify_repository(name=REPO)
    print(f"registered {REPO} at {REPO_LOCATION}")
    print(f"verified on nodes: {list(result['nodes'])}")


def create() -> None:
    name = f"snap-{datetime.now(timezone.utc):%Y%m%d-%H%M%S}"
    concrete = current_index(es) or ALIAS
    result = es.snapshot.create(
        repository=REPO,
        snapshot=name,
        body={
            # Snapshot the CONCRETE index. An alias is not a thing that can be snapshotted, but
            # `include_global_state` carries the alias definition, so a restore brings it back
            # pointing at the right index.
            "indices": concrete,
            "include_global_state": True,
        },
        wait_for_completion=True,
    )
    info = result["snapshot"]
    print(f"{info['snapshot']}: {info['state']}  {info['shards']['successful']}/{info['shards']['total']} shards")
    print(f"  indices: {info['indices']}")
    print(f"  took: {info['duration_in_millis']}ms")


def listing() -> None:
    snaps = es.snapshot.get(repository=REPO, snapshot="_all")["snapshots"]
    if not snaps:
        print("no snapshots")
        return
    print(f"{'snapshot':28} {'state':10} {'indices':30} started")
    for s in snaps:
        print(f"{s['snapshot']:28} {s['state']:10} {','.join(s['indices'])[:29]:30} {s['start_time']}")


def restore(name: str) -> None:
    concrete = current_index(es) or ALIAS
    print(f"restoring {name}")
    # ⚠️ An OPEN index cannot be restored over. Elasticsearch refuses rather than serving half of
    # each. Closing it is the standard move; `rename_pattern` into a fresh name and flipping the
    # alias is the zero-downtime alternative, and is the same alias trick as scripts/reindex.py.
    es.options(ignore_status=404).indices.close(index=concrete)
    try:
        result = es.snapshot.restore(
            repository=REPO,
            snapshot=name,
            body={"indices": concrete, "include_global_state": False},
            wait_for_completion=True,
        )
        shards = result["snapshot"]["shards"]
        print(f"restored {shards['successful']}/{shards['total']} shards")
    finally:
        # Reopen even on failure — leaving the index closed is a silent outage that looks like an
        # empty result set.
        es.options(ignore_status=404).indices.open(index=concrete)
    es.indices.refresh(index=concrete)
    print(f"documents now: {es.count(index=concrete)['count']}")


def policy() -> None:
    """Snapshot Lifecycle Management — the cluster takes them, so nobody has to remember to.

    A snapshot script on a cron on one machine is a backup plan that fails silently the day that
    machine is rebuilt. SLM runs inside the cluster and reports its own failures.
    """
    es.slm.put_lifecycle(
        policy_id=POLICY,
        body={
            "schedule": "0 30 2 * * ?",  # 02:30 daily — cron with a seconds field, Quartz style
            "name": "<stayhub-{now/d}>",  # date maths in the name: stayhub-2026.08.22
            "repository": REPO,
            "config": {"indices": [f"{ALIAS}*"], "include_global_state": True},
            "retention": {
                "expire_after": "30d",
                # ⚠️ `min_count` is the part that makes retention safe. Without it, a cluster that
                # was off for a month deletes every snapshot it has the moment it comes back,
                # because they are all older than `expire_after`.
                "min_count": 7,
                "max_count": 30,
            },
        },
    )
    print(f"installed SLM policy {POLICY}")
    print("  run it now with: es.slm.execute_lifecycle(policy_id=...)  or  POST _slm/policy/%s/_execute" % POLICY)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--register", action="store_true")
    parser.add_argument("--create", action="store_true")
    parser.add_argument("--list", action="store_true")
    parser.add_argument("--restore", metavar="NAME")
    parser.add_argument("--policy", action="store_true")
    args = parser.parse_args()

    if args.register:
        register()
    elif args.create:
        create()
    elif args.list:
        listing()
    elif args.restore:
        restore(args.restore)
    elif args.policy:
        policy()
    else:
        parser.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
