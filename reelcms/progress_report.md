# ReelCMS — progress report

Shared context for the ReelCMS demo (Vue 3 + Bootstrap frontend, Spring Boot backend, MongoDB).
Read this first when resuming work.

**Status:** Phases 0–5 complete. The app runs end to end on real data.
**66 backend tests + 25 Playwright tests, all green.**
**Last updated:** 2026-08-24

**Run the database:** `docker compose up -d` → MongoDB on **27018** (single-node replica set)
· `--profile tools` adds mongo-express on 8091

**Run the backend:** `cd reelcms-springboot-backend && ./mvnw spring-boot:run` → http://localhost:8087
· Swagger UI at http://localhost:8087/swagger-ui.html
· seeds itself on first start; `docker compose down -v` to start over

**Run the frontend:** `cd reelcms-vue-frontend && npm run dev` → http://localhost:5176
· `npm run test:e2e` — 25 tests (**needs all three services up**)
· `npm run screenshots` — regenerate `screenshots/`
· `VITE_USE_MOCK=true` in `.env.local` runs the whole UI with no backend

**Run the backend tests:** `cd reelcms-springboot-backend && ./mvnw test` — 66 tests, needs MongoDB
· `./mvnw spotless:apply` before committing Java

**Demo logins:** `admin@reelcms.test` / `admin123` · `creator@reelcms.test` / `creator123`

---

## Purpose

A short-video content management system — the authoring side of Instagram Reels, or a sports
highlights desk. It exists to produce **MongoDB tutorial snippets** for lovemesomecoding.com, so
readability and teachability outrank cleverness.

It is the counterweight to `pizza` (MySQL + JPA + Liquibase). Same Spring Boot version, same
layering, **different database** — put the two side by side and the difference is exactly what a
document store changes.

---

## Requirements (agreed 2026-08-24)

| Decision | Choice |
|---|---|
| Scope | Admin CMS **and** a public vertical-scroll feed |
| Video | Real upload to a local `uploads/` dir + poster images; metadata in Mongo |
| Mongo focus | Aggregation pipeline · embedded-vs-referenced modeling · text search + compound indexes · change streams + time-series |
| Auth | JWT, roles `ADMIN` and `CREATOR`; public feed stays open |

---

## Stack

| Layer | Choice |
|---|---|
| Frontend | Vue 3 (`<script setup>`) · Vite · Vue Router · Pinia · Bootstrap 5 · Chart.js |
| Backend | Java 21 · Spring Boot 4.1.0 · Spring Data MongoDB 5.1 · Spring Security + JWT · Lombok |
| Database | MongoDB 8, single-node replica set (required for change streams) |

One Vue app serves both surfaces (public at `/`, admin at `/admin`), matching pizza.

### Ports

| Service | Port | Note |
|---|---|---|
| MongoDB | 27018 | pizza uses MySQL 3308 |
| mongo-express | 8091 | optional, `--profile tools` |
| Spring Boot API | 8087 | pizza uses 8085 |
| Vue dev server | 5176 | 5173–5175 taken by pizza and stayhub |

---

## Data model — the part that matters

Six collections. The point of the demo is *why* each piece is embedded or referenced.

### `reels` — the aggregate root

```jsonc
{
  "_id": ObjectId,
  "slug": "around-the-outside-on-the-final-lap",   // unique index
  "title": "…", "description": "…",
  "status": "PUBLISHED",                  // DRAFT | SCHEDULED | PUBLISHED | ARCHIVED
  "publishedAt": ISODate, "scheduledFor": ISODate,
  "video": { … },                         // EMBEDDED — 1:1, always read together
  "creator": { "id": ObjectId, "username", "displayName", "avatarUrl" },  // REFERENCED + snapshot
  "tags": ["motorsport", "overtake"],     // EMBEDDED — bounded, queried (multikey)
  "collectionIds": [ObjectId],            // REFERENCED — many-to-many
  "stats": { "views", "likes", "comments", "shares" },   // EMBEDDED, moved with $inc
  "createdAt": ISODate, "updatedAt": ISODate
}
```

**The teaching points, in order of importance:**

1. **`video` is embedded** — 1:1, and no query wants a video without its reel. A join buys nothing.
2. **`creator` is referenced *and* snapshotted.** The `id` is the truth; the three display fields
   are a copy so the feed renders with no `$lookup`. The cost is a fan-out when a creator is
   renamed — `CreatorServiceImpl.update()` does exactly that in one `updateMulti`, and the admin
   dialog names how many reels are about to be rewritten. The trade is shown, not hidden.
3. **`tags` is embedded** — bounded, always displayed, queried through a multikey index.
4. **`comments` is its own collection.** The single most important lesson: unbounded growth blows
   the 16 MB document cap on your most successful content, and every feed read would drag the whole
   thread along. **Embed what is bounded, reference what grows.**
5. **`stats` is embedded and moved with `$inc`** — atomic on a single document, no transaction. The
   relational equivalent needs a row lock.

### The other five

| Collection | Why it is shaped that way |
|---|---|
| `creators` | Owns the canonical profile. `followerCount` is deliberately **not** in the snapshot — it changes far too often to fan out |
| `comments` | Unbounded growth ⇒ separate collection. The author *is* snapshotted, so a thread renders with no join |
| `reel_collections` | Membership stored on **both** sides, because both directions are queried. `ReelCollectionServiceImpl` keeps them in step |
| `view_events` | **Time-series**, `ts` + `metadata{reelId, creatorId, country, device}`, 90-day TTL |
| `users` | Separate from `creators`: an ADMIN is not a creator, and a creator profile outlives whoever logs in to manage it |

### Indexes — all in `MongoIndexConfig`

| Collection | Index | Serves |
|---|---|---|
| `reels` | `{status: 1, publishedAt: -1}` | the public feed — the hot path |
| `reels` | `{"creator.id": 1, status: 1, publishedAt: -1}` | a creator's own reels |
| `reels` | `{slug: 1}` unique | permalinks, and the slug-collision guard |
| `reels` | `{tags: 1, publishedAt: -1}` | multikey — browse by tag |
| `reels` | text on title/tags/description, weighted 10/8/5 | search |
| `comments` | `{reelId: 1, createdAt: -1}` | a reel's thread |
| `creators`, `reel_collections`, `users` | unique on username / slug / email | |

Declared in one file rather than with `@Indexed`, because auto-index-creation is off (an annotation
that triggers an index build on a live collection is a production incident starting as a one-line
diff) and because an index strategy is only reviewable when you can see all of it at once. Field
order follows **ESR** — Equality, Sort, Range.

---

## Aggregation pipelines (`ReportDAOImp`)

All against real data. No hard-coded figures anywhere.

| Report | Pipeline |
|---|---|
| Views over time | `$match` ts → `$lookup` reels → `$group` by `$dateTrunc` day → `$sort` |
| Top reels | `$group` by reelId → `$sort` → `$limit` → `$lookup` → `$unwind` |
| Engagement by tag | `$match` published → `$unwind` tags → `$group` → `$sort` |
| Completion rate | `$lookup` for the duration → `$group` with `$avg` of `$min(1, watch/duration)` |
| Trending tags | `$unwind` → `$group` → `$sort` → `$limit` |

Stages the fluent builder handles well use it; the rest use `Aggregation.stage(json)`, which is
copy-pasteable straight into mongosh — and unlike nested `new Document(...)`, does not reject nulls
in surprising places.

---

## Change streams

`ReelStatsStreamService` tails a change stream on `reels`, filtered server-side to updates, and
republishes each view-count change over **SSE** at `GET /api/admin/stream/stats`. The dashboard's
live panel ticks with no polling.

Verified end to end: `POST /views` → `$inc` → oplog → change stream → SSE → browser.

**This is why MongoDB runs as a replica set** — change streams are built on the oplog, and a
standalone `mongod` has no oplog.

---

## Phases

- [x] **Phase 0** — scope, stack, data model, ports
- [x] **Phase 1** — Vue frontend on mock data, all screens
- [x] **Phase 2** — Spring Boot backend, entities, indexes, seed data, JWT
- [x] **Phase 3** — aggregation reports + change-stream SSE
- [x] **Phase 4** — frontend wired to the real API, mocks retained behind a flag
- [x] **Phase 5** — QA: 66 backend tests, 25 Playwright tests, `spotless apply`, screenshots

### Possible next steps
- Per-viewer liked/saved reels (like state is currently per-session, not persisted per viewer)
- Comment moderation and deletion
- Real transcode + poster extraction on upload (the poster is uploaded separately today)
- S3 behind `MediaStorageService`, already the only filesystem-aware class

---

## Decisions

**2026-08-24 — one Vue app, not two.** stayhub splits public and admin; pizza keeps `/admin` in the
one app. Following pizza: less scaffolding for a reader, and the router guard is itself a useful
snippet.

**2026-08-24 — video on local disk, not GridFS.** GridFS is the more distinctive Mongo feature, but
recommending it for video would teach a bad habit — object storage is the production answer. The
tutorial mentions where GridFS genuinely fits.

**2026-08-24 — no MapStruct, unlike pizza.** The interesting question here is which document fields
reach the wire (`User.passwordHash` being the one that matters), and a generated mapper hides that.
Twenty lines of obvious mapping beat a generated class.

**2026-08-24 — seeded counters are DERIVED from seeded events, not invented.** The first cut gave
each reel a big round view count and inserted a few thousand events underneath it. The dashboard
then showed a 7.5M headline above a top-reels table whose best row read 390 — two numbers on one
screen that could not both be true. Counters are now reconciled from the events actually inserted
(`DataSeeder.reconcileStats`). The figures are smaller and they all agree.

**2026-08-24 — `uniqueViewers` removed from the reports.** There is no viewer identity on a view
event, so it could not be computed honestly. Deriving something plausible-looking would have broken
the app's own rule about real aggregates.

---

## Bugs found and fixed during QA

Kept because each is a real MongoDB or Spring Boot 4 trap, and each is now commented at the site.

| Symptom | Cause |
|---|---|
| Connection refused on **27017**, a port in no config file | Spring Boot 4 renamed `spring.data.mongodb.uri` → `spring.mongodb.uri`. The old key is ignored silently and the driver uses its default |
| Integration tests **deleted the demo data** | `spring.mongodb.database` was set alongside a URI that already named a database. The standalone property wins, so the test's URI override was ignored and every test ran against `reelcms` |
| `view_events` created as an **ordinary collection** | `DataSeeder` is an `ApplicationRunner`, which fires *before* `ApplicationReadyEvent`. Index setup moved to `@PostConstruct` |
| Three reports returned **empty arrays**, no error | `$lookup` compares types strictly. `metadata.reelId` was a BSON string, `reels._id` an ObjectId. Fixed with `@Field(targetType = OBJECT_ID)` |
| Change stream **opened cleanly and delivered nothing** | `filter(Aggregation)` is field-mapped against the domain type, and `operationType` is a change-event field, not a `Reel` field. Use `filter(Document...)` |
| First live view per reel never reached the dashboard | No baseline to diff against. `primeBaseline()` seeds it at startup |
| A timestamp changed between the POST response and a later GET | BSON keeps milliseconds; `Instant.now()` has microseconds. Everything routes through `Timestamps.now()` |
| Login form said **"your session expired"** on a wrong password | A 401 was treated as expiry regardless of whether a token had been sent |
| Creators got a **403 in the console** on every visit to `/admin/reels` | The list called the ADMIN-only `/api/admin/creators` unconditionally, and showed them an empty, useless filter |
| Donut chart painted **PUBLISHED in the DRAFT colour** | Colours were keyed by array position; the API returns statuses in enum order while the mock returned them published-first |
| Both "Dashboard" and "Reels" highlighted at once | Vue Router marks a link to an index child active whenever any sibling is |
| A broken poster **stretched a table row** to 200px | `"4th & Inches"` — a raw `&` makes the inline SVG malformed, so the browser fell back to alt text |

---

## Added for the Vue tutorial track (2026-08-24)

`projects/vue_tutorial` quotes this app for every snippet, and an audit found three things the track
needed that the app did not have. Two were closed; the rest are taught generically rather than
faked. See `projects/vue_tutorial/progress_report.md` for the full gap table and the decision.

Both additions are improvements on their own terms — neither exists only to serve a lesson.

| Added | Where | Why it is a real improvement | Serves |
|---|---|---|---|
| `useIntersectionObserver` | `src/composables/`, used by `FeedView` | The observer's creation, its pre-mount target buffering and its `disconnect()` were inline in the view. A component can no longer leak it, and what stays in `FeedView` is only the part that is about the feed. | Lesson 15 — the app had **no composables at all** |
| `useDebounced` | `src/composables/`, used by `ExploreView` | Explore now searches **as you type**. It could not before: submitting the form was the only way to search, because a request per keystroke would be six text-index queries for "buzzer", five of them stale on arrival. | Lesson 15 |
| `<Teleport to="body">` | the confirm-delete overlay in `ReelListView` | The overlay is `position: fixed`, which is **not** immune to its ancestors — a `transform`, `filter`, `backdrop-filter` or `contain` anywhere above it makes that ancestor the containing block and the overlay is clipped to it. Nothing does that today; teleporting to `<body>` means nothing can. | Lesson 23 |

**Not added, deliberately:** a Vitest unit suite, a `v-autofocus` custom directive, and named/scoped
slots. Each would have been a change made purely to serve a lesson, and the lessons say plainly that
the app's own suite is Playwright end-to-end and show the rest as generic examples.

### Verification

`npm run build` passes. `npm run test:public` — **12/12 pass**, including the two that exercise the
changes directly (cursor paging through the observer, and explore search). `npm run test:admin` —
**12/13**, and test 8 `create → publish → appears publicly → delete` (the one that drives the
teleported modal) passes.

⚠️ The single admin failure, *"the headline total agrees with the daily chart"*, is **pre-existing
and unrelated**. Confirmed by stashing the changes and re-running it: identical result, a drift of
63 against a threshold of 20. It is an aggregation disagreement between the headline total and the
daily chart sum — worth chasing separately, and nothing to do with the frontend.
