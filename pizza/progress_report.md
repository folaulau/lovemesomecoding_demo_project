# Pizza demo app — progress report

Shared context for the pizza demo (React + Angular frontends, Spring Boot backend).
Read this first when resuming work.

**Status:** Phases 0–4 complete. The React app now runs entirely against the real API with Stripe
Elements. **46 backend tests + 12 e2e tests + 1 payment integration test, all green.**
**Last updated:** 2026-08-17

**Run the backend:** `cd pizza-springboot-backend && ./mvnw spring-boot:run` → http://localhost:8085
· Swagger UI at http://localhost:8085/swagger-ui.html

**Run the frontend:** `cd pizza-react-frontend && nvm use && npm run dev` → http://localhost:5173
· `npm run test:e2e` — Playwright suite (**needs the backend running**)
· `STRIPE_SECRET_KEY=sk_test_… npm run test:payment` — payment integration
· `npm run screenshots` — regenerate `screenshots/`

**Demo logins:** `admin@pizza.test` / `admin123` · `customer@pizza.test` / `pizza123`
(real JWT auth against the API — the frontend no longer mocks anything)

---

## Purpose

A minimal Pizza Hut-style ordering app that exists to produce **tutorial snippets** for
lovemesomecoding.com. Readability and teachability of the code outrank cleverness. Where a
"real" production choice and a "clear teaching example" choice conflict, prefer the teaching
one and add a code comment explaining what production would do differently.

---

## Scope

**In**
- Browse menu → build a pizza (size + crust + toppings) → add drinks → cart
- Checkout as guest **or** logged-in user
- Stripe payment (test mode), order confirmation
- `/admin`: CRUD for pizzas, drinks, toppings
- `/admin/reports`: revenue over time, top products, orders by status, headline totals

**Out (deliberately cut to keep it minimal)**
- Real delivery-vs-carryout routing, store locator, deals/coupons, loyalty
- Order tracking with real states, email receipts, password reset
- A "Delivery / Carryout" toggle is kept **visually** because it is iconic on pizzahut.com,
  but it only changes which form fields show — no logic behind it.

---

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Spring Boot version | **4.1.0** (kept as scaffolded) | User's call. Verified viable in Phase 0 — see findings. |
| Payment | **Stripe Elements, embedded** | User never leaves the SPA; same backend serves React and Angular identically. |
| React language | **TypeScript** | Clearer Context/reducer examples; matches Angular; industry standard. |
| Auth | **JWT bearer token** | Stateless, identical for both frontends, easy to demo in Swagger. |
| Database | **Local MySQL**, `root` / empty password | Per pizza/CLAUDE.md. No docker-compose. |
| Schema management | **Liquibase**, changesets written in **formatted SQL** | User's call (Flyway was considered and dropped). Hibernate runs `ddl-auto=validate` and never touches the schema. |
| Changelog layout | **XML manifest** + `includeAll` over `sql/*.sql` | Formatted SQL has no `include` directive, so the master must be XML/YAML. All *actual* changes stay in SQL. |
| Frontend styling | **Bootstrap 5.3.8** | User's call. `react-bootstrap` 2.10.10 for React, `@ng-bootstrap/ng-bootstrap` 21.0.0 for Angular. |
| Cart storage | **Browser only** (React Context + useReducer) | No cart table, no cart endpoints. Order rows created once, at checkout. |
| Pricing authority | **Server recomputes everything** | Client-sent prices are ignored. Deliberate teaching callout. |

---

## Phase 0 findings — stack verification (DONE)

Ran a throwaway spike in a scratchpad copy of the backend. The `pizza` database was left
clean afterwards (spike tables dropped).

### Boot 4.1.0 manages
Spring Framework **7.0.8** · Spring Security **7.1.0** · Hibernate **7.4.1** ·
Spring Data **2026.0.0** · MySQL connector **9.7.0**

### ✅ springdoc/Swagger works — the pre-spike concern was wrong
The worry was that springdoc's newest release (**2.8.6**) targets Spring Framework 6.2 while
Boot 4.1 ships Framework 7.0.8, and Boot 4's BOM manages **no** openapi version at all
(so the version must be pinned by hand). Tested anyway: it works completely.

- `/v3/api-docs` → 200, emits **OpenAPI 3.1.0**
- `/swagger-ui/index.html` → 200; `/swagger-ui.html` → 302 redirect
- Full introspection confirmed: paths, `@PathVariable` params, request bodies,
  Java `record` schemas, `@Tag`/`@Operation` metadata
- Still reachable once a Spring Security 7.1 filter chain is in place (needs the
  `/v3/api-docs/**` + `/swagger-ui/**` permitAll matchers)

**No Swagger fallback plan is needed.** Pin `springdoc.version` to `2.8.6` explicitly.

### ⚠️ Boot 4 GOTCHA — autoconfiguration is modularized
Depending on the plain migration library — which is **all Boot 3 needed** — gives you the library
with **no autoconfiguration**. The migration tool then silently never runs, and the failure
surfaces as a confusing *Hibernate* error:

```
SchemaManagementException: Schema validation: missing table [spike_product]
```

with **zero** migration lines in the log. Hit this for real during the spike. The fix is the new
starter:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-liquibase</artifactId>
</dependency>
```

Boot 4 has `spring-boot-starter-<x>` / `spring-boot-<x>` modules for liquibase, flyway, jpa,
hibernate, security, webmvc, etc. **Assume any Boot 3 "just add the library" habit is broken.**
This is good tutorial material in its own right.

### ✅ Liquibase with formatted-SQL changesets
Verified end to end against real MySQL. `DATABASECHANGELOG` recorded every changeset as
`EXECUTED`, and the seeded rows came back through JPA → MapStruct → JSON.

**Layout that was tested and works:**

```
src/main/resources/db/changelog/
├── db.changelog-master.xml      <- manifest ONLY, no changes in it
└── sql/
    ├── 001-schema.sql           <- --liquibase formatted sql
    └── 002-seed.sql
```

```xml
<includeAll path="db/changelog/sql" relativeToChangelogFile="false"/>
```

```properties
spring.liquibase.change-log=classpath:db/changelog/db.changelog-master.xml
spring.jpa.hibernate.ddl-auto=validate
```

Each SQL file starts with `--liquibase formatted sql` and marks changesets with
`--changeset author:id`, plus a `--rollback` line. `includeAll` orders files by filename, hence
the numeric prefixes.

**Caveat found:** formatted SQL has **no `include`/`includeAll` directive**, so the master
changelog cannot itself be `.sql` if you want multiple files. A single all-in-one `master.sql`
also works (tested) — but the XML-manifest layout above scales better and keeps every real
change in SQL.

Boot 4 also keeps **both** `spring-boot-starter-web` and `spring-boot-starter-webmvc`; the
scaffold used `webmvc`.

### ✅ Lombok + MapStruct + Java 21
Works with the processor path ordered `lombok` → `lombok-mapstruct-binding` → `mapstruct-processor`.
Verified the *generated* impl actually reads Lombok's getters (`entity.getName()`) rather than
silently mapping nothing — the classic failure when the order is wrong. MapStruct **1.6.3**.

### ✅ Spring Security 7.1
Lambda DSL config compiles and boots; secured path correctly returned 403. BCrypt encode/verify
round-trips. Note Security 7 removed the old non-lambda DSL entirely.

### ✅ MySQL
8.4.10 running locally, `root` + empty password connects over TCP 3306. `pizza` database exists
and is empty. Liquibase created `DATABASECHANGELOG` / `DATABASECHANGELOGLOCK` and applied all
changesets successfully. Spike objects were dropped afterwards — **the `pizza` DB is clean.**

### Other versions picked
`stripe-java` **29.2.0** · `springdoc` **2.8.6** · `mapstruct` **1.6.3** ·
`bootstrap` **5.3.8** · `react-bootstrap` **2.10.10** · `@ng-bootstrap/ng-bootstrap` **21.0.0**

### Environment note
Port **8099 is taken** by the lovemesomecoding FastAPI admin API. The pizza backend must not use
it. Also note the FastAPI app binds IPv4 `127.0.0.1` while Boot binds `*` on IPv6, so a naive
`curl localhost:8099` hits the *wrong* app and returns a misleading `{"detail":"Not Found"}`.
**Pizza backend port: 8080.** Frontend dev servers: React 5173 (Vite), Angular 4200.

---

## Secrets handling

Stripe **test-mode** keys were supplied. Rules:

- Keys live in `application-local.properties` (gitignored) or env vars — **never** committed.
- Only the **publishable** key (`pk_test_…`) reaches the React bundle, via `VITE_STRIPE_PK`.
- The **secret** key (`sk_test_…`) stays server-side only.
- ⚠️ The secret key was pasted into a chat transcript, so it should be treated as burned.
  **Roll it in the Stripe dashboard once the demo works.** Test mode = fake money only, so
  this is low urgency but not zero.

---

## Domain model (proposed)

```
Product      id, name, description, type=PIZZA|DRINK, imageUrl, active
ProductSize  product_id, size=SMALL|MEDIUM|LARGE, price
Topping      id, name, price, category=MEAT|VEGGIE|CHEESE, active
Crust        id, name, priceDelta

User         id, email, passwordHash, role=CUSTOMER|ADMIN
Order        id, user_id (nullable), guestEmail, status, subtotal, tax, total,
             stripePaymentIntentId, address fields, created_at
OrderItem    order_id, product_id, size, crust_id, quantity, unitPrice, lineTotal
OrderItemTopping   order_item_id, topping_id, price      -- price snapshotted at order time
```

Prices are snapshotted onto order rows so historical orders don't change when the menu is edited.

Per pizza/CLAUDE.md, each entity gets the full layout in one package:
`Product.java`, `ProductDAO`, `ProductDAOImpl`, `ProductRepository`, `ProductService`,
`ProductServiceImpl`, `ProductRestController`, plus DTO + MapStruct mapper.

---

## Payment flow

1. `POST /api/orders` → server prices the cart from the DB, saves order `PENDING_PAYMENT`,
   creates a Stripe PaymentIntent, returns `clientSecret`
2. React confirms the card via Stripe Elements — card data never touches our backend
3. `POST /api/webhooks/stripe` on `payment_intent.succeeded` → order becomes `PAID`
4. Confirmation page polls order status

Step 4 exists because webhooks don't reach localhost without `stripe listen`. That's an honest
limitation worth explaining in the tutorial rather than hiding.

---

## React features to showcase

| Feature | Where it earns its place |
|---|---|
| `createContext` + `useReducer` | `CartContext` — add/remove/qty/clear |
| Context #2 | `AuthContext` — token, user, login/logout |
| Custom hooks | `useCart()`, `useAuth()`, `useApi()` |
| `useMemo` / `useCallback` / `memo` | menu grid + live price calc in the builder |
| `lazy` + `Suspense` | admin bundle split out of the customer bundle |
| Error boundary | wraps routes |
| Portal (`createPortal`) | toast/notification host (Bootstrap owns the modal + drawer) |
| `useRef` / `forwardRef` | focus management in the builder form |
| React Router + protected route | `/admin`, `/orders` |

### Styling
**Bootstrap 5.3.8** via `react-bootstrap` components (`Navbar`, `Modal`, `Offcanvas`, `Card`,
`Form`, `Table`). Pizza Hut's look comes from a small custom theme layered on top — override
Bootstrap's SCSS variables for the red/black palette rather than fighting the defaults with
`!important`. Use `Offcanvas` for the cart drawer and `Modal` for the pizza builder, which
replaces the hand-rolled portal work originally planned — the `createPortal` example moves to a
toast/notification component so that teaching point survives.

---

## Plan

| Phase | Contents | Status |
|---|---|---|
| **0** | Verify stack: springdoc, Security 7, Lombok+MapStruct, MySQL, Liquibase | ✅ **done** |
| **1** | Real pom, Liquibase schema + seed changesets, entities/JPA layer | ✅ **done** |
| **2** | React frontend on **mock data** — full Pizza Hut look, cart Context, builder modal, checkout UI | ✅ **done** |
| **3** | Backend endpoints: catalog, JWT auth, orders, Stripe, admin CRUD, reports | ✅ **done** |
| **4** | Integrate React → real API; wire Stripe Elements | ✅ **done** |
| **5** | Admin dashboard + reports UI (Recharts) | todo |
| **6** | QA: tests to ~90%, Playwright demo, `spotless apply` | todo |
| **7** | Angular frontend against the same API | todo |

Phase 2 precedes Phase 3 per the standard workflow (frontend first, on mock data).

### Seed data
Liquibase seed changesets with ~8 pizzas, ~6 drinks, ~12 toppings, 3 crusts, one admin user, and a
few weeks of **backdated orders** — the reports dashboard looks dead without history, and
hand-clicking orders to populate it wastes time. Kept in their own SQL file
(`002-seed-menu.sql`, `003-seed-orders.sql`) so schema and demo data stay separable.

---

## Phase 1 findings — schema + JPA layer (DONE)

Boots clean on **port 8085**, 19 Liquibase changesets applied, Hibernate `ddl-auto=validate` passes
(so the entities and the SQL schema provably agree), Swagger UI live, **14/14 tests green**,
`spotless apply` run over all Java.

Seeded: 14 products (8 pizzas + 6 drinks) · 42 size/price rows · 4 crusts · 12 toppings ·
2 users · 18 backdated orders · 27 order items · 9 item toppings. Verified in SQL that
`subtotal == SUM(line_total)` and `total == subtotal + tax + delivery_fee` for **all 18** orders.

### ⚠️ Gotcha — MultipleBagFetchException
The obvious entity graph is wrong:

```java
@EntityGraph(attributePaths = {"items", "items.toppings"})   // throws at query time
```

Hibernate refuses to join-fetch two `List` collections at once —
`MultipleBagFetchException: cannot simultaneously fetch multiple bags`. A `List` (a "bag") has to
preserve duplicates, so Hibernate cannot de-duplicate the cartesian product the way it can for a
`Set`. This was caught by the tests, not by inspection.

Fix used: fetch **one** collection in the graph, put `@BatchSize(25)` on
`OrderItem.toppings`, and initialise it in a second step inside
`CustomerOrderDAOImpl.findByIdWithItems`. Switching one side to `Set` also works, but changes
ordering semantics.

### Port note
**8085**, because on this machine 8080 is held by another Java app and 8099 by the lovemesomecoding
FastAPI admin API. A Boot app binds `*:port` on IPv6 while some servers bind `127.0.0.1` on IPv4,
so a clashing `curl localhost:PORT` can silently hit the *other* app — that cost real time twice.

### What exists now
```
com.pizza.api
├── config    SecurityConfig (Security 7 lambda DSL, CORS, BCrypt), OpenApiConfig
├── product   Product, ProductSize, ProductType, SizeName, Repository, DAO, DAOImpl
├── topping   Topping, ToppingCategory, Repository, DAO, DAOImpl
├── crust     Crust, Repository, DAO, DAOImpl
├── user      User, UserRole, Repository, DAO, DAOImpl
└── order     CustomerOrder, OrderItem, OrderItemTopping, OrderStatus, OrderType,
              Repository, DAO, DAOImpl
```

Services, MapStruct mappers, DTOs and REST controllers are **not** written yet — those are Phase 3.
`SecurityConfig` currently permits everything so the app is usable; the JWT filter and the
`/api/admin/**` role check are marked with a TODO in that file.

---

## Phase 2 findings — React on mock data (DONE)

Vite 8 + React 19.2 + TypeScript 6 + Bootstrap 5.3.8 / react-bootstrap 2.10.10 + React Router 7.
Production build clean, **9/9 Playwright e2e tests green**, screenshots in `pizza-react-frontend/screenshots/`.

Everything runs on `MOCK_MENU` in `src/mocks/menu.ts`, whose values match the Liquibase seed
exactly — so Phase 4's swap to real API calls should change nothing on screen. `src/types/index.ts`
is the shared contract; if the API DTOs drift from it, the build fails rather than the UI.

### ⚠️ Node 22.12+ required — `.nvmrc` added
Vite 8 depends on rolldown, whose native binding declares `engines: node >=22.12`. On Node 22.5.1
npm **silently skips** the optional native dependency and the dev server dies with a misleading
`Cannot find native binding … npm has a bug related to optional dependencies`. A clean reinstall
does not fix it — the Node version is the actual cause.

Resolved by `nvm install 22` (→ **v22.23.2**) plus a `.nvmrc`. Note the machine's `default` nvm
alias was the floating `22`, so it now resolves to 22.23.2 instead of 22.5.1.
`nvm alias default 22.5.1` pins it back if that is unwanted.

### Gotcha — `<Button as={Link}>` does not typecheck
react-bootstrap 2.x types `Button`'s `as` prop against intrinsic elements, so passing React
Router's `Link` fails. Casting it to `never` "fixes" the error and then poisons the `to` prop.
The clean answer is a plain `<Link className="btn btn-primary">` — identical markup and styling,
no casts, and semantically better (it navigates, so it should be an anchor).

### Gotcha — screenshots catch CSS transitions mid-flight
The first captured build looked like the wrong size button was selected. It was not: computed
styles showed the selected control at `rgba(216,16,42,0.008)` and the previous one at `0.992` —
Bootstrap's 0.15s background transition, frozen mid-fade. Always settle transitions before
capturing (`page.mouse.move` away + `waitForTimeout`) or screenshots will lie.

### Fixed during QA
The toast portal was anchored `bottom-end` and covered the cart drawer's Checkout button. Moved
to `top-end`, `zIndex: 1100` so it clears Bootstrap's offcanvas (1045) and modal (1055).

### Where each React concept lives
| Concept | File |
|---|---|
| `createContext` + `useReducer` | `context/CartContext.tsx` |
| Second context, `localStorage` sync, lazy `useState` init | `context/AuthContext.tsx` |
| `createPortal` | `context/ToastContext.tsx` |
| `React.memo` (+ why `useCallback` is required for it) | `components/ProductCard.tsx`, `pages/MenuPage.tsx` |
| `useMemo` for derived live pricing | `components/PizzaBuilderModal.tsx` |
| `useId`, `useRef` (React 19 ref-as-prop) | `components/PizzaBuilderModal.tsx`, `pages/CheckoutPage.tsx` |
| Error boundary (the last required class component) | `components/ErrorBoundary.tsx` |
| `lazy` + `Suspense` code splitting | `App.tsx` → `pages/admin/AdminDashboardPage.tsx` |
| Guarded routes, `useSearchParams` as state | `components/ProtectedRoute.tsx`, `pages/MenuPage.tsx` |

Code splitting is verified, not assumed: the build emits a separate
`AdminDashboardPage-*.js` chunk.

---

## Phase 3 findings — the real API (DONE)

**39/39 backend tests green.** Verified live against MySQL *and* against Stripe's test API, not
just in unit tests.

### Endpoints
| Method | Path | Access |
|---|---|---|
| GET | `/api/products`, `/api/toppings`, `/api/crusts` | public |
| POST | `/api/auth/register`, `/api/auth/login` | public |
| GET | `/api/auth/me` | authenticated |
| POST | `/api/orders` | **public — this is guest checkout** |
| GET | `/api/orders/{id}`, `/api/orders/{id}/payment-status` | public |
| GET | `/api/orders/mine` | authenticated |
| POST | `/api/webhooks/stripe` | public, protected by signature |
| * | `/api/admin/products\|toppings\|crusts\|orders` | ADMIN |
| GET | `/api/admin/reports/dashboard?days=30` | ADMIN |

### Verified by hand against the running app
- Guest order — Large Pepperoni + Stuffed Crust + Bacon + Extra Cheese → unit **22.99**,
  tax **1.95**, delivery **3.99**, total **28.93**, exactly as predicted from the menu.
- Stripe received **2893 cents**, currency usd, `metadata.orderId=19`, receipt email set.
- **Price tampering ignored:** a request claiming `"total":0.01` with `"unitPrice":0.01` was
  charged **18.43**. The price fields are not on the request record, so Jackson discards them and
  `PricingService` reads every figure from the database.
- Reports cross-check against the Phase 1 SQL: 357.40 + 27.02 + 40.86 = **425.28** ✓
- Admin endpoints: 403 anonymous, 403 with a CUSTOMER token, 200 with an ADMIN token.
- Registration cannot self-promote: posting `"role":"ADMIN"` still creates a CUSTOMER.

### ⚠️ Boot 4 GOTCHA #2 — test autoconfiguration moved too
`AutoConfigureMockMvc` is no longer at
`org.springframework.boot.test.autoconfigure.web.servlet` — in Boot 4 it is
**`org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc`**
(in `spring-boot-webmvc-test`). Same modularization as the Liquibase starter in Phase 0.
`@MockitoBean` is unchanged at `org.springframework.test.context.bean.override.mockito`.

Also: **no plain `ObjectMapper` bean is available to autowire** in the test context under Boot 4,
even though Jackson serializes responses fine. Constructing one in the test avoids depending on
the auto-configuration shape.

### Gotcha — interface projections do not coerce types
The MySQL driver returns a `DATE` column as `java.time.LocalDate`. Declaring
`java.sql.Date getDay()` compiles and then fails at runtime with
*"Cannot project java.time.LocalDate to java.sql.Date"*. Projection getters must match what the
driver actually returns. (The `GlobalExceptionHandler` did its job here — the client got a clean
500 envelope with no stack trace.)

### Deliberate design notes
- **`PricingService` is the security boundary.** `CreateOrderRequest` has no price fields at all,
  so there is nothing to tamper with; every figure is read from `product_size`, `crust`, `topping`.
- Order rows snapshot `product_name`, `crust_name`, `unit_price` and topping prices, so editing the
  menu never rewrites history. Reports group by the snapshotted name for the same reason.
- Reports aggregate in **SQL**, not by loading orders into memory.
- `markPaid` is idempotent — Stripe delivers webhooks more than once.
- The webhook verifies the `Stripe-Signature` header. Without that check the endpoint would be an
  open "mark my order paid" API.
- Login failures are deliberately vague so the response cannot be used to enumerate accounts.

### ⚠️ Known limitation, called out rather than hidden
`GET /api/orders/{id}` is public so a guest can see their confirmation page without an account.
Ids are sequential, so anyone could walk them and read other people's orders. A production system
would use an unguessable reference (UUID) or a signed link. Noted in `SecurityConfig`.

---

## UUID public identifiers + audit timestamps (DONE)

**Decisions:** keep the BIGINT primary key for internal FKs; add a `public_id` **CHAR(36)** UUID
that is the *only* identifier the API exposes. Every table also gains `created_at` / `updated_at`.

Added additively as changesets 004–005 rather than by editing 001 — editing an applied changeset
breaks Liquibase's recorded checksum.

- Existing rows backfilled **deterministically** from their numeric id
  (`aaaaaaaa-0000-4000-8000-000000000001`), so seeded demo data has stable, greppable UUIDs that
  tests and frontend mocks can hard-code. `TestIds` in the test sources is the shared fixture.
- Rows created at runtime get a real random UUID from `@PrePersist`.
- This **closes the enumeration limitation** flagged in Phase 3: `/api/orders/{uuid}` can no longer
  be walked.

### Gotcha — Hibernate stores UUID as BINARY(16) by default
`@JdbcTypeCode(SqlTypes.CHAR)` is load-bearing. Without it a `java.util.UUID` maps to BINARY(16),
which does not match the CHAR(36) column, and `ddl-auto=validate` refuses to start.

### Gotcha — interface projections do not coerce types
The MySQL driver returns a `DATE` column as `java.time.LocalDate`. Declaring `java.sql.Date`
compiles and then fails at runtime with *"Cannot project java.time.LocalDate to java.sql.Date"*.

### Bug found and fixed — malformed UUID returned 500
Switching ids to UUID meant `"productId":"not-a-uuid"` threw a Jackson parse error that fell
through to the catch-all handler. Bad input must be 4xx. `RestExceptionHandler` now handles
`HttpMessageNotReadableException` and `MethodArgumentTypeMismatchException` → 400.

### ⚠️ Bug found and fixed — every timestamp was silently shifted
A row stored as `2026-01-01 00:00:00` came back from the API as `2025-12-31T17:00:00`.

Cause: `serverTimezone=UTC` on the JDBC URL (plus `hibernate.jdbc.time_zone=UTC`) makes the MySQL
driver convert DATETIME values between zones. Every timestamp column maps to
**`LocalDateTime`, which has no zone**, so any conversion is silent corruption.

Fix: `connectionTimeZone=LOCAL&preserveInstants=false` on the URL, and the Hibernate property
removed. Guarded by a regression test asserting the seeded value reads back byte-for-byte. Use
`Instant`/`OffsetDateTime` if zone-aware storage is ever genuinely needed.

---

## Backend restyled to match trademachine (DONE)

Patterned after `/Users/folaukaveinga/Github/trademachine` (backend only). **46/46 tests green.**

| Aspect | Now |
|---|---|
| Packages | `com.pizza.api.entity.<domain>` — entity + DAO + DAOImp + Repository + Service + ServiceImpl + RestController in one package |
| DAO impl | `ProductDAOImp` (matches trademachine, and pizza/CLAUDE.md's spelling) |
| DTOs | central `com.pizza.api.dto` + one `EntityDTOMapper` with `mapXToY` methods |
| Entities | `@Data @Builder @AllArgsConstructor @NoArgsConstructor`, `implements Serializable`, `@JsonInclude(NON_NULL)`, `@DynamicUpdate`, `@SQLRestriction("deleted = false")` |
| Timestamps | `@CreationTimestamp` / `@UpdateTimestamp` (Hibernate), replacing the `BaseEntity` `@PrePersist` |
| Table names | `DatabaseTableNames` constants; indexes declared in `@Table` |
| Exceptions | `exception/` — `ApiError`, `ApiSubError`, `ApiException`, `RestExceptionHandler` |
| Injection / logging | `@Autowired` fields, `@Slf4j` |
| Controllers | return `ResponseEntity<>`, log each request |

`BaseEntity` was **removed** — trademachine declares the common fields on each entity, so the four
shared columns are now repeated per entity by design.

### ⚠️ Landmine handled — `@Data` on bidirectional JPA entities
Lombok's `@Data` generates `equals`/`hashCode`/`toString` over **every** field. On a bidirectional
relationship that means `Product.toString()` walks its sizes, each of which walks back to the
product — infinite recursion, plus a forced lazy load on every call. trademachine's `Stock` has no
parent back-reference so it never hits this; pizza has four.

Every back-reference and owned collection therefore carries `@ToString.Exclude` and
`@EqualsAndHashCode.Exclude`. Verified live: fetching a full order graph (order → items →
toppings) serialises correctly.

### Soft delete
`deleted` added to all 8 tables (changeset 006) **alongside** `active`, because they mean different
things: `active` = temporarily off the menu but still editable in admin; `deleted` = gone, and
filtered out of every query by `@SQLRestriction`. Rows are never physically removed — historical
orders reference them.

### API contract change
The error envelope is now trademachine's shape. Field errors moved from a `fieldErrors` map to an
`errors` array of `{field, message}`:

```json
{"statusCode":400,"error":"Bad Request","message":"Validation failed",
 "errors":[{"field":"items","message":"An order needs at least one item"}],
 "path":"/api/orders","timestamp":"..."}
```

### Deviation from trademachine, deliberate
One `XCreateDTO` per entity serves both create and update, since the shapes are identical.
trademachine splits `StockCreateDTO` / `StockUpdateDTO`; split these too the moment they diverge.

---

## Phase 4 findings — React wired to the real API + Stripe (DONE)

`src/mocks/` is **deleted**. Nothing in the app is mocked any more: every screen reads from the
API. **12/12 e2e tests** pass against the running backend, plus a separate payment integration test.

### What was added
| File | Purpose |
|---|---|
| `lib/api.ts` | the only place that calls `fetch` — base URL, bearer token, `ApiError` with field errors |
| `lib/stripe.ts` | `loadStripe` at module level (calling it in a component reloads Stripe.js every render) |
| `context/MenuContext.tsx` | loads products/toppings/crusts once, with `AbortController` cleanup |
| `components/StripePaymentForm.tsx` | `PaymentElement` + `confirmPayment` |
| `types/index.ts` | every id is now a `UUID` string alias |

### Checkout is two steps, necessarily
`POST /api/orders` must happen **before** the card form can render, because Elements confirms a
PaymentIntent that does not exist until the order does. So: collect details → create order (server
prices it) → render Elements against the returned `clientSecret` → confirm the card.

The summary switches to the **server's** figures the moment the order exists — the browser's
arithmetic is only ever a preview.

### Fixed — refreshing on /admin logged you out
`ProtectedRoute` decided before the stored token had been checked against `/api/auth/me`, so a
valid admin got one frame of `isAuthenticated === false` and was redirected to login.
`AuthContext` now exposes `initialising`, and the guard waits for it.

### ⚠️ Stripe's card iframe cannot be automated
The card fields never mount under headless Playwright: Stripe serves `elements-inner-loader-ui`
plus **hCaptcha** frames and its bot detection stops there. Retrying would produce a slow, flaky
test failing for reasons unrelated to our code.

Split instead, so everything we own is still covered:
- `order-flow.spec.ts` — Elements mounts and the Pay button shows the server-calculated total.
- `payment.spec.ts` — order created → PaymentIntent confirmed via Stripe's API with
  `pm_card_visa` → **our** `/payment-status` returns `PAID`. Skips cleanly without
  `STRIPE_SECRET_KEY`.

Verified end to end: order `PENDING_PAYMENT` → Stripe `succeeded`, amount **1843 cents** →
our API reports `PAID`, total `18.43`.

### Payment status is never asserted by the browser
The confirmation page polls `/api/orders/{uuid}/payment-status`, which asks **Stripe** and updates
our record. The client never tells the server an order is paid — anyone can call our API.

---

## Open questions

- None blocking. Next is Phase 5 (admin CRUD + charted reports), then Phase 6 QA, then Phase 7
  (Angular against the same API).
- The admin dashboard currently reads real data but is **read-only**; product CRUD endpoints exist
  on the backend and are untouched by the UI.
