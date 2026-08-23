"""Least-privilege access to Elasticsearch: a role, an API key, and proof that both bite.

    docker compose --profile secure up -d elasticsearch-secure
    python -m scripts.es_security --check       # what an unauthenticated request gets
    python -m scripts.es_security --bootstrap   # create the role + mint the app's API key
    python -m scripts.es_security --prove       # show what the key can and cannot do
    python -m scripts.es_security --list        # existing API keys
    python -m scripts.es_security --revoke <id>

Runs against the `secure` profile on **9201**, not the default open cluster on 9200.

The point is not "turn security on". It is that turning it on and then handing every client the
`elastic` superuser — which is what most guides leave you doing — buys almost nothing. `elastic`
can delete every index in the cluster. StayHub needs to read and write ONE alias.
"""

import argparse
import sys

from elasticsearch import Elasticsearch

SECURE_URL = "http://localhost:9201"
BOOTSTRAP = ("elastic", "stayhub-elastic")

ROLE = "stayhub_search"
KEY_NAME = "stayhub-api"
ALIAS = "stayhub-properties"

# Exactly what app/search/ calls, and nothing else.
#
#   read / view_index_metadata  -> search, count, explain, _analyze, get_alias
#   index / delete              -> indexer.index_property and remove_property
#   manage                      -> reindex.py and the alias flip. A production API process does
#                                  NOT need this; it is here because the demo's scripts share the
#                                  key. Splitting it into a second, admin-only key is the more
#                                  honest arrangement and is one `security.put_role` away.
ROLE_BODY = {
    "cluster": ["monitor"],  # _cluster/health for the readiness probe. NOT `manage`.
    "indices": [
        {
            # A wildcard over the generations, so a reindex into `-000003` needs no new grant.
            # It is still scoped: this key cannot touch an index called anything else.
            "names": [f"{ALIAS}*"],
            "privileges": ["read", "view_index_metadata", "index", "delete", "manage"],
        }
    ],
}


def admin() -> Elasticsearch:
    return Elasticsearch(SECURE_URL, basic_auth=BOOTSTRAP, request_timeout=10)


def check() -> None:
    print(f"cluster: {SECURE_URL}\n")
    anon = Elasticsearch(SECURE_URL, request_timeout=10)
    try:
        anon.cluster.health()
        print("  anonymous: 200 — security is NOT on. Wrong cluster?")
    except Exception as e:  # noqa: BLE001
        print(f"  anonymous:  {str(e)[:110]}")
    print(f"  elastic:    {admin().cluster.health()['status']}")


def bootstrap() -> None:
    es = admin()
    es.security.put_role(name=ROLE, body=ROLE_BODY)
    print(f"role {ROLE}: {ROLE_BODY['indices'][0]['privileges']} on {ROLE_BODY['indices'][0]['names']}")

    result = es.security.create_api_key(
        body={
            "name": KEY_NAME,
            # ⚠️ `role_descriptors` here is an INTERSECTION with the creating user's privileges,
            # not a grant on top of them. A key can never be more powerful than whoever made it —
            # which is why minting keys from `elastic` works and minting them from a limited
            # service account silently produces a key that can do less than you wrote.
            "role_descriptors": {ROLE: ROLE_BODY},
            # A key with no expiry is a credential you will still be running in three years.
            "expiration": "90d",
        }
    )
    encoded = result["encoded"]
    print(f"\napi key id: {result['id']}   expires in 90d")
    print("\nPut this in the backend .env — it is shown ONCE and cannot be retrieved again:\n")
    print(f"  elasticsearch_url=http://localhost:9201")
    print(f"  elasticsearch_api_key={encoded}")
    return encoded


def prove(encoded: str | None = None) -> None:
    """Show the key doing its job, and refusing the thing it should refuse."""
    if not encoded:
        print("pass the key: --prove <encoded>   (mint one with --bootstrap)")
        return
    app = Elasticsearch(SECURE_URL, api_key=encoded, request_timeout=10)

    print("what the scoped key CAN do:")
    # 400 = resource_already_exists, which on a re-run is the expected answer, not a failure.
    app.options(ignore_status=400).indices.create(index=f"{ALIAS}-000001")
    app.index(index=f"{ALIAS}-000001", id="1", document={"title": "Cedar Cabin"}, refresh=True)
    print(f"  index a document:        ok ({app.count(index=f'{ALIAS}-000001')['count']} in the index)")
    print(f"  search:                  ok ({app.search(index=f'{ALIAS}-000001')['hits']['total']['value']} hits)")
    print(f"  cluster health:          {app.cluster.health()['status']}")

    print("\nwhat it CANNOT do — this is the whole point:")
    for label, call in (
        ("read someone else's index", lambda: app.search(index="other-app-secrets")),
        ("delete an unrelated index", lambda: app.indices.delete(index="other-app-secrets")),
        ("list users", lambda: app.security.get_user()),
        ("mint another API key", lambda: app.security.create_api_key(body={"name": "escalate"})),
    ):
        try:
            call()
            print(f"  {label:26} ALLOWED  <- unexpected, tighten the role")
        except Exception as e:  # noqa: BLE001
            reason = str(e)
            kind = "403 unauthorized" if "unauthorized" in reason or "403" in reason else reason[:60]
            print(f"  {label:26} refused  ({kind[:70]})")


def listing() -> None:
    for key in admin().security.get_api_key(owner=True)["api_keys"]:
        state = "invalidated" if key["invalidated"] else "active"
        print(f"  {key['id']}  {key['name']:20} {state}")


def revoke(key_id: str) -> None:
    result = admin().security.invalidate_api_key(body={"ids": [key_id]})
    print(f"invalidated: {result['invalidated_api_keys']}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--bootstrap", action="store_true")
    parser.add_argument("--prove", nargs="?", const="", metavar="ENCODED_KEY")
    parser.add_argument("--list", action="store_true")
    parser.add_argument("--revoke", metavar="KEY_ID")
    args = parser.parse_args()

    if args.check:
        check()
    elif args.bootstrap:
        encoded = bootstrap()
        print("\n--- proving it ---\n")
        prove(encoded)
    elif args.prove is not None:
        prove(args.prove or None)
    elif args.list:
        listing()
    elif args.revoke:
        revoke(args.revoke)
    else:
        parser.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
