"""StayHub's Hasura metadata, as data.

Hasura's own CLI keeps metadata as a tree of YAML files. This is one Python module instead, for
two reasons: it needs no extra binary installed, and the permission rules — which are the
interesting part — can be written once and reused across roles instead of copy-pasted per table.

Apply it with:  python -m scripts.apply     (from the hasura/ directory)

The four roles:

  anonymous  a visitor with no token. Sees PUBLISHED listings and nothing else.
  customer   a signed-in guest. Adds: their own user row, their own bookings.
  host       a guest who also hosts. Adds: their own listings in ANY status, and the
             bookings other people have made at them.
  staff      StayHub staff. Sees everything.

⚠️ The staff role is called `staff`, NOT `admin`. `admin` is RESERVED in Hasura: it is the role
the admin secret grants, it always has unrestricted access, and declaring any permission for it is
rejected with "cannot define permission for admin role" — an error that names the role and not the
fact that the role is special. A JWT can never carry the built-in admin role either, which is the
point: full access requires the secret, not a token.

⚠️ Every role is additive in what a person can *do*, but Hasura roles are NOT hierarchical — a
`host` does not inherit `customer`'s permissions. Each role's rules are declared in full. That is
verbose and it is also why a permission can never be granted by accident through inheritance.
"""

SOURCE = "default"

# Session variables come from the JWT claims FastAPI signs (see app/core/security.py).
# `X-Hasura-User-Id` is the user's public UUID.
SESSION_USER = "X-Hasura-User-Id"

# --- column sets ------------------------------------------------------------------

# ⚠️ NEVER include `password_hash`. A select permission is a column allowlist, and anything listed
# is readable by that role over GraphQL. This is the single most dangerous line in the file.
USER_PUBLIC_COLUMNS = [
    "public_id", "first_name", "last_name", "avatar_url", "host_bio", "is_host", "created_at",
]
USER_SELF_COLUMNS = USER_PUBLIC_COLUMNS + ["email", "role"]

PROPERTY_PUBLIC_COLUMNS = [
    "public_id", "title", "description", "property_type", "room_type", "status",
    "city", "state", "country", "latitude", "longitude",
    "price_per_night", "cleaning_fee", "max_guests", "bedrooms", "beds", "bathrooms",
    "rating_average", "rating_count", "created_at",
]
# `address_line1` and `postal_code` are deliberately absent above: Airbnb reveals the exact
# address only after booking, and publishing it says which houses are empty next week.
PROPERTY_OWNER_COLUMNS = PROPERTY_PUBLIC_COLUMNS + ["address_line1", "postal_code"]

BOOKING_COLUMNS = [
    "public_id", "check_in", "check_out", "guests", "nights",
    "nightly_rate", "subtotal", "cleaning_fee", "service_fee", "total",
    "status", "cancelled_at", "cancellation_reason", "created_at",
]

# --- row-level filters ------------------------------------------------------------

PUBLISHED_ONLY = {"_and": [{"status": {"_eq": "PUBLISHED"}}, {"deleted": {"_eq": False}}]}
NOTHING_HIDDEN = {}  # an empty filter means "every row"

# ⚠️ "Staff see everything" does NOT mean an empty filter on a soft-deleting table. A deleted row
# is gone as far as the product is concerned, and `{}` shows it — so the admin console counted
# listings that had been removed while `/api/v1/admin/stats`, which filters `deleted = false` in
# SQL, did not. Two totals for the same thing, both plausible, and only one right.
#
# This is the Hasura shape of the classic soft-delete trap: the ORM applies the flag automatically,
# and anything written by hand — SQL or a permission rule — has to say so itself.
NOT_DELETED = {"deleted": {"_eq": False}}

# "the property whose host is me" — a filter that walks the relationship rather than duplicating
# host_id onto every child table.
OWN_PROPERTY = {"host": {"public_id": {"_eq": f"{SESSION_USER}"}}}
OWN_BOOKING = {"guest": {"public_id": {"_eq": f"{SESSION_USER}"}}}
BOOKING_AT_OWN_PROPERTY = {"property": OWN_PROPERTY}


def _select(columns: list[str], filter_: dict, *, limit: int | None = None) -> dict:
    perm = {"columns": columns, "filter": filter_, "allow_aggregations": True}
    if limit is not None:
        # A hard cap Hasura enforces server-side. Without it, one `query { properties }` with no
        # arguments returns the entire table — the classic way a GraphQL endpoint becomes a
        # denial-of-service vector against its own database.
        perm["limit"] = limit
    return perm


def build() -> dict:
    """The complete metadata document, ready for `replace_metadata`."""
    return {
        "version": 3,
        "sources": [
            {
                "name": SOURCE,
                "kind": "postgres",
                "configuration": {
                    "connection_info": {
                        "database_url": {"from_env": "HASURA_GRAPHQL_DATABASE_URL"},
                        "isolation_level": "read-committed",
                        "use_prepared_statements": True,
                    }
                },
                # Matches HASURA_GRAPHQL_DEFAULT_NAMING_CONVENTION in docker-compose.yml, so
                # columns are exposed as `pricePerNight` rather than `price_per_night` — the same
                # shape FastAPI returns.
                "customization": {"naming_convention": "graphql-default"},
                "tables": _tables(),
            }
        ],
    }


def _tables() -> list[dict]:
    return [
        # ---------------------------------------------------------------- users
        {
            "table": {"schema": "public", "name": "users"},
            "array_relationships": [
                {
                    "name": "properties",
                    "using": {
                        "foreign_key_constraint_on": {
                            "table": {"schema": "public", "name": "properties"},
                            "column": "host_id",
                        }
                    },
                },
                {
                    "name": "bookings",
                    "using": {
                        "foreign_key_constraint_on": {
                            "table": {"schema": "public", "name": "bookings"},
                            "column": "guest_id",
                        }
                    },
                },
            ],
            "select_permissions": [
                {
                    "role": "anonymous",
                    # A visitor may read a HOST's public profile — the name and bio shown on a
                    # listing — and nobody else's. Without the is_host filter this exposes every
                    # registered user's name to the open internet.
                    "permission": _select(
                        USER_PUBLIC_COLUMNS,
                        {"_and": [{"is_host": {"_eq": True}}, {"deleted": {"_eq": False}}]},
                        limit=50,
                    ),
                },
                {
                    "role": "customer",
                    "permission": _select(
                        USER_PUBLIC_COLUMNS,
                        {"_and": [{"is_host": {"_eq": True}}, {"deleted": {"_eq": False}}]},
                        limit=50,
                    ),
                },
                {
                    "role": "host",
                    # A host needs to know WHO booked their place — otherwise the reservations
                    # page shows a stay with a blank guest, and the relationship silently
                    # resolves to null rather than erroring, which looks like a broken join.
                    #
                    # The second branch walks guest → booking → property → host. Reading a
                    # guest's profile is therefore earned by them having booked with you; it is
                    # not a blanket "hosts can see all users".
                    "permission": _select(
                        USER_PUBLIC_COLUMNS,
                        {
                            "_or": [
                                {"_and": [{"is_host": {"_eq": True}}, {"deleted": {"_eq": False}}]},
                                {"bookings": BOOKING_AT_OWN_PROPERTY},
                            ]
                        },
                        limit=50,
                    ),
                },
                {"role": "staff", "permission": _select(USER_SELF_COLUMNS, NOT_DELETED)},
            ],
        },
        # ------------------------------------------------------------ properties
        {
            "table": {"schema": "public", "name": "properties"},
            "object_relationships": [
                {"name": "host", "using": {"foreign_key_constraint_on": "host_id"}},
            ],
            "array_relationships": [
                {
                    "name": "images",
                    "using": {
                        "foreign_key_constraint_on": {
                            "table": {"schema": "public", "name": "property_images"},
                            "column": "property_id",
                        }
                    },
                },
                {
                    # ⚠️ camelCase by hand. `graphql-default` renames COLUMNS, not relationship
                    # names — those are taken verbatim from metadata. The giveaway is that its
                    # derived aggregate field IS camelCased, so a snake_case relationship called
                    # `property_amenities` sits next to `propertyAmenitiesAggregate` in the same
                    # type, and a query written to match the rest of the schema fails with
                    # "field 'propertyAmenities' not found in type: 'Properties'".
                    "name": "propertyAmenities",
                    "using": {
                        "foreign_key_constraint_on": {
                            "table": {"schema": "public", "name": "property_amenities"},
                            "column": "property_id",
                        }
                    },
                },
                {
                    "name": "bookings",
                    "using": {
                        "foreign_key_constraint_on": {
                            "table": {"schema": "public", "name": "bookings"},
                            "column": "property_id",
                        }
                    },
                },
            ],
            "select_permissions": [
                {"role": "anonymous", "permission": _select(PROPERTY_PUBLIC_COLUMNS, PUBLISHED_ONLY, limit=100)},
                {"role": "customer", "permission": _select(PROPERTY_PUBLIC_COLUMNS, PUBLISHED_ONLY, limit=100)},
                {
                    "role": "host",
                    # A host sees published listings PLUS their own drafts. `_or`, not a
                    # replacement — a host is still a guest browsing the site.
                    "permission": _select(
                        PROPERTY_OWNER_COLUMNS,
                        {"_or": [PUBLISHED_ONLY, {"_and": [OWN_PROPERTY, {"deleted": {"_eq": False}}]}]},
                        limit=100,
                    ),
                },
                {"role": "staff", "permission": _select(PROPERTY_OWNER_COLUMNS, NOT_DELETED)},
            ],
        },
        # -------------------------------------------------------- property_images
        {
            "table": {"schema": "public", "name": "property_images"},
            "object_relationships": [
                {"name": "property", "using": {"foreign_key_constraint_on": "property_id"}},
            ],
            "select_permissions": [
                # ⚠️ Permissions do NOT cascade through relationships. Being allowed to read a
                # property does not make its images readable — each table needs its own rule, and
                # each rule re-states the visibility condition by walking back to the parent.
                # Miss this and a listing page renders with no photos and no error.
                {
                    "role": r,
                    "permission": _select(
                        ["url", "alt_text", "sort_order", "is_cover"],
                        {"property": PUBLISHED_ONLY} if r in ("anonymous", "customer")
                        else {"_or": [{"property": PUBLISHED_ONLY}, {"property": OWN_PROPERTY}]},
                        limit=200,
                    ),
                }
                for r in ("anonymous", "customer", "host")
            ]
            + [
                {
                    "role": "staff",
                    "permission": _select(
                        ["url", "alt_text", "sort_order", "is_cover"],
                        {"property": NOT_DELETED},
                    ),
                }
            ],
        },
        # ------------------------------------------------------------- amenities
        {
            "table": {"schema": "public", "name": "amenities"},
            "select_permissions": [
                # A static vocabulary. Public to everyone, with no row filter, because there is
                # nothing here worth hiding.
                {"role": r, "permission": _select(["slug", "name", "icon"], NOTHING_HIDDEN)}
                for r in ("anonymous", "customer", "host", "staff")
            ],
        },
        # ---------------------------------------------------- property_amenities
        {
            "table": {"schema": "public", "name": "property_amenities"},
            "object_relationships": [
                {"name": "property", "using": {"foreign_key_constraint_on": "property_id"}},
                {"name": "amenity", "using": {"foreign_key_constraint_on": "amenity_id"}},
            ],
            "select_permissions": [
                {"role": r, "permission": _select([], NOTHING_HIDDEN, limit=500)}
                for r in ("anonymous", "customer", "host", "staff")
            ],
        },
        # -------------------------------------------------------------- bookings
        {
            "table": {"schema": "public", "name": "bookings"},
            "object_relationships": [
                {"name": "property", "using": {"foreign_key_constraint_on": "property_id"}},
                {"name": "guest", "using": {"foreign_key_constraint_on": "guest_id"}},
            ],
            "select_permissions": [
                # No anonymous rule at all. An absent permission means the table is INVISIBLE to
                # that role — it does not even appear in the schema — which is stronger and
                # clearer than a rule that filters everything out.
                {"role": "customer", "permission": _select(BOOKING_COLUMNS, OWN_BOOKING)},
                {
                    "role": "host",
                    # Their own stays, plus reservations at their listings. A host reading a
                    # booking at their own place is the /hosts/reservations page.
                    "permission": _select(
                        BOOKING_COLUMNS, {"_or": [OWN_BOOKING, BOOKING_AT_OWN_PROPERTY]}
                    ),
                },
                {"role": "staff", "permission": _select(BOOKING_COLUMNS, NOTHING_HIDDEN)},
            ],
        },
        # -------------------------------------------------------------- payments
        {
            "table": {"schema": "public", "name": "payments"},
            "object_relationships": [
                {"name": "booking", "using": {"foreign_key_constraint_on": "booking_id"}},
            ],
            "select_permissions": [
                {
                    "role": "customer",
                    "permission": _select(
                        ["public_id", "status", "amount", "currency", "card_brand", "card_last4", "created_at"],
                        {"booking": OWN_BOOKING},
                    ),
                },
                # Deliberately NOT visible to hosts. A host is entitled to know a booking is paid
                # — which `bookings.status` already tells them — not to see the guest's card
                # metadata.
                {
                    "role": "staff",
                    "permission": _select(
                        ["public_id", "status", "amount", "currency", "card_brand", "card_last4",
                         "failure_message", "stripe_payment_intent_id", "created_at"],
                        NOTHING_HIDDEN,
                    ),
                },
            ],
        },
        # --------------------------------------------------------------- reviews
        {
            "table": {"schema": "public", "name": "reviews"},
            "object_relationships": [
                {"name": "property", "using": {"foreign_key_constraint_on": "property_id"}},
                {"name": "author", "using": {"foreign_key_constraint_on": "author_id"}},
            ],
            "select_permissions": [
                {
                    "role": r,
                    "permission": _select(
                        ["public_id", "rating", "comment", "created_at"],
                        {"property": PUBLISHED_ONLY},
                        limit=100,
                    ),
                }
                for r in ("anonymous", "customer", "host")
            ]
            + [
                {
                    "role": "staff",
                    "permission": _select(["public_id", "rating", "comment", "created_at"], NOTHING_HIDDEN),
                }
            ],
        },
    ]
