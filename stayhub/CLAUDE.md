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
├── docker-compose.yml            postgres 5433 · hasura 8081 · elasticsearch 9200
├── hasura/                       metadata.py (tracked tables + per-role permissions) + apply script
├── stayhub-fastapi-backend/      every write, plus /search        :8000
├── stayhub-react-frontend/       guests AND hosts                 :5174
└── stayhub-react-admin-frontend/ staff only                       :5175
```

### Backend — `stayhub-fastapi-backend`

FastAPI, SQLAlchemy 2.0 (typed ORM), Alembic, Postgres.

```
app/
├── core/          config · security (JWT + bcrypt) · deps · exceptions
├── db/            base (mixins) · session
├── models/        SQLAlchemy entities + enums
├── schemas/       pydantic DTOs — the camelCase boundary
├── repositories/  the ONLY place that knows SQLAlchemy exists
├── services/      business rules — pricing, booking, cancellation policy, payments
├── search/        client · index mapping · indexer (the Postgres → ES sink) · queries
└── api/v1/routes/ auth · properties · bookings · payments · search · admin
```

**Layer rules, in priority order:**

- **Repositories NEVER commit.** A commit is a transaction boundary and only the caller knows where
  it is — "create a booking AND its payment, or neither" spans two repositories. They `flush()`.
- **Services own the rules; routes own HTTP.** A route that computes a price is in the wrong layer.
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
- The demo credentials in the footer are acceptable **only** because they are throwaway local
  fixtures. If this ever points at real data, that block is the first thing to delete.

---

## Running it

```bash
# 1 — backing services
docker compose up -d                    # postgres 5433 · hasura 8081 · elasticsearch 9200

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
```

⚠️ **The ports are not arbitrary.** 5433 because a native Postgres owns 5432; 5174/5175 because
pizza owns 5173. The backend's CORS allowlist names 5174 and 5175 and nothing else — any other port
fails CORS, and the symptom is a blank page rather than an error anyone would recognise.

**Demo logins:** `guest@stayhub.test` / `guest123` · `host@stayhub.test` / `host123` ·
`admin@stayhub.test` / `admin123`

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
cd stayhub-fastapi-backend && .venv/bin/python -m pytest -q      # 58 — needs Postgres
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
