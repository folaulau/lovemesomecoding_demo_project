# StayHub

An Airbnb-style short-term rental app. It exists to produce **tutorial snippets** for
lovemesomecoding.com, so readability and teachability outrank cleverness. Where a "real production"
choice and a "clear teaching example" choice conflict, prefer the teaching one and leave a comment
saying what production would do differently.

**`progress_report.md` in this directory is the shared context — read it first when resuming.**
This file is the standing instructions; that one is the state and the history.

---

## The shape of it

The point of this demo is how four things fit together, so the split is the lesson:

```
                 ┌── writes ──> FastAPI ──> Postgres
   React apps ───┤                              │
                 ├── reads  ──> Hasura ─────────┘
                 └── search ──> FastAPI ──> Elasticsearch
                                              ▲
                        sunk in application code from every write path
```

- **Every create, update and delete goes through FastAPI.** That is what makes server-side pricing,
  the availability check and the cancellation rule impossible to bypass. **No role has an
  insert/update/delete permission in Hasura — deliberately.**
- **Every read comes from Hasura**, with row-level permissions doing the filtering, except one.
- **`GET /api/v1/search` is that exception**, because the whole point of the Elasticsearch index is
  to answer that question without touching Postgres, and Hasura reads Postgres.
- **One JWT**, signed by FastAPI, verified by Hasura with the same shared secret. One login, two
  APIs, no auth webhook.

---

## Requirements

- Look and behave like Airbnb — but not its logo or styling.
- Customers: sign up, sign in, view a house, book it, pay.
- Customers can cancel **up to 2 days before the check-in date**.
- Hosts: sign up, sign in, add a house.
- Elasticsearch, sunk from Postgres **in application code**, for fast house search.
- Docker Compose for the backing services.

---

## Structure

```
stayhub/
├── docker-compose.yml            postgres 5433 · hasura 8081 · elasticsearch 9200 · redis 6380
├── hasura/                       metadata.py (tracked tables + per-role permissions) + apply script
├── stayhub-fastapi-backend/      every write, plus /search        :8000
├── stayhub-react-frontend/       guests AND hosts                 :5174
└── stayhub-react-admin-frontend/ staff only                       :5175
```

### Backend — `stayhub-fastapi-backend`

FastAPI, SQLAlchemy 2.0 (typed ORM), Alembic, Postgres.

```
app/
├── core/          config · security (JWT + bcrypt) · deps · exceptions · logging · middleware
│                  cache (Redis, cache-aside) · rate_limit (token bucket in Lua)
├── db/            base (mixins) · session · async_session
├── models/        SQLAlchemy entities + enums
├── schemas/       pydantic DTOs — the camelCase boundary, and Page[T]
├── repositories/  the ONLY place that knows SQLAlchemy exists
├── services/      business rules — pricing, booking, cancellation policy, payments, notifications
├── search/        client · index mapping · indexer (the Postgres → ES sink) · queries
└── api/v1/routes/ auth · properties · bookings · payments · search · admin · uploads
```

**Running it in a container** (added 2026-08-21, for the `/fastapi` tutorial track):

```bash
docker compose --profile api up -d --build     # API in a container on :8000
```

⚠️ Opt-in via a profile because the host `uvicorn --reload` workflow above is better for
development and both bind :8000. `docker compose up -d` is unchanged — backing services only.

**Redis, the outbox and the worker** (added 2026-08-22, for the `/system-design` tutorial track):

```bash
docker compose up -d                              # now also starts redis on 6380
.venv/bin/python -m scripts.drain_outbox          # the outbox worker, in its own terminal
.venv/bin/python -m scripts.drain_outbox --once   # one batch and exit
.venv/bin/python -m scripts.drain_outbox --list-topics
```

Three things went in, and the rule they share is more important than any of them:

- **`core/cache.py`** — cache-aside on `GET /properties/{id}`, the one read that earns it.
  Measured 2026-08-22: 15.2ms cold, 2.0ms warm over HTTP; 8.8ms → 0.3ms at the service layer.
- **`core/rate_limit.py`** — a token bucket in a Lua script, on `POST /auth/login` (10 per 5 min)
  and `GET /search` (60 per min). The script is not decoration: read-decide-write in Python loses
  updates, and `tests/test_rate_limit.py::TestAtomicity` fires 50 concurrent requests at a
  20-token bucket to prove it does not.
- **`models/outbox.py` + `services/outbox_service.py`** — the transactional outbox. A booking and
  its "send the confirmation" message commit in the SAME transaction, and a worker delivers it.

⚠️ **All three are OPTIONAL, and that is the design.** `docker compose stop redis` and the app
serves every page, passes every test that does not test Redis itself, and logs one warning rather
than one per request. The cache treats an outage as a permanent miss; the rate limiter fails OPEN
(a Redis outage must not take down login). Verified both ways on 2026-08-22: **165 tests pass with
Redis up, 142 pass and 23 skip with it stopped, zero fail either way.**

⚠️ **The booking emails moved off `BackgroundTasks` onto the outbox.** `notification_service.py`
still documents what `BackgroundTasks` is and is still the best explanation of it in this repo —
but the routes no longer call it, because the two paths together sent every guest two emails.
Delivery is at-least-once by nature, so both handlers must stay idempotent.

⚠️ **The worker must import its handler modules for their side effects.** Handlers register via
`@outbox_service.handles(...)` at import time, so a module nobody imports has no topics — and the
symptom is not a crash, it is `No handler for outbox topic 'booking.created'` on a valid message,
forever. `scripts/drain_outbox.py` imports them explicitly and `--list-topics` shows the registry.

**Layer rules, in priority order:**

- **Repositories NEVER commit.** A commit is a transaction boundary and only the caller knows where
  it is — "create a booking AND its payment, or neither" spans two repositories. They `flush()`.
- **Services own the rules; routes own HTTP.** A route that computes a price is in the wrong layer.
- **`outbox_service.enqueue` NEVER commits** — same rule as the repositories, and for a sharper
  reason: the caller's commit is what makes the business row and the message atomic. A commit in
  `enqueue` reopens the exact gap the outbox closes, and does it invisibly.
- **The cancellation rule lives in `services/cancellation_policy.py`, alone and dependency-free**,
  because both the schema layer and the service layer need it and anything else is a circular import.
- Every table has a BIGINT primary key for internal FKs plus a `public_id` UUID. **The API exposes
  only the UUID.**
- Every entity has `created_at` / `updated_at`, and user/property carry a `deleted` flag. Deletes
  are soft — bookings reference those rows forever.
- Alembic owns the schema. **Never edit an applied migration.**

### Frontends

Both are React 19 + TypeScript + Vite + **Tailwind v4** + Apollo Client v4.

- `stayhub-react-frontend` — one app for guests *and* hosts. `/hosts/*` is role-gated on the
  `is_host` FLAG, not a role: hosting is a mode of a normal account, not a privilege level.
- `stayhub-react-admin-frontend` — staff only, and **deliberately a different colour** (indigo, not
  coral). Staff tools that look like the customer site invite the "which one am I in?" mistake,
  and that mistake is expensive when the buttons suspend listings.

**State: Context, not Redux.** Auth and toasts are small, rarely-changing values that nearly every
page reads — that is a value, not a state machine. Apollo's cache is the server-state store.

---

## Security — non-negotiable

- **Never store card numbers, CVC or cardholder names.** Only Stripe's `pi_…`/`pm_…` id plus
  brand/last4 as display metadata. If a `card_number` field appears anywhere, something is wrong.
- **The server recomputes every price.** `services/pricing_service.py` is the security boundary;
  a request body never carries an amount.
- **Registration always creates a CUSTOMER.** Role can never come from a request body.
- **Foreign-owned resources return 404, not 403** — a 403 confirms the id exists, which on a
  guessable identifier is a slow enumeration of the table.
- **Login failures are deliberately vague**, to prevent account enumeration. Registration is the one
  place that must admit an email is taken.
- **The Stripe webhook verifies `Stripe-Signature`.** It cannot require a token — Stripe has none of
  ours — so the signature IS the authentication.
- **Staff cannot deactivate themselves.** With one admin that locks everyone out permanently.
- **Never put `x-hasura-admin-secret` in a frontend.** It bypasses every permission rule. Hasura's
  own quickstart does this; it is fine in a script and catastrophic in a bundle.
- **`X-Forwarded-For` is never trusted by default.** It is a header the CLIENT sets, so honouring
  it with no proxy in front lets anyone mint a fresh rate-limit bucket per request and turn the
  limiter off. `rate_limit.TRUSTED_PROXY_COUNT` is 0 locally; when it is not, hops are counted
  from the RIGHT, because only the rightmost entries were appended by infrastructure we control.
- **Uploads are validated by their BYTES, not their `Content-Type`.** That header is whatever the
  client typed. `app/api/v1/routes/uploads.py` sniffs the magic bytes and requires them to match
  the declared type, generates the stored filename rather than trusting `file.filename`, and caps
  size DURING the stream.
- **CORSMiddleware must stay OUTSIDE RequestContextMiddleware** in `main.py`. `add_middleware`
  inserts at the front, so the last call is outermost. Swap them and every 500 reaches the browser
  with no CORS headers, so the frontend reports a CORS failure and never sees the error body.
  `tests/test_api_middleware.py` fails if you do.
- The demo credentials in the footer are acceptable **only** because they are throwaway local
  fixtures. If this ever points at real data, that block is the first thing to delete.

---

## Running it

```bash
# 1 — backing services
docker compose up -d                    # postgres 5433 · hasura 8081 · elasticsearch 9200 · redis 6380

# 2 — schema, seed data, and the search index
cd stayhub-fastapi-backend
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
.venv/bin/alembic upgrade head
.venv/bin/python -m scripts.seed        # 12 listings, 4 users, 2 bookings, index built

# 3 — Hasura metadata (tracked tables + per-role permissions)
cd ../hasura && python3 -m scripts.apply

# 4 — the API
cd ../stayhub-fastapi-backend
.venv/bin/uvicorn app.main:app --port 8000 --reload    # docs at /docs

# 5 — the apps
cd ../stayhub-react-frontend && npm run dev            # :5174
cd ../stayhub-react-admin-frontend && npm run dev      # :5175

# 6 — the outbox worker (optional; without it, booking emails stay PENDING in the table)
cd ../stayhub-fastapi-backend
.venv/bin/python -m scripts.drain_outbox
```

⚠️ **The ports are not arbitrary.** 5433 because a native Postgres owns 5432; 6380 because 6379 is
taken twice on this machine (a Homebrew `redis-server` AND another project's container) and the
failure is not a clean "port in use" — StayHub would silently share a keyspace with whichever Redis
won the bind; 5174/5175 because pizza owns 5173. The backend's CORS allowlist names 5174 and 5175 and nothing else — any other port
fails CORS, and the symptom is a blank page rather than an error anyone would recognise.

**Demo logins:** `guest@stayhub.test` / `guest123` · `host@stayhub.test` / `host123` ·
`admin@stayhub.test` / `admin123`

**Infrastructure credentials** — Postgres, the Hasura admin secret, Elasticsearch — are documented
in a table at the top of `docker-compose.yml`, next to the values they describe. They are throwaway
local fixtures, checked in on purpose so the demo runs with one command; the Stripe secret key is
the one credential that is NOT in a committed file.

### Stripe

Test mode. The **publishable** key is public by design and goes in each frontend's gitignored
`.env.local` as `VITE_STRIPE_PUBLISHABLE_KEY`. The **secret** key lives only in
`stayhub-fastapi-backend/.env` — never in this file, never in a commit.

Keys are configured — checkout creates real test-mode PaymentIntents. Without a secret key the
whole app still works except paying: a booking is created and held as PENDING, and the checkout
page says payment is not configured rather than failing obscurely.

⚠️ **Read the publishable key from `settings`, never `os.getenv`.** pydantic-settings parses `.env`
into the `Settings` object and never populates `os.environ`, so `os.getenv` returns `""` and the
browser gets an empty key — with no error anywhere.

Webhooks need a public URL, so locally the confirmation page polls
`GET /payments/booking/{id}`, which asks Stripe directly. The webhook stays the authority in
production.

---

## Test

```bash
cd stayhub-fastapi-backend && .venv/bin/python -m pytest -q      # 165 — needs Postgres; 23 need Redis
cd stayhub-react-frontend && npm run test:e2e                    # 33 — needs everything running
cd stayhub-react-admin-frontend && npm run test:e2e              #  7
npm run screenshots                                              # regenerate screenshots/
```

- ⚠️ **Never run the two Playwright suites at once.** They share one backend and one database, so
  each sees the other's fixtures and counts. Both are `workers: 1` for the same reason.
- **Tests must clean up what they create**, or a failure poisons every later run — a leftover
  booking blocks the dates the next run picks. See the `afterEach`/`afterAll` helpers.
- Backend tests run in a transaction that is **rolled back**, so they leave no trace. Verify with
  `SELECT count(*)` after a run if you doubt it.
- Aim for ~90% coverage of changes. Verify against SQL or the API rather than trusting a green
  screen.

---

## Git

- Do **not** add `Co-Authored-By` or any author trailer.
- Do **not** push — the user does that.
- Never commit log files, `node_modules`, `.venv`, build output, `.env`, or `test-results/`.
- Write a real commit message explaining *why*, not just what.
