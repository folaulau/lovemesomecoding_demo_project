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
  This is true of **both** frontends.

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
- `pizza-angular-frontend` uses **Bootstrap**, not Tailwind. (An earlier plan said Tailwind; it was
  overruled so the two frontends are visually identical and the diff between them is purely
  framework. `pizza-angular-frontend/src/styles/` is a copy of these tokens.)

### Frontend — `pizza-angular-frontend`

Angular 21 (standalone, **zoneless**) + TypeScript + Bootstrap 5, against the same API and the same
`_tokens.scss`/`theme.scss`. NgRx 21.

```
src/app/
├── core/       models · api.service · api.interceptor · api-error · storage · money(+pipe)
│               auth/menu/cart/toast services (signals) · guards · stripe
├── shared/     app-navbar · app-footer · cart-drawer · product-card · pizza-builder-modal
│               modal · toast-host · spinner · stripe-payment-form · charts/
├── pages/      home · menu · checkout · order-confirmation · login · register · orders · profile
└── admin/      admin.routes (lazy) · admin-layout · store/ (NgRx) · pages/ (six screens)
```

#### State: NgRx for admin, signal services for customers
Deliberately the same split as React's Redux/Context line, so the two apps can be read side by side.
- **Customer pages use root-provided services holding signals** — `AuthService`, `MenuService`,
  `CartService`, `ToastService`. No provider components: `providedIn: 'root'` is what makes them
  shared, so there is no equivalent of the four nested `<Provider>`s in `main.tsx`.
- **Admin pages use NgRx.** Four features: `catalog` (products + toppings + crusts — one domain,
  one feature), `orders`, `reports`, `users`.
- **`provideState`/`provideEffects` go on the `/admin` route**, so they ship in the lazy admin chunk.
- ⚠️ **`provideStore()` cannot go with them.** `EffectsRunner` is `providedIn: 'root'` and injects
  the Store, so a route-provided store is invisible to it and the first admin navigation dies with
  `NG0201: No provider found for _Store`, thrown from a factory, with nothing failing at build time.
  It lives in `app.config.ts`; the ~16 kB raw / 4.4 kB transferred is the price.
- Only shared state goes in the store. Which modal is open and what is typed into a form stay in
  component signals — admin screens still inject `AuthService`, `ToastService` and `MenuService`.
- ⚠️ NgRx does **not** use Immer. `state.items.push(x)` in a reducer is a real bug, not a draft
  write. Every branch returns a new object. (Redux Toolkit is the opposite, which is the trap when
  moving between the two.)
- A component learns whether a dispatch worked by awaiting the success/failure ACTION —
  `store/outcome.ts`. It is the NgRx answer to RTK's `.unwrap()`, and it has its own ordering trap:
  subscribe before dispatching.
- ⚠️ An `ApiError` is not serialisable, so it is flattened to `{message, fieldErrors}` before it
  becomes an action — `store/api-failure.ts`. Same reason as the React app's `store/apiFailure.ts`.

#### Other Angular rules
- **Use Angular's major features and comment WHY each one earns its place** — signals, `computed`,
  `effect` with `onCleanup`, `input()`/`output()`, `viewChild`, `afterRenderEffect`, `inject()`,
  the `@if`/`@for`/`@let` control flow, `OnPush`, lazy routes, functional guards and interceptors,
  reactive AND template-driven forms, pipes, `ErrorHandler`, `httpResource`. The comments are the
  tutorial, and most of them say what React does about the same problem.
- **Serve on port 4200.** The backend's CORS allowlist names 5173 and 4200 and nothing else.
- ⚠️ **A `CanDeactivate` guard runs DURING `router.navigate()`.** Any "this navigation is fine"
  flag must be set BEFORE the call, not after, or the guard fires on the very navigation it was
  meant to allow. See `Checkout.paymentSucceeded`.
- ⚠️ **`httpResource().value()` THROWS in an error state**, even with `defaultValue` set. Guard
  with `hasValue()` — otherwise a backend that is down blanks the page instead of showing the error
  branch the code carefully computes. See `core/menu.service.ts`.
- ⚠️ **A required input is not readable from a constructor.** `input.required()` is assigned after
  construction, so reading one there throws `NG0950` at runtime. Use `ngOnInit` or an `effect`.
  See `pages/order-confirmation/`.
- ⚠️ **Backticks cannot appear inside an inline `template:`** — it is a template literal, so a
  backtick in a comment ends it and the errors point at the wrong line entirely. And `@` in a
  template is control-flow syntax: an email address needs `&#64;`.
- ⚠️ **A chart component needs `:host { display: block }`** or `ResizeObserver` measures its content
  rather than the available width, and the chart silently draws at half size.
- react-bootstrap has no Angular equivalent, so the modal, the offcanvas drawer and the toasts are
  hand-rolled over Bootstrap's own markup and classes rather than driven through Bootstrap's
  JavaScript. `theme.scss` supplies the two `display` rules that JavaScript would otherwise set
  inline. Known gap: the drawer does not trap focus.
- Charts are hand-written SVG (`shared/charts/`) rather than a chart library — same visual design
  and the same data-viz rules as the React app's Recharts version.

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
# backend — needs MySQL (root, empty password), database `pizza`
cd pizza-springboot-backend && ./mvnw spring-boot:run     # :8085, Swagger at /swagger-ui.html
./mvnw test                                               # 60 tests
./mvnw spotless:apply                                     # before committing Java

# frontend — React
cd pizza-react-frontend && nvm use && npm run dev          # :5173

# frontend — Angular (same backend)
cd pizza-angular-frontend && nvm use && npm start          # :4200
```

⚠️ **The Angular app must be served on 4200 and the React app on 5173** — those two origins are
what `pizza.cors.allowed-origins` allows. Any other port fails CORS, and the symptom is a blank
page rather than an error anyone would recognise.

### Backing services — `pizza-springboot-backend/docker-compose.yml`

MySQL is the only service the app needs. Everything else sits behind a **compose profile named
after the Spring profile that requires it**, so the default `up` starts one container and a plain
`./mvnw spring-boot:run` behaves exactly as it always has.

```bash
docker compose up -d                       # MySQL only
docker compose --profile search up -d      # + Elasticsearch  :9200
docker compose --profile messaging up -d   # + Artemis        :61616, console :8161 (admin/admin)
docker compose --profile mail up -d        # + Mailpit        SMTP :1025, inbox :8025
docker compose --profile all up -d         # everything
docker compose down                        # stop; `down -v` also wipes the data
```

**The container publishes MySQL on 3308, not 3306**, because 3306 belongs to the MySQL installed on
the machine. `application.properties` still points at 3306, so a native install keeps working —
add the `docker` profile to use the container instead:

```bash
./mvnw spring-boot:run -Dspring-boot.run.profiles=local,docker
./mvnw spring-boot:run -Dspring-boot.run.profiles=local,docker,search,messaging
```

⚠️ **The `messaging` profile needs credentials, and they are not optional.** Boot's default is to
connect to Artemis *anonymously*, and the broker rejects that with one unhelpful line —
`AMQ229031: Unable to validate user: null`, which sounds like a wrong password rather than an
absent one. `application-messaging.properties` supplies them; they must match `ARTEMIS_USER` /
`ARTEMIS_PASSWORD` in the compose file.

⚠️ **Health-check a container with a command that container actually has.** The Artemis image ships
no `curl`, so a `curl`-based check reports `unhealthy` forever while the broker serves happily —
and `up --wait` then fails pointing at the wrong thing. It uses `artemis check node` instead, which
probes the messaging port rather than the web console.

Demo logins: `admin@pizza.test` / `admin123` · `customer@pizza.test` / `pizza123`.

⚠️ If behaviour does not match the source, **the app is serving stale classes** — this has cost
several debugging sessions. Stop it, `./mvnw clean compile`, start again. An IDE-launched instance
is especially prone to this after an external Maven build.

---

## Test

- **Playwright, driving every flow through the UI** — browse, cart, auth, checkout, orders,
  profile, admin, plus API guards not observable through the UI. **Both** frontends have a suite;
  they mirror each other.
- `pizza-angular-frontend` also has a **Vitest unit suite** (`npm test`) for the things cheaper to
  test in isolation: a pipe, a directive, a guard, the HTTP interceptor, and the debounced search.
  ⚠️ Start Playwright only once the dev server has finished rebuilding — a run started mid-rebuild
  has produced failures that then passed in isolation and on every later run.
- ⚠️ **Never run the two suites at once.** They share the backend and the database, so each sees
  the other's fixtures and counts.
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
