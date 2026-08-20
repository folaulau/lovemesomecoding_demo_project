# StayHub — progress report

Shared context for the StayHub demo (Airbnb-style short-term rentals).
**Read this first when resuming work.**

**Status:** Phase 0 — scaffolding. Nothing runs yet.
**Last updated:** 2026-08-20

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
| 1 | docker-compose: postgres + hasura + elasticsearch | Claude | in progress |
| 2 | Backend skeleton + layered structure | Claude | todo |
| 3 | Schema + Alembic migrations + seed data | Claude | todo |
| 4 | Auth: signup/signin, Hasura JWT claims | Claude | todo |
| 5 | Hasura metadata: tracked tables + per-role permissions | Claude | todo |
| 6 | ES index + sync from application code | Claude | todo |
| 7 | `GET /search` over Elasticsearch | Claude | todo |
| 8 | Customer frontend: browse, detail, book | Claude | todo |
| 9 | Booking + cancellation rules (2-day cutoff) | Claude | todo |
| 10 | Stripe payment + webhook | Claude | todo |
| 11 | Host mode: become a host, add a listing | Claude | todo |
| 12 | Admin frontend | Claude | todo |
| 13 | Tests (pytest + Playwright) | Claude | todo |

---

## Gotchas paid for so far

*(nothing yet — this section earns its entries the hard way)*
