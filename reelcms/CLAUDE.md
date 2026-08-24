# ReelCMS

A short-video CMS — reels and highlights — that exists to produce **MongoDB tutorial snippets** for
lovemesomecoding.com. Readability and teachability outrank cleverness. Where a "real production"
choice and a "clear teaching example" choice conflict, prefer the teaching one and leave a comment
saying what production would do differently.

**`progress_report.md` in this directory is the shared context — read it first when resuming.**
This file is the standing instructions; that one is the state. `README.md` is for a reader arriving
at the repo.

---

## The point of this app

It is the counterweight to `pizza` (MySQL · JPA · Liquibase). Same Spring Boot version, same
layering, **different database**. A reader should be able to open both and see exactly what changes
when a relational store becomes a document store.

So: when adding anything here, ask whether it teaches something about MongoDB. If it does, comment
it at the point it matters. If it does not, keep it small.

---

## Requirements

### Product
- **Public feed** at `/` — a vertical scroll-snap pager, one reel per screen.
- **Explore** — full-text search and tag browsing.
- **Permalinks** for reels, creators and collections.
- **`/admin`** — CRUD for reels, collections and creators, plus an analytics dashboard.
- Dashboard figures come from **real aggregation pipelines**, never a hard-coded number. Same rule
  as pizza's reports.
- **JWT auth**, roles `ADMIN` and `CREATOR`. A creator manages only their own reels; only an admin
  manages creators. The public feed needs no account.
- **Video uploads** to a local `uploads/` directory. Object storage is the production answer and is
  noted as such — `MediaStorageService` is the only class that touches the filesystem, so swapping
  in S3 is one file.

### Deliberately out of scope
Real transcoding, adaptive bitrate, follows/subscriptions, notifications, moderation queues, a
recommendation feed. Each would add a lot of code and teach nothing about MongoDB.

---

## Structure

### Backend — `reelcms-springboot-backend`

Java 21, Spring Boot 4.1.0, Spring Data MongoDB. Layered the same way as `pizza`.

```
com.reelcms.api
├── config/    SecurityConfig · MongoConfig · MongoIndexConfig · WebMvcConfig · OpenApiConfig · Timestamps
├── dto/       Dtos (every record, one file) + EntityDtoMapper
├── entity/    one package per document, everything for it together:
│   ├── reel/          Reel · VideoAsset · CreatorRef · ReelStats · DAO/Service/Controllers · SlugService
│   ├── creator/       Creator · AvatarFactory · …
│   ├── comment/       Comment · …
│   ├── reelcollection/ ReelCollection · CoverFactory · …
│   ├── viewevent/     ViewEvent (time-series) · ViewEventService
│   └── user/          User · AuthService · AuthRestController
├── exception/ ApiError · ApiException · RestExceptionHandler
├── report/    ReportDAO/Imp · ReportService/Impl · ReportRestController
├── security/  JwtService · JwtAuthenticationFilter · AuthPrincipal
├── storage/   MediaStorageService · UploadRestController
├── stream/    ReelStatsStreamService  (change stream → SSE)
└── seed/      DataSeeder
```

**One package per document, everything for it together** — `Reel.java`, `ReelRepository`, `ReelDAO`,
`ReelDAOImp`, `ReelService`, `ReelServiceImpl`, `ReelRestController`, `AdminReelRestController`.
Note the spelling: `DAOImp`, not `DAOImpl`, matching pizza.

#### The DAO rule
Every DAO is an **interface plus an implementation**, and the implementation uses a Spring Data
repository **or** `MongoTemplate` — whichever each method needs. Same split pizza keeps between a
repository and `JdbcTemplate`.

- **Repository** for anything Spring Data can derive from a method name: `findBySlug`,
  `existsBySlug`, `findByStatusOrderByPublishedAtDesc`.
- **`MongoTemplate`** for everything else: dynamic filters, `$text` search, aggregation pipelines,
  and any partial update. **A counter change is always `$inc`, never load-mutate-`save()`** — the
  latter loses increments under concurrency and rewrites the whole document.
- `ReportDAOImp` is MongoTemplate-only, because a report never loads or saves an entity.

#### Deviations from pizza, and why
- **No MapStruct.** `EntityDtoMapper` is hand-written. A generated mapper is code you cannot read
  next to the model, and here the interesting question is which document fields reach the wire —
  `User.passwordHash` being the one that matters.
- **No Liquibase.** There is no schema to migrate. `MongoIndexConfig` owns the indexes instead, and
  is the file to read to understand the query strategy.

### Frontend — `reelcms-vue-frontend`

Vue 3 with `<script setup>`, Vite, Vue Router, Pinia, Bootstrap 5, Chart.js.

**One app serves both surfaces**, split by layout rather than by build — `/` public, `/admin`
behind a router guard. pizza does the same; stayhub splits them. A single app is less scaffolding
for a reader to hold in their head.

**Everything goes through `src/api/index.js`.** No component imports `mock.js` or `http.js`
directly, which is what keeps `VITE_USE_MOCK` a one-line switch. The two modules must stay
method-for-method identical.

**Bootstrap first.** Reach for a Bootstrap class before writing CSS. `assets/styles.css` holds only
variable overrides (so the framework re-themes itself) and the few components Bootstrap has no
equivalent for — the scroll-snap feed, mainly.

---

## Working on this

1. **Read `progress_report.md`.**
2. **Frontend first** where there is UI work — build against `src/api/mock.js`, then wire it up. The
   mock defines the contract the backend implements.
3. **Comment the MongoDB decisions at the point they bite**, not in a doc nobody opens. The
   `$lookup` type mismatch, the `$inc` versus `save()` choice, the embed/reference call — those
   comments are the actual deliverable.
4. **Test what MongoDB actually does.** No embedded or in-memory Mongo: it would either not
   implement the behaviour under test or implement it differently.
5. **Run both suites before saying it works** — `./mvnw test` and `npm run test:e2e`.
6. **`./mvnw spotless:apply`** before committing any Java.
7. **Never invent a number.** If a figure cannot be derived from the data, either derive it or
   remove it. A dashboard that disagrees with itself is worse than one panel fewer.

### Gotchas
`README.md` carries the full list, each also commented in the code. Read it before debugging
anything involving connection properties, `$lookup`, change streams, or the time-series collection.

---

## Git
- Do **not** add `Co-Authored-By` or any author trailer to commits.
- Do **not** push to remote.
- Never commit `uploads/`, `node_modules`, `target/`, `test-results/`, or log files.
- Write a real commit message explaining *why*, not just what.
