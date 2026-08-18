# Pizza demo app — progress report

Shared context for the pizza demo (React + Angular frontends, Spring Boot backend).
Read this first when resuming work.

**Status:** Phases 0–6 complete, plus server-side carts, customer profiles (addresses + saved
cards), a checkout address chooser, admin user management, a full reports data audit, and Redux
on the admin side.
**60 backend tests + 92 Playwright tests, all green.**
**Last updated:** 2026-08-18

**Run the backing services:** `cd pizza-springboot-backend && docker compose up -d` → MySQL on
**3308** · add `--profile search|messaging|mail|all` for the optional ones

**Run the backend:** `cd pizza-springboot-backend && ./mvnw spring-boot:run` → http://localhost:8085
· Swagger UI at http://localhost:8085/swagger-ui.html
· against the containers instead of a native MySQL: `-Dspring-boot.run.profiles=local,docker`

**Run the frontend:** `cd pizza-react-frontend && nvm use && npm run dev` → http://localhost:5173
· `npm run test:all` — **the whole suite, 92 tests** (this is the one to run)
· `npm run test:e2e` — customer flows · `npm run test:admin` — admin CRUD + reports
  (**all of these need the backend running**)
· `STRIPE_SECRET_KEY=sk_test_… npm run test:payment` — payment integration
· `npm run screenshots` — regenerate `screenshots/`

**Run the backend tests:** `cd pizza-springboot-backend && ./mvnw test` — 60 tests, needs MySQL
· `./mvnw spotless:apply` before committing Java

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
| Cart storage | **Browser only** (React Context + useReducer) | No cart table, no cart endpoints. Order rows created once, at checkout. ⚠️ **Later reversed** — see "Server-side carts". |
| Pricing authority | **Server recomputes everything** | Client-sent prices are ignored. Deliberate teaching callout. |
| Admin state | **Redux Toolkit**; customer pages stay on **Context** | User's call. The split is enforced by the tree — `<Provider>` wraps only the lazy admin route — so Redux never ships to customers. |
| DAO backing | **Repository + JdbcTemplate in the same DAO impl** | Patterned on trademachine's `BalanceDAOImpl`. Repository for saves and single-row lookups; `JdbcTemplate` for anything that aggregates. See "Reports data audit". |

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
| **5** | Admin dashboard + reports UI (Recharts) | ✅ **done** |
| **6** | QA: tests to ~90%, Playwright demo, `spotless apply` | ✅ **done** |
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

## Phase 5 findings — admin CRUD + reports dashboard (DONE)

`/admin` is now a **layout route** with five tabs: Reports · Products · Toppings · Crusts · Orders.
Guarding the PARENT route means every tab inherits the ADMIN check — a new tab cannot be added
unprotected by accident.

Full CRUD for products (incl. per-size prices), toppings and crusts; order status transitions;
a time-ranged reports dashboard (7 / 30 / 90 days).

### ⚠️ BUG FOUND AND FIXED — every product edit returned a 500
Updating a product used to `clear()` its sizes and re-add them. Hibernate schedules the INSERTs
**before** the DELETEs in one flush, so the new rows collided with the old ones:

```
Duplicate entry '42-SMALL' for key 'uk_product_size'
```

Fixed by reconciling in place (`mergeSizes`) instead of delete-and-recreate. A flush between the
two would also have worked, but merging is better for a second reason: **size rows now carry a
public UUID**, and recreating them would mint new ids, so editing a price would silently
invalidate identifiers already handed out. Guarded by `ProductServiceImplTest`.

### ⚠️ The IDE was serving stale classes
While debugging the above, the API kept returning
`java.lang.Error: Unresolved compilation problem` even though `./mvnw compile` said BUILD SUCCESS.
The IDE had a stale index from the `common` → `exception` package move and was compiling broken
classes into `target/classes`, which `spring-boot:run` then loaded. **`./mvnw clean compile` before
running** if the API misbehaves in a way the source cannot explain.

### Charts — decisions, and why
Recharts, lazy-loaded. Code splitting pays for itself here: the 379 KB reports chunk is downloaded
only by admins, never by customers.

- **Headline numbers are stat tiles, not a chart.** Four unrelated values are read fastest as text.
- **One y-axis, never two.** Orders and revenue are both available; plotting them on a dual axis
  invents correlations, so order count rides along in the tooltip instead.
- **One series per chart, so no legend** — the title names it, and the categories are labelled on
  the axis. Colouring each bar differently would be decoration, not information.
- **`type="linear"`, not a smoothed curve.** These are DAILY totals; a spline would draw revenue
  values between days that never existed.
- **Orders-by-status is a table with inline bars**, not a pie — five labelled counts read more
  precisely as numbers, and it doubles as the accessible view.
- The brand red `#d8102a` was run through the palette validator against the chart surface before
  use (lightness band, chroma floor, ≥3:1 contrast — all pass). The app is deliberately light-only,
  so there is no dark step to validate.

### Gotcha — charts looked empty in screenshots
The marks were rendered correctly (valid path data, computed fill `rgb(216,16,42)`) but invisible
in `fullPage` captures: a full-page screenshot resizes the viewport, `ResponsiveContainer`
re-measures, and Recharts restarts its animation from zero. Set `isAnimationActive={false}` — which
is right for a dashboard anyway, since re-animating on every filter change is noise.

### Test isolation
The Playwright suite is **serial** (`fullyParallel: false, workers: 1`). These are integration
tests against one backend and one database; parallel workers had admin tests creating products
while menu tests were counting them ("expected 14, received 15").

Separately, a failed admin test used to leave its product behind and break an unrelated test on
every later run. `admin.spec.ts` now has an `afterEach` that deletes anything named `E2E *`, so a
failure cannot poison the next run.

---

## Phase 6 — UI test sweep (DONE)

Every flow is now driven through the browser. **92 Playwright tests**, split by concern:

| Spec | Covers |
|---|---|
| `browse.spec.ts` | home, CTAs, menu tabs, navbar filters, builder pricing, drink-vs-pizza steps |
| `cart.spec.ts` | badge, toast portal, line merging, quantities, totals, **persistence** |
| `auth.spec.ts` | sign in/out, registration, session restore, route guards, admin visibility |
| `checkout.spec.ts` | empty cart, validation, carryout, guest vs signed-in, server pricing |
| `orders-and-misc.spec.ts` | history, confirmation, 404s, footer, API-down recovery |
| `profile.spec.ts` | addresses CRUD, primary switching, saved cards, checkout chooser |
| `admin.spec.ts` | reports, product/topping/crust CRUD, order status, deactivation |
| `api-guards.spec.ts` | the two guarantees not observable through the UI |
| `payment.spec.ts` | order → Stripe charge → PAID (skips without `STRIPE_SECRET_KEY`) |
| `screenshots.spec.ts` / `admin-screens.spec.ts` | capture-only, excluded from `test:all` |

`admin.spec.ts` also covers the users tab: listing with activity counts, promote/demote, delete,
the self-target refusals, and a customer being denied the tab entirely.

⚠️ `npm run test:e2e` names its specs explicitly and had **silently omitted `profile.spec.ts`** —
addresses and saved cards were only ever exercised by a full `playwright test`. Added. An
allow-list of specs is a standing hazard: a new spec is not run until someone remembers to list it.
`npm run test:all` is grep-invert based and does not have this problem.

### ⚠️ A test that was passing for the wrong reason
`getByRole('link', { name: 'Pizzas' })` had been clicking the **navbar**, not the menu tab —
react-bootstrap renders `Nav.Link` as an anchor with `role="button"`, and the navbar happens to
contain real links with the same labels. The menu tabs had never been exercised. Both are now
covered, and the tab locator is scoped to `.nav-tabs`.

Other locator traps worth knowing, all hit for real here: `"Pepsi"` matches `"Diet Pepsi"`;
`"Total"` matches `"Subtotal"`; `"primary"` matches `"Make primary"`. Use `exact: true`.

---

## Server-side carts (DONE)

**This reverses the Phase 2 decision** that the cart lives only in the browser. Refreshing a page
no longer loses the basket.

- `cart` / `cart_item` / `cart_item_topping` (changeset 007). Only the cart's **UUID** is kept in
  localStorage; the contents live in the database.
- **The cart stores identifiers, never prices.** Every figure is recomputed from the current
  catalogue on each read, by the same rules the checkout uses — so one source of pricing truth, and
  a cart left overnight picks up today's menu instead of quietly honouring yesterday's. (Contrast
  `order_item`, which *does* snapshot prices: an order is a record of what someone actually paid.)
- `PUT /api/carts/{id}` replaces the whole cart — idempotent, and far simpler to reason about than
  a stream of deltas that can arrive out of order.
- `CartContext` hydrates on mount and persists on change (debounced 300 ms). It never writes before
  hydrating, which would overwrite the saved cart with an empty one.
- Public, like guest checkout: the unguessable UUID is the credential.

Covered by tests for refresh, second tab, quantity changes, delivery/carryout, emptying, and a
stale cart id being discarded rather than breaking the page.

---

## Customer profile — addresses and payment methods (DONE)

New `/profile` page (linked from the account menu), plus `/api/me/**`.

### Addresses
Multiple per user, exactly one **primary**. Checkout shows a chooser preselected to the primary,
with "Use a different address" revealing the manual fields. Guests see no chooser at all.

The "exactly one primary" invariant is enforced in the service — MySQL cannot express "at most one
true per user" as a constraint. Deleting the primary promotes the next survivor, so a customer can
never end up with saved addresses and nothing selected.

### ⚠️ Payment methods — what is deliberately NOT stored
**No card number, no CVC, no cardholder name.** Storing a PAN drags the app into PCI-DSS scope and
is unnecessary. What is stored:

- `stripe_payment_method_id` — an opaque `pm_…` token, useless without our secret key
- `brand` / `last4` / expiry — **display metadata Stripe itself returns**, so a customer can
  recognise "Visa ending 4242"

Cards are collected by Stripe Elements against a **SetupIntent** (store without charging) and never
pass through this API. Deleting a card also detaches it at Stripe — otherwise the row would vanish
while the card stayed chargeable.

`/api/me/**` takes no user id: the owner comes from the verified token, which removes a whole class
of "read someone else's data" bug by construction. An address belonging to another account returns
**404, not 403** — a 403 would confirm the id is real.

---

## Order receipt details + checkout order-type (DONE)

The confirmation page now shows **where it is going** and **what paid for it**, and the
delivery/pickup choice is available on the checkout page itself rather than only in the cart
drawer (it changes the price and which fields are required, so making the customer go back was
needless friction).

`customer_order` gained `card_brand` / `card_last4` (changeset 009), captured from Stripe when the
payment succeeds — via both the polling path and the webhook. Same rule as saved cards: **display
metadata only**, no token, no card number. An order needs to say which card was used, never to be
able to charge it again.

### ⚠️ Not every payment method is a card
The first implementation silently recorded nothing, and the reason was not a bug in our code:
Stripe Elements also offers **wallets** — Link, Cash App Pay, Klarna — and those have no `card`
object at all, neither on the PaymentMethod nor on the Charge. Verified directly against Stripe's
API for a real Link payment: `payment_method.card` and `payment_method_details.card` are both null.

So the capture falls back to the payment method's **type**, and the UI shows "Link" instead of
inventing a last4 Stripe never gave us. A genuine card still reads "Visa ending 4242".

### Note on spring-boot-devtools
Devtools was added to the pom mid-session. Its auto-restart fires while an external
`./mvnw compile` is still writing classes, and it failed with
`NoClassDefFoundError: CustomerOrder$CustomerOrderBuilder` (a Lombok-generated nested class).
Worse, the app kept serving **stale code**, which sent two debugging sessions down blind alleys.
If behaviour does not match the source: stop the app, `./mvnw clean compile`, start again.

---

## Admin user management + footer demo sign-ins (DONE)

`/admin/users` lists every account with its role, order count, saved addresses and saved cards.
Roles can be changed and accounts soft-deleted.

### An admin cannot demote or delete themselves
With a single administrator — the normal case for a small system — either action locks the last
admin out of their own back office with no route back in through the UI. `refuseSelfTarget` rejects
both with a 400, and the UI disables the controls on your own row so the failure is visible before
you click. Refusing is far kinder than a support ticket and a SQL console.

Deleting a user is a **soft** delete, like everything else here: past orders reference the row and
an order must keep reading correctly long after the customer has gone.

### Footer demo sign-ins
Both demo logins are printed in a collapsed `<details>` panel in the footer, on every page.

Putting credentials on a page is normally indefensible. It is acceptable **here and only here**
because these are seeded fixtures in a throwaway local database — the same pair the login page
already prints, unlocking nothing that exists off this machine. `Footer.tsx` carries a comment
saying so, and saying that this block is the first thing to delete if the app is ever pointed at
real data.

Built on native `<details>`/`<summary>` rather than a JS accordion — the browser supplies the
open/close behaviour, keyboard support and screen-reader semantics for free.

### Gotcha — the footer broke three unrelated tests
Printing `admin@pizza.test` and `customer@pizza.test` on **every** page made previously-unique text
locators match twice. Tests that asserted on those strings had to be scoped (`getByRole('main')`).
Worth remembering: adding a global element can break tests that never mentioned it.

---

## Reports data audit — soft-delete bug + DAO/JdbcTemplate refactor (DONE)

Triggered by "make sure all reports in the admin use real data from the database". They do — but
auditing properly turned up a real bug and an N+1.

### Verification method
Not "the code looks right": every figure the dashboard renders was cross-checked against SQL
written independently against the same database.

| | API | SQL |
|---|---|---|
| orders (30d) | 22 | 22 |
| revenue | 575.13 | 575.13 |
| average order | 26.14 | 26.14 |
| items sold | 40 | 40 |

Admin user counts reconcile the same way. Nothing in the admin frontend is mocked — the only
literal arrays are UI constants (`TABS`, `RANGES`).

### ⚠️ BUG FOUND AND FIXED — reports counted soft-deleted orders as revenue
The reporting queries were native SQL, and **native SQL bypasses `@SQLRestriction`**. Hibernate
applies that annotation when it builds a query *from the entity model*; SQL written by hand never
goes near the entity model. So every soft-deleted order still counted toward revenue.

Proven rather than inferred: soft-deleting a $28.91 order left reported revenue unchanged at
575.13 instead of dropping to 546.22. All five queries now filter `deleted = 0`, and the same probe
now yields exactly 546.22.

This is the dangerous kind of bug — **the totals stay entirely plausible, just wrong**, which is
precisely why nobody noticed. `ReportServiceImplTest.softDeletedOrdersAreExcluded` fails if a
predicate ever goes missing again.

### Reporting moved from a repository to a JdbcTemplate DAO
`ReportRepository` (four `@Query(nativeQuery = true)` methods) and `ReportProjections` are **gone**,
replaced by `ReportDAO` / `ReportDAOImp` using `NamedParameterJdbcTemplate` with `"""` text blocks.

JPA's job is to map rows onto an object graph and track changes to it. Reporting wants neither:
there is no entity to load, no identity map to populate, nothing to dirty-check. The old shape sent
real SQL through a persistence layer that added nothing to it and returned interface projections
Spring had to build proxies for. `ReportServiceImpl` collapsed to pure orchestration, since the DAO
now returns the response records directly.

### ⚠️ Second bug — the admin user list was 1 + 3N queries
`AdminUserServiceImpl.toDto` ran, *per user*, an order count plus full loads of the address and
payment-method lists just to call `.size()` on them — materialising entities nobody read a field of.

`UserDAOImp` now answers the whole page in **one** query. It is the reference example of the DAO
pattern from `pizza/CLAUDE.md`: `UserRepository` for saves and single-row lookups, and
`NamedParameterJdbcTemplate` for the one query that aggregates across three tables.

**Scalar subqueries, not `LEFT JOIN … GROUP BY`** — joining three one-to-many tables at once
multiplies the rows together, so a user with 2 addresses and 3 cards would report 6 of each. That
bug is subtle, plausible-looking and very common.

### Deviations worth knowing
- **`NamedParameterJdbcTemplate`, not the plain `JdbcTemplate`** trademachine's `BalanceDAOImpl`
  uses. The summary query mentions `:from` twice; positional `?` there is an ordering trap. It
  wraps a `JdbcTemplate`, so the pattern is otherwise identical.
- `getObject(col, LocalDate.class)`, never `getDate` — the latter drags the JVM default timezone
  into a value that has no time in it, the same class of bug as the seven-hour timestamp shift.
- **Two `@Query` methods deliberately stay on their repositories.**
  `ProductRepository.findAllWithSizes` and `CustomerOrderRepository.findInRange` return *entities*
  with `@EntityGraph`. Hand-assembling those collections through `JdbcTemplate` would be more code
  that does less, and would give up dirty-checking. The rule is "JdbcTemplate for custom queries,
  repository for simple things" — an entity load is a simple thing.

### Gotcha — a running IDE instance masks the fix
The IntelliJ-launched app stayed pinned to pre-refactor classes and kept serving the **old**
behaviour after `./mvnw clean test` rewrote `target/classes`. The soft-delete probe was what
exposed it; the dashboard numbers alone were identical either way and proved nothing. Same family
as the devtools note above: **if behaviour does not match the source, restart the app before
debugging the code.**

### Note on the demo data
The status breakdown legitimately shows ~15 `PENDING_PAYMENT` orders — real leftovers from checkout
tests that never paid. Correctly reported, but they clutter the demo; clearing them is cosmetic.

---

## Redux on the admin side, Context on the customer side (DONE)

Per the brief: **Redux Toolkit for admin pages, React Context for customer-facing pages.** All six
admin screens are now store-driven; nothing customer-facing changed.

```
src/store/
├── index.ts          configureStore + typed useAppDispatch / useAppSelector
├── apiFailure.ts     flattens ApiError into something an action can carry
├── catalogSlice.ts   products + toppings + crusts (one domain, one slice)
├── ordersSlice.ts    paging, status filter, status transitions
├── reportsSlice.ts   dashboard, cached per day-range
└── usersSlice.ts     accounts, role changes, soft delete
```

### `<Provider>` goes in AdminLayout, not main.tsx
That placement does two jobs at once. It makes the split structural — customer pages cannot reach
the store even by accident — and it keeps Redux out of the customer bundle, because `AdminLayout`
is behind `lazy()`.

**Verified in the build output, not assumed:** the store compiles to its own `store-*.js` chunk
(36 KB). The entry chunk's only mention of it is inside the lazy-route preload manifest — there is
no static import — so a visitor who never opens `/admin` downloads none of it.

### Slice boundaries follow the domain, not the screen
Products, toppings and crusts share ONE slice despite having a tab each: they are one thing, the
menu, and they change together. Three near-identical slices would have tripled the boilerplate to
express something untrue.

The remaining repetition (three fetch/save/delete triples) is deliberate. A `makeCrudSlice(name, api)`
factory would collapse it to a third of the lines and make every one of them harder to follow —
the wrong trade for code that exists to be read.

### What stayed in useState — and why that is the point
Only the LIST is store state. Which modal is open, what is typed into the form, and which field is
invalid all remain `useState`: scratch state owned by one component, dead when it unmounts, useless
to anyone else. Putting form keystrokes in a global store is the classic way to make Redux
miserable. The rule is *shared* state goes in the store, not *all* state.

Admin pages also still use `useAuth`, `useToast` and `useMenu`. Identity and toasts belong to the
whole app, customer screens included, so moving them into an admin-only store would put them out of
reach of half the app. "Redux for admin" is about admin **data**, not about banning Context.

### ⚠️ Gotcha — an ApiError does not survive the trip through Redux
A thunk that simply throws lands in `rejected` with `action.error`, which RTK builds via
`miniSerializeError`: it keeps `name`, `message` and `stack` and discards everything else. Everything
else is exactly what these forms need — `ApiError.fieldErrors()` is what puts "already exists" under
the right input instead of in a generic banner.

`apiFailure.ts` flattens the error at the edge into a plain `{message, fieldErrors}` and hands it to
`rejectWithValue`. That also keeps the store serialisable, which is what RTK's dev-mode check is
warning about when it complains at class instances in state.

### ⚠️ Bug introduced and fixed — the same error shown twice
Giving the catalog slice one shared `error` string meant a form validation failure set it too, so
"already exists" appeared **both** under the form field and in a page-level banner behind the modal.
Caught by an existing test asserting the message was visible — it found two matches.

Now only a failed **fetch** becomes the page-level error. A failed save or delete is reported where
it happened, through `unwrap()`. Shared error state is convenient right up to the point where one
failure has more than one right place to be shown.

### `.unwrap()` is not optional
`dispatch(thunk())` RESOLVES even when the thunk rejects — it hands back the action object. A
`try/catch` around a bare dispatch therefore never runs its catch, and every failure is reported to
the user as a success. `.unwrap()` re-throws so normal `try/catch` works.

### Test updated, deliberately
`a deactivated product disappears from the public menu` waited for a follow-up `GET
/api/admin/products` after the deactivate PATCH. There is no longer one to wait for: the slice
patches the affected row in place rather than refetching the list, which is one round trip fewer.
The PATCH is still awaited, so the public-menu assertion is still safe.

### Known flakiness (pre-existing, not from this work)
Two tests occasionally time out under load — `checkout preselects the primary address` (clicks while
a Bootstrap modal is still fading) and `a stale cart id is discarded` (`waitForResponse`). Both pass
24/24 and 34/34 on `--repeat-each=2`. Worth hardening if they start failing more often.

---

## Backing services in Docker Compose (DONE)

`pizza-springboot-backend/docker-compose.yml`. The app is deliberately **not** in it: it runs from
Maven so a code change is a restart rather than an image rebuild. The file provides only what the
app talks to over a socket.

### What the backend actually needs

An audit of the pom, the properties files and every `@Profile` found four services and no others:

| Service | Required? | Gate |
|---|---|---|
| MySQL | yes | always |
| Elasticsearch | no | Spring profile `search` |
| ActiveMQ Artemis | no | Spring profile `messaging` |
| Mailpit (SMTP sink) | no | only when `spring.mail.host` is set |

Nothing else earns a container. The cache is `ConcurrentMapCacheManager`, which is in-JVM — no
Redis. Stripe and Google OAuth are remote APIs.

### Compose profiles mirror the Spring profiles

Each optional service sits behind a compose profile named after the Spring profile that needs it,
so `docker compose up -d` starts MySQL alone and the default `./mvnw spring-boot:run` is unchanged.
That is the same reasoning `@Profile("messaging")` already applies in `MessagingConfig`: the
zero-argument path must stay MySQL and nothing else.

### MySQL publishes 3308

3306 belongs to the MySQL installed on this machine. `application.properties` still points at 3306,
so a native install keeps working; **`application-docker.properties` (new)** overrides only the URL
to 3308 and is opted into with `-Dspring-boot.run.profiles=local,docker`. Changing the default
would have broken whoever is not using containers, to save one profile name.

### ⚠️ Gap found — the `messaging` profile could not have authenticated

There was no `application-messaging.properties` at all, so Boot connected to Artemis with
`mode=native` and **no credentials**, which any secured broker rejects. The broker's reply is one
line — `AMQ229031: Unable to validate user from …. Username: null` — and it reads like a wrong
password rather than an absent one. The new file supplies `spring.artemis.user`/`password`; they
must stay in step with `ARTEMIS_USER`/`ARTEMIS_PASSWORD` in the compose file. Seen for real during
verification, before the file existed.

### ⚠️ Gotcha — a healthcheck can only run commands the image contains

The first Artemis healthcheck was `curl -fs http://localhost:8161/console`. The image has no curl,
so the check failed forever, `docker compose up --wait` reported `container pizza-artemis is
unhealthy`, and the broker was in fact up and serving the whole time — the log said
`AMQ221007: Server is now active`. Replaced with `artemis check node`, which ships with the image
and probes **61616**, the port Spring actually connects to, rather than the web console.

MySQL has the same trap in a milder form: without a healthcheck the container is "up" several
seconds before it accepts a connection, and the app races it to a connection refused.

### Elasticsearch note

Another project on this machine was publishing an Elasticsearch on 9200, which is worse than a port
clash — pointing at it would not fail, it would index the pizza menu into somebody else's cluster.
That container was retired, so ours uses the default 9200. Its heap is pinned to 512 MB because
Elasticsearch otherwise sizes it from the **host's** total RAM for the sake of 14 products.

### Verified against the running stack, not assumed

- `docker compose --profile all up -d --wait` → all four healthy.
- Liquibase ran all 35 changesets into the 3308 container; Hibernate `validate` passed against
  MySQL 8.4; `/api/products` served the 14 seeded products from it.
- Elasticsearch: admin reindex returned `Reindexed 14 products`; `?q=pepperoni` returned 3 relevant
  hits; the index reported 14 docs.
- Artemis: `artemis queue stat --queueName pizza.orders` showed **consumer count 1** — the listener
  authenticated and subscribed.
- Mailpit accepted a message on 1025 and served it back from the inbox API.

### ⚠️ A running instance masks all of this

The first verification run "passed" against a **different** app instance already listening on 8085
from an earlier session — the new process had failed to bind and died, while curl happily answered
from the old one. The same trap as the stale-classes note above, wearing different clothes. Every
later check ran on 8086 to keep the two apart.

---

## Open questions

- Phase 7 (Angular against the same API) is the only planned work left.
- Saved cards are stored and manageable, but **checkout does not yet offer them** — it always
  collects a card. Wiring "pay with a saved card" is the natural next step.
- The remaining DAOs (`Product`, `Topping`, `Crust`, `Cart`, `CustomerOrder`) are repository-only,
  because none of them currently needs a query that aggregates. Wire `JdbcTemplate` into one the
  moment it does, rather than pre-emptively.
- The Angular frontend (Phase 7) has both patterns to copy from now — pick its state library
  deliberately rather than by default.
