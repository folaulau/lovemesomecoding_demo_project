# Contractor

A Thumbtack-style marketplace: homeowners post a project, contractors quote on it, the homeowner
hires one, and rates them when the work is done.

It exists to produce **tutorial snippets for lovemesomecoding.com**, and the README says the
**TypeScript track will be written from this project** — so readability and teachability outrank
cleverness. Where a "real production" choice and a "clear teaching example" choice conflict, prefer
the teaching one and leave a comment saying what production would do differently.

**`progress_report.md` in this directory is the shared context — read it first when resuming.**
This file is the standing instructions; that one is the state and the history.

---

## The shape of it

The split is the lesson, and it is deliberately the same one StayHub teaches with FastAPI, so the
two projects can be read side by side:

```
                    ┌── writes (REST) ──> NestJS ──> Postgres
   React app ───────┤                                   │
                    └── reads (GraphQL) ─> Hasura ──────┘
```

- **Every create, update and delete goes through NestJS.** That is what makes the rules below
  impossible to bypass. **No role has an insert/update/delete permission in Hasura — deliberately.**
- **Every read comes from Hasura**, with row-level permissions doing the filtering.
- **One JWT**, signed by NestJS, verified by Hasura with the same HS256 secret. One login, two
  APIs, no auth webhook.

### The seven rules that live in NestJS and nowhere else

These are the reason writes do not go through Hasura. Each is a service-layer check, and each has a
test in `test/rules.e2e-spec.ts`:

1. A contractor may only quote on a project whose category is one of their services.
2. A contractor may only quote on a project that is `open` or `quoted`, and only once.
3. Only the homeowner who owns a project may accept a quote on it.
4. Accepting a quote sets that quote `accepted`, **every other quote `declined`**, and the project
   `hired` — in one transaction, or none of it.
5. Only the hired contractor may move a project `hired → in_progress → completed`. Only the
   homeowner may cancel, and only before anyone is hired.
6. A review may only be left by the owning homeowner, only on a `completed` project, only once.
7. `rating_average` and `review_count` are **recomputed server-side** from the review rows. A
   request body never carries them, and there is no DTO field for either.

---

## Running it

```bash
# 1 — backing services
docker compose up -d                     # postgres 5434 · hasura 8083

# 2 — schema and demo data
cd contractor-nestjs-backend
npm install --legacy-peer-deps
npm run migration:run
npm run seed

# 3 — Hasura metadata (tracked tables + per-role permissions)
cd .. && node hasura/apply.mjs

# 4 — the API
cd contractor-nestjs-backend && npm run start:dev      # :3001

# 5 — the app
cd contractor-react-frontend && npm run dev            # :5177
```

**Demo logins:** `maya@contractor.test` / `maya123` (homeowner) ·
`luis@contractor.test` / `luis123` (plumbing + HVAC) ·
`nina@contractor.test` / `nina123` (electrical only — useful for testing the trade filter).
Every seeded password is the first name lower-cased plus `123`.

⚠️ **The ports are not arbitrary.** 5434 because a native Postgres owns 5432 and StayHub owns 5433;
8083 because 8080/8081/8082 are all taken on this machine; 5177 because 5173 is pizza, 5174/5175
are StayHub, and something else already holds 5176. The backend's CORS allowlist names 5177 and
nothing else, and Vite runs with `strictPort` — a silent port change would show up as a blank page
and a CORS error rather than anything that mentions a port.

**Infrastructure credentials** — Postgres, the Hasura admin secret, the shared JWT secret — are
documented in a table at the top of `docker-compose.yml`, next to the values they describe. They are
throwaway local fixtures, checked in on purpose so the demo runs with one command.

## Test

```bash
cd contractor-nestjs-backend  && npm run test:e2e   # 19 — the seven rules, against the real DB
cd contractor-react-frontend  && npm run test:e2e   #  5 — the whole loop through the real UI
cd contractor-react-frontend  && npm run screenshots
```

- ⚠️ **Both suites need everything running** — compose, a migrated and seeded database, the API and
  the dev server.
- ⚠️ **Both clean up after themselves**, and that is load-bearing. The backend suite deletes its
  projects in `afterAll`; Playwright does it in `e2e/global-teardown.ts`, which also **recomputes
  the cached ratings** — deleting a test review does not restore the average it contributed to.
  A leftover project shows up in the next run's lead feed and the failure looks like an app bug.
- ⚠️ **Never run the Playwright suite in parallel.** `workers: 1` is set for the same reason.

---

## Gotchas that already cost time — do not rediscover these

### The Nest scaffold is ESM, and that changes things
- **Every relative import needs a `.js` extension**, including from a `.ts` file. Node's ESM
  resolver does not guess, and the specifier has to name the file that exists at RUNTIME. Leave it
  off and it compiles fine, then dies at startup with `ERR_MODULE_NOT_FOUND`.
- **The TypeORM CLI and the seed run against `dist/`**, not `src/`. There is no working `ts-node`
  loader for ESM + decorators + `emitDecoratorMetadata`, and without that metadata TypeORM cannot
  read the entities at all. The npm scripts build first — that is why `npm run seed` is slow.
- **`entities` and `migrations` are imported CLASSES, never globs.** Glob patterns are what every
  tutorial shows and they do not resolve reliably under ESM. The failure is not an error, it is an
  empty entity list that surfaces much later as *"No metadata for User was found"*.
- **`npm install` needs `--legacy-peer-deps`.** npm 10.9.8's peer resolver crashes on this
  scaffold's vitest graph with `Cannot read properties of null (reading 'edgesOut')`. It is an npm
  bug, not a dependency conflict, and the flag sidesteps the crashing code path.

### TypeORM
- **Every multi-word column needs an explicit `name`.** The default is the PROPERTY name verbatim,
  so `publicId` becomes a column called `"publicId"` — quoted and case-sensitive. This shipped as
  `column "publicId" of relation "service_categories" does not exist` on the very first seed.
- **`bigint` and `numeric` come back as STRINGS**, for precision reasons. The money columns carry
  transformers so services see numbers; ids stay strings and must be compared, never added.
- **`synchronize` is false and must stay false.** It silently drops columns and leaves no record of
  how the schema got where it is.
- **Never edit an applied migration.** Postgres has already run it and the `migrations` table has
  already recorded it, so an edit only changes what NEW databases get — and the two diverge forever
  with nothing to detect it. `1757040000000-RenameAdminRoleToStaff` exists precisely because of this.

### Hasura
- **`admin` is Hasura's BUILT-IN superuser role.** You cannot define permissions for it (*"cannot
  define permission for admin role"*), and a JWT claiming it gets unrestricted read AND WRITE access
  to every table — reopening the exact door this architecture closes. The app's staff role is
  therefore called **`staff`**. Never name an application role `admin`.
- **A relationship field is hidden from a role with no `select` on the table it points at.**
  `projects` is unreadable by `anonymous`, so `review.project.title` on a public profile fails with
  *"field 'project' not found in type: 'reviews'"*. The title is denormalised onto `reviews` — see
  the `AddProjectTitleToReviews` migration.
- **A join table used inside a permission filter must itself be readable by that role.** Hasura
  evaluates a permission's relationship hops against the target table's permissions too, so a
  locked-down `contractor_services` makes the lead-feed filter match nothing, silently.
- **Session variables must be STRINGS.** A JSON number for `x-hasura-user-id` produces an error deep
  inside a permission rule that never mentions the real cause.
- **`replace_metadata` is a REPLACE.** Anything tracked in the console and not written in
  `hasura/metadata.mjs` disappears on the next apply. That is intended — the file is the source of
  truth, and a console click that survives a re-apply is a permission nobody reviewed.
- **`allow_inconsistent_metadata: false`.** The default accepts metadata referencing a table that
  does not exist and marks it "inconsistent", so a typo applies cleanly and the permission it
  belonged to is simply not enforced.

### React / Tailwind / Apollo
- **`bg-*` passed in `className` does NOT override a component's own `bg-*`.** Two utilities of
  equal specificity are resolved by their order in the generated STYLESHEET, not in the `class`
  attribute. `<Card className="bg-slate-900">` silently stayed white. `Card` takes a `tone` prop
  instead — `tailwind-merge` is the dependency that solves this generally.
- **Apollo cache keys: `keyFields: false` on `contractor_services`.** Keying it on its foreign keys
  looks right and breaks, because the queries do not select those columns. The error happens during
  cache normalisation, so the response is fine and the directory just renders empty.
- **Every type is keyed on `public_id`** — Hasura never exposes the primary key, and Apollo's
  default is to normalise on `id`.
- **Apollo v4 needs the `DeclareDefaultOptions` module augmentation** before it accepts a default
  `errorPolicy`. Without it the compile error's TEXT is the instruction.
- **No backticks inside a `gql` template literal**, comments included — a backtick ends the JS
  string, and the parse error points at the line AFTER the comment.
- **`erasableSyntaxOnly` is on in the frontend**, so no TS `enum` and no constructor parameter
  properties. The backend does not use that flag and relies on parameter properties throughout.
- **Send no `Authorization` header at all when signed out** — not `Bearer null`. Hasura only falls
  back to the `anonymous` role when the header is ABSENT.
- **Never set `Content-Type` on a `FormData` request.** The browser must generate it, because it
  carries the multipart boundary.
- **`rxjs` must be installed explicitly.** Apollo Client v4 declares it as a PEER dependency, so
  npm does not install it and `npm run dev` works anyway — Vite resolves it lazily. `npm run build`
  is the first thing that fails: *"Rolldown failed to resolve import 'rxjs' from
  @apollo/client/link/context"*. A dev server that works is not evidence the bundle does.

---

## Security — non-negotiable

- **The role never comes from a request body.** `RegisterDto` permits `homeowner` or `contractor`
  and nothing else; there is no code path anywhere that creates a `staff` account from a request.
- **Foreign-owned resources return 404, not 403.** A 403 confirms the id exists, which on a
  guessable identifier is a slow enumeration of every job on the site.
- **Login failures are deliberately vague, and deliberately slow.** One message for "no such
  account" and "wrong password", and a dummy bcrypt comparison on the no-user path so the two take
  the same time — the timing difference is the same oracle the shared message just closed.
  Registration is the one place that must admit an address is taken.
- **A contractor may only ever read their OWN quotes.** The permission is
  `contractor_profile_id = X-Hasura-Contractor-Id`. The natural-sounding alternative — "quotes on
  projects I can see" — lets the last pro to bid undercut every rival by a dollar, and after that
  nobody quotes honestly. It is the single most consequential line in `hasura/metadata.mjs`.
- **The rating is derived, never written.** No DTO field, no Hasura update permission, recomputed
  inside the same transaction as the review.
- **Uploads are validated by their BYTES, not by `Content-Type`.** That header is whatever the
  client typed. `contractors/image-validation.ts` sniffs the magic numbers, the stored filename is
  generated from a UUID, and multer's `limits.fileSize` stops reading at 5 MB.
- **Never put `x-hasura-admin-secret` in the frontend.** It bypasses every permission rule. Hasura's
  own quickstart does this; it is fine in a script and catastrophic in a bundle. Grep `src/` and you
  will find nothing.
- **CORS is an explicit allowlist, never `origin: true`.** Reflecting the request's own Origin lets
  any site the user visits call the API as them.
- **`whitelist` + `forbidNonWhitelisted` on the global ValidationPipe.** Without the global pipe,
  every `class-validator` decorator in every DTO is inert — an app that looks validated and is not.
- The demo credentials in the footer and on the sign-in page are acceptable **only** because they
  are throwaway local fixtures. If this ever points at real data, those blocks go first.

---

## Layout

```
contractor/
├── docker-compose.yml            postgres 5434 · hasura 8083 · the shared JWT secret
├── hasura/
│   ├── metadata.mjs              tables, relationships, per-role SELECT permissions
│   └── apply.mjs                 node hasura/apply.mjs [--check]
├── contractor-nestjs-backend/
│   ├── src/common/               enums · guards · decorators · serializers
│   ├── src/config/               every env var, parsed and typed, in one place
│   ├── src/database/             entities · data-source · migrations
│   ├── src/auth/                 register, login, the JWT with its Hasura claims
│   ├── src/{projects,quotes,reviews,contractors}/    one module per rule cluster
│   ├── src/scripts/seed.ts       the demo dataset
│   └── test/rules.e2e-spec.ts    the seven rules
└── contractor-react-frontend/
    ├── src/api/                  client.ts (the seam) · queries.ts (GraphQL + mappers)
    ├── src/lib/                  apollo · auth · config · format · useAsync
    ├── src/components/           ui.tsx (primitives) · Layout · ContractorCard · badges
    ├── src/pages/                public + homeowner, and pro/ for contractors
    └── e2e/                      journey.spec.ts · global-teardown.ts · screenshots.mjs
```

**`src/api/client.ts` is the seam.** Every screen reads and writes through it and knows nothing
about where the data comes from. The app was built against an in-memory mock with exactly these
signatures; swapping in Hasura and NestJS changed that one file and no components.

**Layer rules, in priority order:**
- **Services own the rules; controllers own HTTP.** A controller that decides who may do something
  is in the wrong layer — except where the answer depends on the row, which is why
  `PATCH /projects/:id/status` has no `@Roles` and checks inside the service.
- **The actor always comes from the verified token, never from the body.** No endpoint accepts a
  `homeownerId` or a `contractorId`.
- Every table has a BIGINT primary key for internal FKs plus a `public_id` UUID.
  **The API exposes only the UUID.**
- Deletes are soft where another row references the record forever.

---

## Git

- Do **not** add `Co-Authored-By` or any author trailer.
- Do **not** push — the user does that.
- Never commit `node_modules`, `dist/`, `.env`, `uploads/`, `test-results/` or log files.
- Write a real commit message explaining *why*, not just what.
