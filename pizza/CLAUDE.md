# Pizza

A minimal Pizza Hut-style ordering app. It exists to produce **tutorial snippets** for
lovemesomecoding.com, so readability and teachability outrank cleverness. Where a "real production"
choice and a "clear teaching example" choice conflict, prefer the teaching one and leave a comment
explaining what production would do differently.

**`progress_report.md` in this directory is the shared context — read it first when resuming.**
It holds the history, the decisions and the gotchas already paid for. This file is the standing
instructions; that one is the state.

---

## Requirements

### Product
- Behave and look like https://www.pizzahut.com.
- **Keep it minimal.** Pizzas, drinks, toppings, crusts — nothing else. Resist new product types.
- Order and pay with Stripe. Card `4242 4242 4242 4242` is the test card.
- **Guest checkout works end to end** — signing in is never required to order.
- Signed-in customers get: order history, multiple delivery addresses (exactly one primary),
  saved cards, and a profile page to manage all of it.
- Delivery or pickup, choosable in the cart drawer *and* on the checkout page. Pickup has no
  delivery fee.
- The cart lives in the **backend**, so refreshing any page never loses it.
- `/admin`: manage products, toppings, crusts, orders and users.
- `/admin` reports: revenue over time, top products, orders by status, headline totals — all from
  real database aggregates, never mock data.

### Still open
- **Checkout does not yet offer saved cards** — it always collects a fresh one. Cards can be saved
  and managed on the profile page; wiring "pay with a saved card" is the natural next step.
- `pizza-angular-frontend` is empty. Phase 7.

---

## Structure

### Backend — `pizza-springboot-backend`

Java 21, Spring Boot 4.1.0, MySQL, Liquibase. Patterned on
`/Users/folaukaveinga/Github/trademachine` (backend only — ignore its frontend directory).

```
com.pizza.api
├── config/      SecurityConfig · OpenApiConfig · RestMVCConfig · ThreadPoolConfig
├── dto/         every DTO + ONE central EntityDTOMapper (MapStruct)
├── entity/      DatabaseTableNames + one package per domain:
│   ├── cart/    Cart, CartItem, CartItemTopping + DAO/Service/Controller
│   ├── crust/
│   ├── order/   CustomerOrder, OrderItem, OrderItemTopping, PricingService
│   ├── product/ Product, ProductSize
│   ├── topping/
│   └── user/    User, UserAddress, UserPaymentMethod, auth + profile + admin controllers
├── exception/   ApiError · ApiSubError · ApiException · RestExceptionHandler
├── mapper/      JdbcTemplate RowMapper classes (see the DAO rule below)
├── payment/     StripeService · StripeWebhookController
├── report/      ReportDAO/Imp · ReportService/Impl · ReportRestController
└── security/    JwtService · JwtAuthenticationFilter
```

**One package per entity, everything for it together:** `Product.java`, `ProductDAO`,
`ProductDAOImp`, `ProductRepository`, `ProductService`, `ProductServiceImpl`,
`ProductRestController`. (Note the spelling: `DAOImp`, not `DAOImpl` — matching trademachine.)

#### The DAO layer — the rule that matters most
Every DAO is an **interface plus an implementation**, and the implementation wires in a Spring Data
repository **and** a `JdbcTemplate` — whichever of the two each method needs.
`BalanceDAOImpl.java` in trademachine is the reference; `UserDAOImp` here is the local example.

(A DAO with no simple CRUD at all is the one exception: `ReportDAOImp` is JdbcTemplate-only, because
reporting never loads or saves an entity.)

- **Repository** for the simple things: save, update, single-row lookups, existence checks.
  Spring Data derives them from the method name, returns managed entities that dirty-checking can
  track, and honours the `@SQLRestriction` that hides soft-deleted rows.
- **`JdbcTemplate`** for custom queries — anything that aggregates, or whose result is not an
  entity. JPA has nothing to offer those.
- **Declare the SQL inside the method** that runs it, as `String query = """ … """`, so the query
  and the call that binds its parameters are read together.
- **Custom RowMappers go in their own classes in `com.pizza.api.mapper`** — never as lambdas inside
  the DAO. They are then unit-testable, and the query and its mapping can change independently.
- Bind with **named parameters** (`:from`), never string concatenation.

⚠️ **Hand-written SQL must filter `deleted = 0` itself.** The entities carry
`@SQLRestriction("deleted = false")`, but Hibernate only applies that when it builds a query from
the entity model — SQL written by hand never goes near it. Forgetting this silently counted deleted
orders as revenue once; the reports stayed plausible, just wrong.

#### Other backend rules
- **Service layer is an interface plus an implementation**, always.
- MapStruct for DTO mapping; Lombok annotations wherever they apply.
- Swagger/springdoc — every endpoint documented.
- Liquibase owns the schema (`ddl-auto=validate`). Changesets are **formatted SQL** under
  `db/changelog/sql/`, added as new numbered files — **never edit an applied changeset**, it breaks
  the recorded checksum.
- Every table has a BIGINT primary key for internal FKs plus a `public_id` UUID. **The API exposes
  only the UUID.**
- Every entity has `createdAt` / `updatedAt` and a `deleted` flag. Deletes are soft — order history
  references these rows.
- Run `./mvnw spotless:apply` before committing Java.

### Frontend — `pizza-react-frontend`

React 19 + TypeScript + Vite, Bootstrap 5 via react-bootstrap.

```
src/
├── components/  AppNavbar · CartDrawer · Footer · PizzaBuilderModal · ProductCard
│                ProtectedRoute · StripePaymentForm · ErrorBoundary
├── context/     AuthContext · CartContext · MenuContext · ToastContext
├── lib/         api.ts (the only place that calls fetch) · adminApi · profileApi · stripe · money
├── pages/       Home · Menu · Checkout · OrderConfirmation · Login · Register · Orders · Profile
│   └── admin/   AdminLayout + Reports · Products · Toppings · Crusts · Orders · Users
├── store/       Redux Toolkit — admin only (see below)
├── styles/      _tokens.scss · theme.scss (Bootstrap variable overrides, not !important)
└── types/       the shared API contract
```

#### State: Redux for admin, Context for customers
- **Customer-facing pages use React Context.** Four small contexts: auth, menu, cart, toasts.
- **Admin pages use Redux Toolkit.** Slices: `catalogSlice` (products + toppings + crusts — one
  domain, one slice), `ordersSlice`, `reportsSlice`, `usersSlice`.
- **`<Provider>` goes in `AdminLayout`, never `main.tsx`.** That enforces the split structurally
  and keeps Redux in the lazy admin chunk, so customers download none of it. Verify with
  `npm run build` if you touch this.
- **Only shared state goes in the store.** Modal open/closed, form values and field errors stay in
  `useState`. Admin pages still use `useAuth` / `useToast` / `useMenu` — identity and toasts belong
  to the whole app.
- ⚠️ `dispatch(thunk())` **resolves even when the thunk rejects**. Always `.unwrap()` before
  `try/catch`, or every failure reports to the user as a success.
- ⚠️ An `ApiError` does not survive Redux — RTK serialises it and drops the body, including
  `fieldErrors()`. Flatten it with `store/apiFailure.ts` before it reaches an action.

#### Other frontend rules
- **Use React's major features and comment WHY each one earns its place** — `useReducer`, `useMemo`,
  `useCallback`, `memo`, `lazy`/`Suspense`, `createPortal`, `useId`, `useRef`, error boundaries.
  The comments are the tutorial.
- Server prices are authoritative. The browser's arithmetic is a preview; the moment an order
  exists, show the server's figures.
- `pizza-angular-frontend` will use **Tailwind** (not Bootstrap) against the same API.

---

## Security — non-negotiable

- **Never store card numbers, CVC or cardholder names.** Only Stripe's opaque `pm_…` token plus
  brand/last4/expiry as display metadata. If a `cardNumber` field appears anywhere, something is wrong.
- The server recomputes **every** price. `PricingService` is the security boundary; client-sent
  prices are ignored.
- Registration always creates a CUSTOMER. Role can never come from a request body.
- `/api/me/**` resolves the owner from the token — no user id in the path. Foreign-owned resources
  return **404, not 403** (403 would confirm the id exists).
- Login failures are deliberately vague, to prevent account enumeration.
- The Stripe webhook verifies `Stripe-Signature`. Without it, anyone could POST "payment succeeded".
- Admins cannot demote or delete themselves — that would lock the last admin out.
- The demo credentials in the footer are acceptable **only** because they are throwaway local
  fixtures. If this ever points at real data, that block is the first thing to delete.

### Stripe keys
Test mode. Publishable key (public by design, reaches the browser via `VITE_STRIPE_PUBLISHABLE_KEY`
in a gitignored `.env.local`):

```
pk_test_51U5Wc3BeMrxmFducR7hlZ3YwT770EF2DFj8VPmEmqZ7r2sVasfWDRjWMQBvEqdWOSuIGg6RSd8oIcjQ9RblgJxRq00ThBQPY9F
```

The **secret key lives only in `application-local.properties`** (gitignored) or an env var — never
in this file, never in a commit. ⚠️ It was previously pasted into this file and committed, so treat
the current one as burned and **roll it in the Stripe dashboard**.

---

## Running it

```bash
# backend — needs local MySQL (root, empty password), database `pizza`
cd pizza-springboot-backend && ./mvnw spring-boot:run     # :8085, Swagger at /swagger-ui.html
./mvnw test                                               # 60 tests
./mvnw spotless:apply                                     # before committing Java

# frontend
cd pizza-react-frontend && nvm use && npm run dev          # :5173
```

Demo logins: `admin@pizza.test` / `admin123` · `customer@pizza.test` / `pizza123`.

⚠️ If behaviour does not match the source, **the app is serving stale classes** — this has cost
several debugging sessions. Stop it, `./mvnw clean compile`, start again. An IDE-launched instance
is especially prone to this after an external Maven build.

---

## Test

- **Playwright, driving every flow through the UI** — browse, cart, auth, checkout, orders,
  profile, admin, plus API guards not observable through the UI.
- `npm run test:all` runs the whole suite. Prefer it: the narrower scripts name their specs
  explicitly, and a new spec is not run until someone remembers to add it.
- Payment: order → confirm with Stripe's test card → assert **our** API reports `PAID`.
  Stripe's card iframe cannot be automated headlessly (hCaptcha), so `payment.spec.ts` confirms
  through Stripe's API instead and skips without `STRIPE_SECRET_KEY`.
- The suite is **serial** (`fullyParallel: false, workers: 1`) — it is integration testing against
  one backend and one database.
- Tests must clean up what they create, or a failure poisons every later run.
- Aim for ~90% coverage of changes. Verify against SQL rather than trusting a green screen.

---

## Git

- Do **not** add `Co-Authored-By` or any author trailer.
- Do **not** push — the user does that.
- Never commit log files, `node_modules`, build output or migration artifacts.
- Write a real commit message explaining *why*, not just what.
