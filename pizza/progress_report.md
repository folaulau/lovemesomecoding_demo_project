# Pizza demo app — progress report

Shared context for the pizza demo (React + Angular frontends, Spring Boot backend).
Read this first when resuming work.

**Status:** Phase 0 complete (stack de-risked). Nothing built yet beyond the scaffold.
**Last updated:** 2026-08-17

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
| **1** | Real pom, Liquibase schema + seed changesets, entities/JPA layer | todo |
| **2** | React frontend on **mock data** — full Pizza Hut look, cart Context, builder modal, checkout UI | todo |
| **3** | Backend endpoints: catalog, JWT auth, orders, Stripe, admin CRUD, reports | todo |
| **4** | Integrate React → real API; wire Stripe Elements | todo |
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

## Open questions

- None blocking. Phase 1 can start.
