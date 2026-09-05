# Contractor — progress report

**This is the shared context. Read it first when resuming.** `CLAUDE.md` next to it holds the
standing instructions; this file holds the state, the decisions and the history.

Started and delivered 2026-09-05.

---

## Status

| Phase | What | State |
|---|---|---|
| 0 | Scaffolding, compose, docs, domain model | ✅ done |
| 1 | Frontend on mock data | ✅ done |
| 2 | NestJS backend — entities, migrations, writes, seed | ✅ done |
| 3 | Hasura metadata — tracked tables + per-role permissions | ✅ done |
| 4 | Integrate — Apollo for reads, REST for writes | ✅ done |
| 5 | QA — Playwright, backend rule tests, screenshots | ✅ done |

**Verified end to end.** 19 backend tests + 5 Playwright journeys, all green, twice in a row from a
clean seed. Screenshots in `contractor-react-frontend/screenshots/`.

---

## What this is

A Thumbtack-style marketplace: homeowners post a project, contractors quote on it, the homeowner
hires one, and rates them when it is done. It exists to produce **tutorial snippets for
lovemesomecoding.com**, and the README says the **TypeScript track will be written from this
project** — so readability and teachability outrank cleverness.

---

## The shape of it

```
                    ┌── writes (REST) ──> NestJS ──> Postgres
   React app ───────┤                                   │
                    └── reads (GraphQL) ─> Hasura ──────┘
```

Deliberately the same split StayHub teaches with FastAPI, so the two can be read side by side.
The seven business rules that justify it are listed in `CLAUDE.md`.

---

## Decisions

Settled with the user before any code was written:

| Question | Decision | Why |
|---|---|---|
| ORM | **TypeORM** | Decorator-based entities are real TypeScript classes, which is the point when the TS tutorial track is written from this repo. Closest analogue to the JPA material in the pizza project. |
| v1 scope | **Core loop + reviews** | Post → quote → hire → complete → review, plus profiles, portfolio uploads and category search. No messaging, no payments — StayHub already covers Stripe. |
| NestJS ↔ Hasura auth | **Shared-secret JWT (HS256)** | One login, two APIs, no extra hop per GraphQL request. Same pattern as StayHub. |
| Portfolio images | **Local disk via NestJS** | Bytes validated server-side, gitignored `uploads/`, served statically. Runs offline. |

Taken while building:

| Decision | Why |
|---|---|
| The staff role is called **`staff`**, not `admin` | `admin` is Hasura's built-in superuser role. Hasura refuses to define permissions for it, and a JWT claiming it gets unrestricted read **and write** access to every table — reopening the exact door this architecture closes. Cost one extra migration to discover. |
| `reviews.project_title` is **denormalised** | `projects` is unreadable by `anonymous`, and Hasura hides a relationship pointing at a table the role cannot select. So `review.project.title` on a public profile fails. Storing it is also more correct: a review describes the job as it was. |
| `Card` takes a `tone` prop rather than a `bg-*` class | Two Tailwind utilities of equal specificity are resolved by stylesheet order, not by `class` attribute order, so `<Card className="bg-slate-900">` silently stayed white. Two panels shipped visibly wrong before this was caught. |
| Migrations are **hand-written**, not generated | `migration:generate` is right on a real project. Here the file has to be readable, and generated migrations destroy exactly the reasoning worth teaching. |
| The frontend was built against a **mock with the real signatures** first | Phase 4 then changed one file — `src/api/client.ts` — and no components. That was the point of the ordering. |

---

## Domain model

Eight tables. Every table has a `bigint` primary key for internal foreign keys plus a `public_id`
UUID; **the API and the frontend expose only the UUID**. Every table has `created_at`/`updated_at`.

```
users ──1:1──> contractor_profiles ──*──> portfolio_images
  │                    │  │
  │                    │  └──*──> contractor_services ──> service_categories
  │                    │                                        ▲
  └──*──> projects ────┼────────────────────────────────────────┘
             │         │
             └──*──> quotes
             │
             └──1:1──> reviews
```

**Project status:** `open → quoted → hired → in_progress → completed`, plus `cancelled`.
**Quote status:** `pending → accepted | declined | withdrawn`.

Constraints that are business rules, not tidiness:
- `UNIQUE (project_id, contractor_profile_id)` on `quotes` — one bid per pro per job. The service
  checks first for a clean 409, but two simultaneous requests both pass that check.
- A **partial** unique index `WHERE status = 'accepted'` — at most one accepted quote per project.
  A plain unique on `(project_id, status)` would also forbid a second *declined* quote, which is
  exactly what accepting one produces.
- `UNIQUE (project_id)` on `reviews`, and `CHECK (rating BETWEEN 1 AND 5)`.

---

## Ports

Every default on this machine is taken, several by the other demo projects in this repo.

| Thing | Port | Why not the default |
|---|---|---|
| Postgres | **5434** | 5432 is a native install, 5433 is StayHub |
| Hasura | **8083** | 8080 is a Java app, 8081 is StayHub, 8082 is a node process |
| NestJS API | **3001** | 3000 is the first port every other tool grabs |
| React app | **5177** | 5173 is pizza, 5174/5175 are StayHub, 5176 was already held |

---

## Verified

**Hasura permissions**, checked against the running stack rather than reasoned about:

- Anonymous: reads the directory; `projects` is not in its schema at all; `users.email` and
  `users.password_hash` are not fields that exist for any role.
- Homeowners see only their own projects (Maya 3, Daniel 1) and every quote on them.
- Nina (electrical) does not see a plumbing job; Luis (plumbing) does.
- **Luis sees 1 of the 6 quote rows in the table — his own.** Maya, on the same project, sees both
  bids. The competitor-price leak is closed.
- `mutation { … }` returns *"no mutations exist"* for every role.
- `hasura/apply.mjs` exits non-zero if a write permission ever appears.

**Business rules**, all seven, through the API and again through the UI. See
`contractor-nestjs-backend/test/rules.e2e-spec.ts` and `contractor-react-frontend/e2e/journey.spec.ts`.

---

## Not built (deliberately)

- **Messaging** between homeowner and contractor — scoped out with the user.
- **Payments** — StayHub already covers Stripe; duplicating it teaches nothing new.
- **A staff console.** The `staff` role exists in the schema and has full read permissions in
  Hasura, but no UI. Adding one is the obvious next slice.
- **Search beyond `_ilike`.** Fine at this size; a leading `%` cannot use an index, so a real
  directory would want Postgres full-text search or Elasticsearch.
- **Refresh tokens.** The JWT lasts 7 days and there is no rotation.

---

## History

### 2026-09-05 — built, phases 0 through 5

- Requirements clarified; the four decisions above settled before any code.
- Scaffolded both apps. ⚠️ The current Nest scaffold is **ESM**, NestJS 12, TypeScript 6, and ships
  **vitest + oxlint** rather than jest + eslint — a meaningful departure from every tutorial written
  against Nest 10, and it changes how TypeORM has to be wired. See the ESM notes in `CLAUDE.md`.
- Frontend built first against an in-memory mock, then the backend, then Hasura, then integrated.
- Four bugs found and fixed during QA, each now documented as a gotcha in `CLAUDE.md`:
  1. `publicId` became a quoted, case-sensitive column — TypeORM uses the property name verbatim.
  2. Hasura reserves `admin`; the app's staff role had to be renamed, via a second migration rather
     than by editing the applied one.
  3. Apollo could not normalise `contractor_services`, which rendered the directory empty while the
     GraphQL response was perfectly fine.
  4. `bg-*` in `className` lost to `Card`'s own `bg-white` — stylesheet order, not attribute order.
- The home page had no error branch, so the third bug rendered as an empty section with no message.
  Added one; that is why the bug was invisible for as long as it was.
