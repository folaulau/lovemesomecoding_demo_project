# ReelCMS

A short-video content management system — the authoring side of Instagram Reels, or a sports
highlights desk. It exists to produce **MongoDB tutorial snippets** for lovemesomecoding.com.

It is the deliberate counterweight to the `pizza` demo: same Spring Boot version, same layering,
**different database**. Put the two side by side and you can see exactly what changes when you swap
a relational store for a document store.

| | |
|---|---|
| Public feed | vertical scroll-snap pager, explore/search, creator pages, collections |
| Studio | `/admin` — reels, collections, creators, and a live analytics dashboard |
| Frontend | Vue 3 · Vite · Vue Router · Pinia · Bootstrap 5 · Chart.js |
| Backend | Java 21 · Spring Boot 4.1 · Spring Data MongoDB · Spring Security + JWT · Lombok |
| Database | MongoDB 8, single-node replica set |
| Tests | 66 backend (JUnit) · 25 end-to-end (Playwright) |

---

## Running it

Three terminals. **Start the database first** — the API seeds itself on first boot.

```bash
# 1. MongoDB on 27018  (add --profile tools for mongo-express on 8091)
docker compose up -d

# 2. API on 8087       (Swagger UI at http://localhost:8087/swagger-ui.html)
cd reelcms-springboot-backend && ./mvnw spring-boot:run

# 3. Site on 5176
cd reelcms-vue-frontend && npm install && npm run dev
```

Then open **http://localhost:5176**.

**Demo logins** — `admin@reelcms.test` / `admin123` · `creator@reelcms.test` / `creator123`

The first API start seeds 5 creators, 4 collections, 16 reels and ~30,000 view events. To start
over: `docker compose down -v && docker compose up -d`.

### Frontend with no backend at all

The whole UI runs against an in-memory fixture, which is how it was built:

```bash
cd reelcms-vue-frontend
echo "VITE_USE_MOCK=true" > .env.local && npm run dev
```

The badge in the admin header always says which source is live. Vite reads `.env` at startup, so
changing it needs a dev-server restart.

---

## Tests

```bash
# backend — 66 tests. Needs MongoDB up; uses a throwaway `reelcms_test` database.
cd reelcms-springboot-backend && ./mvnw test
./mvnw spotless:apply            # before committing any Java

# end-to-end — 25 tests. Needs all three services running.
cd reelcms-vue-frontend
npm run test:e2e                 # everything
npm run test:public              # public site only
npm run test:admin               # studio only
npm run screenshots              # regenerate screenshots/
```

Nothing is stubbed in either suite. The behaviour worth testing here — `$inc` atomicity, `$lookup`
type matching, text-index ranking, change streams — only exists against a real MongoDB.

---

## Ports

Chosen so nothing collides with the other demos in this repo.

| Service | Port | |
|---|---|---|
| MongoDB | 27018 | `pizza` uses MySQL on 3308 |
| mongo-express | 8091 | optional, `--profile tools` |
| API | 8087 | `pizza` uses 8085 |
| Vue dev server | 5176 | 5173–5175 are taken by `pizza` and `stayhub` |

---

## What this demo is actually teaching

Every one of these is implemented, commented at the point it matters, and covered by a test.

### Embed or reference — the decision, both ways

A `reel` document holds its `video` (1:1, never read apart), its `tags` (bounded, queried), its
`stats` (atomic counters) and a **snapshot** of its creator. Its comments live in a separate
collection, because they grow without limit and would eventually blow the 16 MB document cap on your
most successful piece of content.

**The rule: embed what is bounded, reference what grows.**

### Denormalization, with the bill shown

Each reel carries a copy of its creator's name and avatar, so the feed renders with no `$lookup`.
Renaming a creator therefore has to rewrite that copy on every reel they own — `CreatorServiceImpl`
does it in one `updateMulti`, and the admin dialog tells you how many reels are about to be touched.
The trade is stated out loud rather than hidden.

### Aggregation pipelines

Every dashboard figure comes from a pipeline over real data — `$dateTrunc` day buckets, `$lookup`
joins, `$unwind` over an array field, `$group`/`$avg`. No hard-coded numbers anywhere.

### Time-series collections

`view_events` is a real time-series collection with a 90-day TTL, created with its options at
startup because a collection cannot be converted after the fact.

### Change streams

`ReelStatsStreamService` tails the oplog and republishes view-count changes to the dashboard over
SSE. This is why MongoDB runs as a replica set: a standalone `mongod` has no oplog.

### Indexes, and the ESR rule

All declared in one file, `MongoIndexConfig`, with the reasoning next to each. Includes a weighted
text index, a multikey index over `tags`, and compound indexes ordered Equality → Sort → Range.

### Cursor pagination

The feed pages by cursor, not `skip()`. At depth 4,000 `skip` makes the server walk and discard
4,000 documents; a cursor seeks straight into the index.

---

## Gotchas already paid for — do not rediscover these

Each is commented at the place it bites. Collected here because they cost real time.

- **`spring.mongodb.uri`, not `spring.data.mongodb.uri`.** Spring Boot 4 moved the connection
  properties. The old name is silently ignored and the driver falls back to `localhost:27017` — a
  connection refused against a port that appears nowhere in your config.
- **Never set `spring.mongodb.database` alongside a URI that already names one.** The standalone
  property wins, with no warning. That is how the integration tests once ran against the live
  database and deleted the demo content.
- **`$lookup` compares types strictly.** A `String reelId` is a BSON string; the `_id` it points at
  is an ObjectId. They never match, the join returns nothing, `$unwind` drops every row, and the
  report is an empty array with no error. `@Field(targetType = FieldType.OBJECT_ID)` fixes it.
- **A change stream needs `filter(Document...)`, not `filter(Aggregation)`.** The Aggregation form
  is field-mapped against the domain type, and `operationType` is a field of the change event, not
  of `Reel` — so the stream opens cleanly and delivers silence.
- **Change streams need `fullDocument: updateLookup`**, or the body of every update event is null.
- **Create the time-series collection before anything inserts into it.** `DataSeeder` is an
  `ApplicationRunner`, which fires *before* `ApplicationReadyEvent` — so index setup runs in
  `@PostConstruct`. Get the order wrong and Mongo auto-creates an ordinary collection that works
  fine and costs ten times the disk.
- **BSON stores dates at millisecond precision; `Instant.now()` has microseconds.** Stamp a field
  and save, and the in-memory value no longer equals the stored one. Everything routes through
  `Timestamps.now()`.
- **A replica set tells the driver where to reconnect.** The advertised `host:port` must be
  reachable under that exact spelling, which is why `docker-compose.yml` publishes 27018 → 27018.
- **A collection may have at most one text index.** It can cover many fields; you cannot add a
  second one later.
- **`@EnableMongoAuditing` is what makes `@CreatedDate` populate.** Without it the field stays null
  and nothing warns you.
- **Vue Router marks a link to an index child active whenever any sibling is** — so `/admin` and
  `/admin/reels` both highlight without an explicit exact-active class.
- **A 401 means two different things.** With a token it is an expired session; without one it is a
  failed login. Conflating them puts "your session expired" on the sign-in form.

---

## Layout

```
reelcms/
├── docker-compose.yml           MongoDB replica set + optional mongo-express
├── progress_report.md           shared context — read this first when resuming
├── CLAUDE.md                    standing instructions for this app
├── reelcms-springboot-backend/
│   └── src/main/java/com/reelcms/api/
│       ├── config/              Security · Mongo · indexes · CORS · OpenAPI · Timestamps
│       ├── dto/                 every DTO + the one mapper
│       ├── entity/              one package per document, everything for it together
│       ├── report/              the aggregation pipelines
│       ├── security/            JWT issue/verify + the filter
│       ├── storage/             uploads (the only class that touches the filesystem)
│       ├── stream/              the change stream → SSE bridge
│       └── seed/                demo data
└── reelcms-vue-frontend/
    └── src/
        ├── api/                 mock.js · http.js · the one-line switch between them
        ├── components/          public/ · admin/ · ui/
        ├── layouts/             PublicLayout · AdminLayout
        ├── views/               public/ · admin/
        └── utils/               formatting helpers
```
