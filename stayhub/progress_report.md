# StayHub — progress report

Shared context for the StayHub demo (Airbnb-style short-term rentals).
**Read this first when resuming work.**

**Status:** Complete and working end to end, Stripe included. **58 backend + 33 customer + 7 admin tests, all green.**
**Last updated:** 2026-08-21

---

## Purpose

An Airbnb-style booking app that exists to produce **tutorial snippets** for
lovemesomecoding.com. Readability and teachability outrank cleverness. Where a "real production"
choice and a "clear teaching example" choice conflict, prefer the teaching one and leave a comment
saying what production would do differently.

The stack is deliberately wider than pizza's: this demo is where **FastAPI**, **Hasura**,
**Postgres** and **Elasticsearch** get their snippets, and the interesting material is in how the
four fit together — CQRS-ish read/write split, JWT claims shared between FastAPI and Hasura, and a
search index kept in step from application code.

---

## Requirements (from README.md)

- Look and behave like Airbnb — but not its logo or styling.
- Two React + Tailwind frontends: customer-facing and admin.
- One FastAPI backend. **All writes go through it.**
- Hasura GraphQL. **All reads come from it** (one deliberate exception, below).
- Postgres as the database.
- Customers: sign up, sign in, view a house, book it, pay.
- Customers can cancel **up to 2 days before the check-in date**.
- Hosts: sign up, sign in, add a house.
- Elasticsearch, sunk from Postgres **in application code**, for fast house search.

---

## Decisions

### D1 — Hosts live in the customer app, not the admin app
Airbnb has no separate host site: hosting is a mode of the same account. One React app serves both
guests and hosts; `/hosts/*` is role-gated (dashboard, listings, listings/new, reservations). The admin app stays what its name says — **staff**
tools (moderate listings, manage users and bookings, reports).

A user row therefore carries `role` (`CUSTOMER` | `ADMIN`) **and** an `is_host` flag. "Become a
host" flips the flag; it never grants staff access.

### D2 — Search is the one read that does not come from Hasura
`GET /api/v1/search` on FastAPI queries Elasticsearch directly. Everything else the frontends read
— listing detail, a guest's bookings, a host's listings — is a Hasura GraphQL query.

The rule as written ("all reads from Hasura", "Elasticsearch for search") cannot both hold, because
Hasura reads Postgres and the whole point of the ES index is to *not* read Postgres. The alternatives
were a Hasura Action forwarding to FastAPI, or a remote schema; both put a hop in front of the same
call. One explicit, documented exception teaches the trade-off better than machinery hiding it.

### D3 — Stripe test mode, matching pizza
Real PaymentIntents with test card `4242 4242 4242 4242`, and a signature-verified webhook. The
secret key lives only in a gitignored env file — **never in a committed file**.

### D4 — Build order: full vertical slice first
Compose → schema → auth → seed → browse → listing detail → book → pay, working end to end, before
breadth. Host and admin screens come in a second pass. A thin slice through every layer surfaces the
integration problems (JWT claims, ES sync, Hasura permissions) while they are still cheap.

### D5 — One JWT, minted by FastAPI, verified by Hasura
FastAPI signs an HS256 token carrying Hasura's `https://hasura.io/jwt/claims` namespace
(`x-hasura-default-role`, `x-hasura-allowed-roles`, `x-hasura-user-id`). Hasura is configured with
the same shared secret and enforces row-level permissions from those claims. There is no second
login and no auth webhook. This is the single most reusable snippet in the project.

### D6 — Availability is enforced by the database, not only by the service
An `EXCLUDE USING gist` constraint on `bookings` makes two overlapping live bookings for one
property **impossible to insert**, regardless of what the application does. The service still checks
first so the user gets a friendly message; the constraint is what makes the check honest under
concurrency. (Needs the `btree_gist` extension.)

---

## Ports

Chosen to dodge what is already running on this machine.

| Service | Port | Note |
|---|---|---|
| Postgres | **5433** | 5432 belongs to a native install |
| Hasura | **8081** | console at http://localhost:8081 |
| Elasticsearch | **9200** | |
| FastAPI | **8000** | docs at http://localhost:8000/docs |
| Customer frontend | **5174** | 5173 belongs to pizza-react |
| Admin frontend | **5175** | |

---

## Layout

```
stayhub/
├── docker-compose.yml          postgres · hasura · elasticsearch
├── stayhub-fastapi-backend/            FastAPI — every write, plus /search
├── stayhub-react-frontend/      React + Vite + Tailwind (guest AND host)
├── stayhub-react-admin-frontend/ React + Vite + Tailwind (staff)
└── hasura/                     metadata: tracked tables, relationships, permissions
```

---

## Task tracker

| # | Task | Owner | Status |
|---|---|---|---|
| 0 | Shared context, ports, decisions | Claude | done |
| 1 | docker-compose: postgres + hasura + elasticsearch | Claude | done |
| 2 | Backend skeleton + layered structure | Claude | done |
| 3 | Schema + Alembic migrations + seed data | Claude | done |
| 4 | Auth: signup/signin, Hasura JWT claims | Claude | done |
| 5 | Hasura metadata: tracked tables + per-role permissions | Claude | done |
| 6 | ES index + sync from application code | Claude | done |
| 7 | `GET /search` over Elasticsearch | Claude | done |
| 9 | Booking + cancellation rules (2-day cutoff) | Claude | done |
| 10 | Stripe payment + webhook | Claude | code done, **needs a test secret key** |
| 8 | Customer frontend: browse, detail, book | Claude | done |
| 11 | Host mode: become a host, add a listing | Claude | done |
| 12 | Admin frontend | Claude | done |
| 13 | Tests (pytest + Playwright) | Claude | done |

### Still open
- **Nothing expires a stale PENDING booking.** It holds the dates until cancelled. A background
  job would sweep them; that is out of scope here and worth naming rather than pretending it is
  handled.
- **`checkIn`/`checkOut` are accepted by `/search` but do not filter.** Availability lives in the
  bookings table, not the index. The listing page checks it properly. Saying so beats a filter
  that quietly does nothing.
- **Reviews are modelled but not exposed.** The table, the constraint and the denormalised
  `rating_average` exist; no endpoint writes one yet.

---

## How to run it

See `CLAUDE.md` for the full sequence. Short version:

```bash
docker compose up -d
cd stayhub-fastapi-backend && .venv/bin/alembic upgrade head && .venv/bin/python -m scripts.seed
cd ../hasura && python3 -m scripts.apply
cd ../stayhub-fastapi-backend && .venv/bin/uvicorn app.main:app --port 8000 --reload
cd ../stayhub-react-frontend && npm run dev              # :5174
cd ../stayhub-react-admin-frontend && npm run dev        # :5175
```

`guest@stayhub.test` / `guest123` · `host@stayhub.test` / `host123` · `admin@stayhub.test` / `admin123`

---

## Verified working

Run against the live stack, not asserted from reading the code:

- **Search** — fuzzy text (`cabin`), AND-ed amenity filters, `guests >= n`, price sort. ~90 ms cold.
- **Booking** — quote → create → PENDING, with every figure computed server-side.
- **Overlap rejection** — 10 → 13 Nov booked; 11 → 14 Nov refused with 409.
- **Back-to-back stays** — 13 → 15 Nov accepted while 10 → 13 stands. The half-open range works.
- **Concurrency** — 10 simultaneous requests for identical dates: **1 row created, 9 rejected.**
- **Cancellation cutoff** — a stay starting tomorrow correctly refuses to cancel and names the
  deadline that passed.
- **Cancelling frees the dates** — the same range re-books immediately afterwards.
- **Publishing a listing puts it in search** within ~400 ms, and unpublishing removes it —
  driven through the host UI, asserted against `/search`.
- **Suspending from the admin console** pulls a listing out of Elasticsearch; restoring puts it back.
- **A non-staff account is refused** by the admin console outright, rather than let in with the
  buttons hidden.
- **`/admin/stats` and Hasura's `propertiesAggregate` agree** (12 and 12) while Postgres physically
  holds 13 rows — the soft-deleted one excluded by both.
- **Stripe checkout, against a real test-mode account** — a booking creates a genuine
  PaymentIntent for the server-computed total, and Stripe's Payment Element mounts with it
  (Card, Cash App Pay, Klarna and the rest). The card fields are never driven from the test:
  they live in a cross-origin iframe — which is what keeps this app out of PCI scope — and
  headless automation trips hCaptcha. `payment.spec.ts` asserts everything up to that line,
  including that the secret key never appears in a response.
- **Requesting an intent twice reuses the same one** rather than leaving abandoned
  PaymentIntents behind — two live intents for one booking is how a double charge happens.
- **Hasura permissions**, per role:
  - anonymous → published listings + host first names. `bookings` is not in the schema at all;
    `passwordHash` and `addressLine1` do not exist as fields.
  - customer → own bookings only; zero non-published listings visible.
  - host → own listings incl. drafts, reservations with guest names, `payments` absent.
  - staff → everything (12 properties, 6 bookings, 4 users).
  - a guest asking for `x-hasura-role: staff` → *"Your requested role is not in allowed roles"*.

---

## Gotchas that already cost time — do not rediscover these

### Hasura
- **"Staff see everything" must NOT mean an empty filter on a soft-deleting table.** `{}` includes
  deleted rows, so the console counted listings that had been removed while `/admin/stats` — which
  filters `deleted = false` in SQL — did not. Two totals for the same thing, both plausible, one
  wrong. `NOT_DELETED` in `metadata.py`.
- **Relationship names are NOT camelCased by `graphql-default`** — only columns are. The giveaway
  is that the derived aggregate IS camelCased, so `property_amenities` sat next to
  `propertyAmenitiesAggregate` in the same type. Name relationships in camelCase by hand.
- **`admin` is a RESERVED role.** Declaring any permission for it fails with *"cannot define
  permission for admin role"*, which names the role and not the fact that the role is special.
  The staff role here is called **`staff`**. The built-in `admin` is what the admin *secret*
  grants, and a JWT can never carry it — which is the point.
- **`graphql-default` renames three things, not one.** Columns camelCase (`price_per_night` →
  `pricePerNight`), and so do **arguments** (`order_by` → `orderBy`, `bookings_aggregate` →
  `bookingsAggregate`) and **enum values** (`asc` → `ASC`). Every example in Hasura's own docs uses
  the snake_case form, so copied queries fail with "has no argument named 'order_by'".
- **Permissions do not cascade through relationships.** Being allowed to read `properties` does not
  make `property_images` readable — each table needs its own rule that re-states the visibility
  condition by walking back to the parent. Miss it and the listing page renders with no photos and
  no error.
- **A missing permission is stronger than a restrictive one.** With no rule at all, the table is
  absent from the GraphQL schema entirely (`field 'bookings' not found in type: 'query_root'`).
- **A relationship the role cannot read resolves to `null`, not an error.** The host reservations
  query returned bookings with `guest: null` because the `users` rule only exposed hosts. It looks
  exactly like a broken join.
- **Inside the compose network Postgres is on 5432**, not the published 5433.

### Postgres
- **`EXCLUDE USING gist` on `(property_id =, daterange &&)` needs the `btree_gist` extension**, or
  the CREATE TABLE fails with *"data type bigint has no default operator class for access method
  gist"* — which reads like a problem with the column.
- **`'[)'` is load-bearing.** Half-open ranges are what let one guest check out on the 5th and
  another check in on the 5th. Closed ranges reject every back-to-back booking.

### SQLAlchemy / Alembic
- **`text("CHECK (...)")` is not a schema item** — `__table_args__` needs `CheckConstraint`.
- **`.unique()` is mandatory after a `joinedload` of a collection**, and 2.0 raises rather than
  guessing.
- **Alembic autogenerate only sees models something imports.** `app/models/__init__.py` imports
  every model for exactly this reason; a model in an unimported file gets a DROP migration written
  for it.

### FastAPI config
- **`os.getenv` does NOT see anything that lives only in `.env`.** pydantic-settings parses the
  file into the `Settings` object and never touches `os.environ`. The failure is quiet: the
  payment intent was created correctly and the browser just received an empty publishable key.
  Everything configurable belongs in `Settings`, read as `settings.x`.

### Intl / dates
- **`toLocaleDateString` with `{ day, year }` and no month is not a supported combination**, and
  Intl does not error — it emits a literal fallback, `"2026 (day: 7)"`. It reads as a bug in the
  calling function. `formatRange` builds that half by hand.
- **A collapsed month stays on the FIRST date**: "Sep 4 – 7, 2026", never "4 – Sep 7, 2026".

### React / Apollo / Vite
- **Apollo Client v4 moved the React bindings** to `@apollo/client/react`, and `ErrorLink` /
  `SetContextLink` replaced `onError` / `setContext`. Every v3 tutorial fails with
  "has no exported member 'useQuery'", which reads like a broken install.
- **v4 infers `{}` for an untyped `gql` document**, so every field access is a compile error until
  a type parameter is supplied. v3 inferred `any` and let it through.
- **`keyFields` obliges EVERY selection of that type to include them.** A nested
  `property { title city }` throws "Missing field 'publicId' while extracting keyFields" when the
  result is written — an error that names the cache, not the query that caused it.
- **⚠️ No backticks inside a `gql` template.** It is a template literal, so a backtick in a GraphQL
  comment ends the string, and the parse error points at the line AFTER the comment.
- **Clear the Apollo cache when identity changes.** Apollo has no idea the token changed, so
  without it a signed-out user keeps seeing the previous user's bookings from cache, with no
  request to notice.
- **A route guard must wait for the auth `loading` flag.** Reviving a session is async, so `user`
  is null on the first render — redirecting immediately bounces every signed-in user to /login on
  a hard refresh, and never while clicking around.
- **The two dev apps need DIFFERENT localStorage keys.** localStorage is scoped to the origin, not
  the port, so a shared key means signing into the admin console silently makes the customer site
  act as staff.
- **Tailwind v4 is a Vite PLUGIN**, not a PostCSS one. No `tailwind.config.js`; tokens live in
  `@theme` in CSS. Following a v3 tutorial produces a build that runs and applies no styles.

### Playwright
- **`page.waitForURL()` waits for a NAVIGATION event**, which React Router never fires — it hangs
  until timeout. It also only observes from the moment it is called, so a redirect that already
  happened is missed. Use `expect(page).not.toHaveURL(...)`, which polls.
- **Retry the NAVIGATION, not the assertion**, when waiting on Elasticsearch. Playwright's
  auto-retry re-checks the DOM; the page will not refetch on its own. `expect(async () => {…}).toPass()`.
- **`div.flex-col` matches every ancestor too**, so `.first()` silently grabs the page wrapper.
  Use a `data-testid`, and scope by the id of the row the test itself created.

### Pydantic / FastAPI
- **A field named `property` shadows the builtin `@property` inside the class body.** A
  `@property` written after it dies with *"TypeError: 'NoneType' object is not callable"*, pointing
  at the decorator and saying nothing about the field. `schemas/booking.py` captures the builtin
  under another name first.
- **`model_validate()` has no `update=` kwarg** — that is `model_copy`. Derived output fields want
  `@computed_field`, which also keeps them out of the input schema.
- **`@computed_field` only appears in `model_json_schema(mode="serialization")`**, not the default
  validation schema.
- **`EmailStr` rejects `@stayhub.test`** — RFC 6761 reserves `.test` so it can never be real, which
  is why it is the right demo TLD and why the validator refuses it. `email_validator.TEST_ENVIRONMENT
  = True` in `schemas/common.py` allows it.
- **`EmailStr` needs `pydantic[email]`** or the app fails at import, not at request time.
- **`allow_credentials=True` forbids `allow_origins=["*"]`** — origins must be named.

### Elasticsearch
- **Indexing happens AFTER the commit, never before**, or a rolled-back transaction leaves a
  listing in search results that 404s when clicked.
- **Index failures are logged, never raised.** A search cluster restarting must not fail a host's
  save. `POST /api/v1/admin/search/reindex` is the repair path.
- **Unpublished listings are DELETED from the index, not flagged.** One forgotten `.filter()` on a
  status field leaks a draft into public results; absent cannot leak.
- **ES is near-real-time** — index then immediately search finds nothing. `refresh_index()` exists
  for tests and seeding only.

---

## 2026-08-22 — Redis, rate limiting and a transactional outbox

Added for the `/system-design` tutorial track (`projects/system_design/`), which needed working
examples of caching, rate limiting and reliable async work and found none here. Built first, so the
posts quote code that has actually run — the rule the Hasura track learned the hard way.

**Test count: 100 → 165.** All 165 pass with Redis running; 142 pass and 23 skip with it stopped.
Zero failures either way, which is the property that mattered most (below).

### What went in

| | file | applied to |
|---|---|---|
| Cache | `core/cache.py` | `GET /properties/{id}` — cache-aside, 5-minute TTL |
| Rate limit | `core/rate_limit.py` | `POST /auth/login` (10 / 5 min) · `GET /search` (60 / min) |
| Outbox | `models/outbox.py` · `services/outbox_service.py` · `scripts/drain_outbox.py` | `booking.created` · `booking.cancelled` · `property.changed` |

Plus: `redis:7-alpine` on **6380** in Compose, an `outbox` table (migration `35c27e31465b`), a
`cache` boolean on `/health`, and a `headers` field on `ApiException` so a 429 can carry
`Retry-After`.

### Measured, not asserted

- **Cache:** 15.2ms cold → 2.0ms warm over HTTP; 8.8ms → 0.3ms at the service layer.
- **Rate limiter atomicity:** 50 concurrent threads against a 20-token bucket → **exactly 20**
  allowed. A read-decide-write implementation leaks here; the Lua script does not.
- **Backoff:** 2, 4, 8, 16, 32, 64, 128, 256s — 8 attempts spanning ~4.2 minutes, then `DEAD`.

### Decisions worth not relitigating

- **Everything optional degrades, and it is tested both ways.** The cache treats an outage as a
  permanent miss; the limiter fails **OPEN**. Failing closed would make a Redis outage a login
  outage — a cache that can take the site down has stopped being an optimisation. For quota
  enforcement someone is billed against you would choose the opposite; say which and why.
- **Rate limiting is a dependency, not middleware.** Middleware runs before authentication, so it
  could only ever limit by IP, and per-route limits inside it become a badly reimplemented router.
  The cost is that a new expensive endpoint is unprotected until someone adds the dependency.
- **The limiter logic is a Lua script.** `EVAL` is atomic; read-decide-write is not, and its
  failure mode is a limiter that passes every sequential test and allows 4× the limit under 4
  workers.
- **`enqueue` never commits.** The caller's commit is what makes the booking and its message
  atomic. This is now a layer rule in `CLAUDE.md` alongside "repositories never commit".
- **Booking emails moved off `BackgroundTasks`.** Both paths together sent every guest two emails —
  caught by running the app, not by a test. `notification_service.py` keeps its `BackgroundTasks`
  explanation (still the best in this repo) and the routes no longer call it.
- **`property.changed` re-reads rather than replaying a snapshot**, unlike the booking events. The
  index is derived data whose job is to match the database *now*; replaying a stale snapshot would
  write a wrong document and mark it DONE.
- **`_sync`'s outbox enqueue is NOT transactional** and the code says so. It runs after the commit
  on purpose (indexing inside the transaction lets a slow ES fail a host's save), so a crash
  between the two still loses an index update. `reindex_all` remains the backstop. The booking path
  has no such gap — compare them.

### Gotchas paid for, in this session

- **Redis 6380, not 6379.** 6379 on this machine is taken twice — a Homebrew `redis-server` and
  another project's container. Losing the bind is not a clean error: StayHub would connect to the
  *other* Redis and silently share its keyspace.
- **`FOR UPDATE` without `SKIP LOCKED` is worse than it looks.** Worker B *waits* for A instead of
  taking different rows, so a second worker adds no throughput at all. `tests/test_outbox.py::
  TestSkipLocked` asserts B comes back empty **and fast** — and it uses real separate connections,
  because two sessions on the rolled-back `db` fixture cannot lock against each other and the test
  would pass against a query with no locking clause at all.
- **Handlers register at import time, so the worker must import their modules for side effects.**
  A missing import is not a crash — it is `No handler for outbox topic 'booking.created'` on a
  valid message, forever. `--list-topics` exists to make the registry visible.
- **An unknown topic stays PENDING, never DEAD.** Marking it dead turns a five-minute deploy skew
  (producer shipped before consumer) into permanent data loss.
- **A fail-open guarantee is only as good as its narrowest try/except.** `check()` wrapped the Lua
  call but not `register_script`, so a misconfigured `redis_url` failed **closed** — every login
  500ing. Caught by `TestFailsOpen::test_an_erroring_redis_allows`.
- **A test that counts rows in a shared table must count a delta.** `assert len(found) == 1` on the
  whole `outbox` table passed only while the table was empty, and went red the moment the API was
  exercised by hand.
- **Autogenerate created a redundant index.** `index=True` on `status` plus a composite
  `(status, available_at)` gives two indexes where one answers both — write cost and disk for
  nothing. Dropped in the model, not just the migration.
- **A stale `uvicorn` will happily keep serving old code.** Without `--reload`, a second launch
  fails to bind and the requests go to the first process — which is how the duplicate-email fix
  looked like it had not worked.
