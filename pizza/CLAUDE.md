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
- **`/admin` is web-only.** Both mobile apps — React Native and native SwiftUI — are
  customer-facing and stop there, deliberately: store management belongs on a desktop, and leaving
  it out keeps the diff between a mobile app and `pizza-react-frontend` purely "native vs browser"
  rather than "different product".

### Still open
- **Pay with a saved card is in `pizza-react-frontend` only** (PIZZA-42, 2026-10-04). The Angular,
  React Native and SwiftUI checkouts still always collect a fresh card.
- **No frontend can save a card AT checkout** — cards are saved on the profile page only. Separate
  ticket, deliberately out of PIZZA-42.

---

## Structure

Five apps against one API: a Spring Boot backend, two web frontends that are deliberately the same
app in different frameworks, and two mobile apps — React Native and native SwiftUI — that are
deliberately the same customer app in different native stacks.

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
repository, a `JdbcTemplate`, or both — whichever its methods need.
`BalanceDAOImpl.java` in trademachine is the reference; `UserDAOImp` here is the local example.

(Wire only what the methods use: `ReportDAOImp` is JdbcTemplate-only, since reporting never loads an
entity, and `UserPaymentMethodDAOImp` is repository-only until one of its queries needs SQL.)

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
│                ProtectedRoute · StripePaymentForm · SavedCardPayment · ErrorBoundary
├── context/     AuthContext · CartContext · MenuContext · ToastContext
├── lib/         api.ts (the only place that calls fetch) · adminApi · profileApi · orderApi
│                stripe · stripeErrors · money · cards
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

### Mobile — `pizza-react-native-mobile`

Expo SDK 57 (expo-router, **development build** — not Expo Go) + React Native 0.86 + React 19 +
TypeScript, against the same API. **Customer flows only — there is no `/admin` here**, deliberately:
store management belongs on the web, and leaving it out keeps the diff against
`pizza-react-frontend` purely "native vs browser".

```
app/                     expo-router: the folder structure IS the navigation graph
├── _layout.tsx          providers + root stack + the splash gate
├── (tabs)/              Home · Menu · Orders · Profile
├── checkout.tsx · order/[orderId].tsx · login.tsx · register.tsx · +not-found.tsx
src/
├── api/                 client.ts (the ONLY fetch) · config · apiError · endpoints/*.api.ts
├── components/ui/       the design system — Button, Card, Sheet, TextField, Screen, …
├── domain/              money.ts, ids.ts — pure, React-free
├── features/            auth · cart · checkout · home · menu · orders · profile
├── providers/           AppProviders · ToastProvider
├── storage/             secureStorage (keychain) · deviceStorage · key registry
├── theme/               tokens.ts + theme.ts — the native port of `_tokens.scss`
└── types/               the API contract, one file per domain
```

- **Feature-first.** A feature owns its state, screens and components; anything two features share
  moves down into `components/ui`, `domain` or `api`. **Route files are one line** — they name a
  screen, they never implement one. Imports use the `@/` alias, declared once in `tsconfig.json`.
- **State is Context, never Redux** — auth, menu, cart, toasts, mirroring the React app's customer
  side. Redux is absent because the thing that justified it there (`/admin`) is absent here.
- ⚠️ **The provider order in `AppProviders` is load-bearing.** `MenuProvider` must sit above
  `CartProvider`: rehydrating a saved cart needs the catalogue to re-price it.
- **There is no Bootstrap.** React Native has no cascade and no `var()`, so `theme/tokens.ts`
  re-states the same palette as constants and every component imports what it needs.
- **Use React Native's major features and comment WHY each one earns its place**, exactly as the two
  web apps do — and say what the web does about the same problem. The comments are the tutorial.

#### The native-only concerns, and where they live
- ⚠️ **The JWT goes in the OS keystore** (`expo-secure-store`), not `localStorage`. Reading it is
  ASYNC, which is why `AuthProvider` has an `initialising` state and the root layout holds the
  splash screen. Do not "simplify" that away.
- ⚠️ **The cart flushes on `AppState` background.** A browser tab lives until it is closed; a phone
  can suspend or kill the process before a 300 ms debounce fires. Without the flush, adding a pizza
  and immediately switching apps loses it.
- ⚠️ **Stripe is quarantined in `features/checkout/payment/`** behind a `PaymentGateway` interface,
  with a `.web.tsx` sibling Metro picks by platform. `@stripe/stripe-react-native` is a NATIVE
  module with no web build — importing it anywhere else breaks the web preview and makes the
  checkout screen untestable. It uses **PaymentSheet**, not a hand-rolled `CardField`.
- ⚠️ **The API host is resolved, not hard-coded** (`src/api/config.ts`): `localhost` on the iOS
  simulator, `10.0.2.2` on the Android emulator, and the LAN address Expo served the bundle from on
  a real device.
- ⚠️ **Reset state with a `key`, not an effect.** `PizzaBuilderSheet` and `AddressFormSheet` are
  remounted by a counter the parent bumps on open. An effect copying props into state renders the
  stale values for a frame and trips `react-hooks/set-state-in-effect`.
- ⚠️ **`useRef(...).current` read during render is now a lint ERROR** (`react-hooks/refs`). For an
  `Animated.Value`, `useState(() => new Animated.Value(0))` says the same thing honestly.
- ⚠️ **Shadows are platform-split** — iOS reads `shadow*`, Android reads `elevation`. Set both, or
  the cards are flat on Android. Likewise `autoCapitalize="none"` on every email field.
- ⚠️ **`StyleSheet.absoluteFillObject` was removed in RN 0.86.** Write the four edges out.

#### What the web preview cannot do
`npx expo start --web` renders the same components through react-native-web and is what the
Playwright suite drives. Three things genuinely do not work there, and the app says so rather than
failing silently: **Stripe's payment sheet** (no web build), **`Alert.alert`** (a silent no-op, so
delete confirmations do nothing), and **`accessibilityState`** (never mapped onto `aria-*`, so a
radio's checked state is invisible to the DOM though correct on device).

### Mobile — `pizza-ios-mobile`

Native **SwiftUI**, iOS 17+, Swift 5.10, Xcode 15.4. Same API, same palette, **customer flows only**
for the same reason the React Native app has none. `StripePaymentSheet` is the only dependency.

The point of having both mobile apps is the comparison: they are the same product, so every
difference between them is a difference between the *stacks*. Most of the interesting comments in
the Swift code say what React Native does about the same problem.

```
Pizza/
├── App/         PizzaApp (@main + scenePhase) · AppEnvironment (the graph) · AppRouter · RootView
├── Core/        Networking/ · Persistence/ · DesignSystem/ · Utilities/   — knows nothing of pizza
├── Domain/      Models/ · Services/ (CartReducer, CartPricing — pure) · Repositories/ (protocols)
├── Data/        Endpoints/ (every route, as inert values) · Repositories/ (HTTP + preview doubles)
└── Features/    Home · Menu · Cart · Checkout · Orders · Auth · Profile
```

#### The architecture rules that matter
- **Layered, dependencies pointing inwards.** Repository *protocols* live in `Domain`; their HTTP
  implementations live in `Data`. Nothing under `Features/` imports `URLSession` or `Endpoint`, so
  a feature is testable with an array and swapping the transport touches one folder.
- **`AppEnvironment` is the composition root — read it first.** Every concrete type the app runs
  with is chosen in one initialiser. There are no singletons, which is what lets
  `AppEnvironment.preview()` hand the whole app a stubbed graph.
- ⚠️ **`CartStore` takes `MenuStore` as a constructor parameter, and that is load-bearing.**
  Rehydrating a saved cart needs the catalogue to re-price it. The React Native app expresses the
  same constraint as provider *ordering*, with a comment warning not to swap them; here the
  compiler enforces it.
- **A pure reducer for the cart, effects in the store.** `CartReducer.reduce` is a function from a
  value to a value — 15 tests, no app, no async, no main actor.
- **`ViewState<T>` instead of `isLoading` + `error` + `items`.** Three booleans describe eight
  combinations, five of which are nonsense; the enum makes them unrepresentable, including the
  eternal spinner that ships when the failure branch is forgotten.
- **Three `@Observable` stores for app-wide state** (auth, menu, cart), injected through the SwiftUI
  environment — the same split as the React app's customer contexts. **A view model only where
  there is state with rules or derived values worth testing**: `CheckoutViewModel` has both,
  `HomeView` has neither and therefore has none.
- **Use SwiftUI's major features and comment WHY each one earns its place** — `@Observable`,
  `@Environment`, `@Bindable`, `.task`, `@FocusState`, `ButtonStyle`, `Layout`, `NavigationStack`
  with typed routes, `.refreshable`, `.sheet(item:)`, structured concurrency. The comments are the
  tutorial, and most of them say what React Native does about the same problem.

#### Gotchas already paid for — do not rediscover these
- ⚠️ **XcodeGen 2.46 writes project format 77, which Xcode 15 refuses to open**, and it ignores its
  own `options.objectVersion` (the option parses — check with `xcodegen dump` — and has no effect).
  `Scripts/generate-project.sh` regenerates and downgrades to format 56, which Xcode 16 reads
  perfectly well. **Use the script, never `xcodegen generate` directly.**
- ⚠️ **Swift 5.10 isolates a `View`'s `body` but not its helper properties.** A `private var tabs`
  that reads a `@MainActor` store does not compile. Every view in `App/` and `Features/` is
  annotated `@MainActor` on the type for this reason.
- ⚠️ **`deinit` is never actor-isolated**, so it cannot cancel a task held in `@MainActor` state.
  Reaching for `MainActor.assumeIsolated` there is asserting something untrue. Cancellation happens
  where it can be correct: a superseding call, or `.task` ending with its view.
- ⚠️ **A default argument is evaluated in a NONISOLATED context in Swift 5**, even inside a
  `@MainActor` function — so `gateway: StubPaymentGateway = StubPaymentGateway()` does not compile.
  Default to `nil` and construct in the body.
- ⚠️ **`@MainActor` on an `XCTestCase` subclass** warns now and is an error in Swift 6: `XCTestCase`
  is nonisolated and a subclass may not add isolation. Annotate each test *method*.
- ⚠️ **Swift NESTS block comments.** `/api/me/**` inside a `/* … */` opens a second comment and
  swallows the rest of the file, with the error reported at the closing brace. Use `//` for prose
  containing a glob.
- ⚠️ **`//` cannot appear unescaped in an .xcconfig value** — it starts a comment, so
  `http://localhost` silently becomes `http:`. Write `http:$()/$()/localhost:8085`.
- ⚠️ **Xcode 15.4 cannot compile ANY asset catalogue on macOS 26** — `Failed to launch
  AssetCatalogSimulatorAgent via CoreSimulator spawn`. `actool` spawns a helper inside a simulator
  runtime, and this CoreSimulator cannot spawn a host binary on this macOS (`xcrun simctl spawn
  booted <host binary>` fails on its own with `LaunchdSimError 153`). It hits the app's own
  catalogue and all three of Stripe's, on the simulator SDK *and* the device SDK, and installing a
  runtime does not help. **Updating Xcode is the fix.** To run the app meanwhile, temporarily drop
  the asset catalogue and the Stripe package from `project.yml` — `StripePaymentGateway` has an
  `#if canImport` else-branch for exactly this.
- ⚠️ **`@Previewable` is Xcode 16 only.** A preview needing `@State` uses a small wrapper view.
- ⚠️ **`@Environment` is not readable from `init`.** A view model needing dependencies from the
  container is built in `.task`, guarded so it happens once per appearance rather than per redraw.
- ⚠️ **`PRODUCT_NAME` must not be set in a PROJECT-level .xcconfig.** It applies to every target and
  the Swift module name derives from it, so the app and the test bundle both produced
  `StayHub_Pizza.swiftmodule` and the build died with four "Multiple commands produce …" errors that
  name the symptom, not the cause. It is set per target, and the app also sets
  `PRODUCT_MODULE_NAME: Pizza` so `@testable import Pizza` means what it looks like it means.
- ⚠️ **A target with its own `INFOPLIST_FILE` owns every bundle key.** Xcode synthesises
  `CFBundleVersion`, `CFBundleExecutable` and friends only when it generates the plist. Omitting
  them is not a build error — the app compiles, links and signs, and then the simulator refuses to
  install it with "does not contain a valid CFBundleVersion".
- The URL scheme is **`pizzaios`**, not the React Native app's `pizzaapp` — both can be installed on
  one device, and iOS gives a duplicated scheme to whichever app it feels like. It must match
  `returnURL` in `StripePaymentGateway`, or a 3D Secure redirect never comes back.

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
./mvnw test                                               # 91 tests; 4 fail on stale seed data — see progress_report
./mvnw spotless:apply                                     # before committing Java

# frontend — React
cd pizza-react-frontend && nvm use && npm run dev          # :5173

# frontend — Angular (same backend)
cd pizza-angular-frontend && nvm use && npm start          # :4200

# mobile — React Native (same backend). A DEVELOPMENT BUILD, not Expo Go.
cd pizza-react-native-mobile && nvm use && npx expo run:ios     # or run:android
npx expo start --web                                       # :8081 (or :8082) — preview + Playwright
npm test                                                   # 193 Jest tests, no backend needed
npm run test:e2e                                           # 31 Playwright tests, through the web target

# mobile — native SwiftUI (same backend). Nothing to install; the project is committed.
cd pizza-ios-mobile && open Pizza.xcodeproj                # then ⌘R
xcodebuild test -project Pizza.xcodeproj -scheme Pizza \
    -destination 'platform=iOS Simulator,name=iPhone 15'   # 130 XCTest cases, no backend needed
./Scripts/generate-project.sh                              # only after editing project.yml
```

⚠️ **The Angular app must be served on 4200, the React app on 5173, and the mobile web preview on
8081 or 8082** — those are the origins `pizza.cors.allowed-origins` allows. Any other port fails
CORS, and the symptom is a blank page rather than an error anyone would recognise. The iOS and
Android builds are not browsers and are not subject to CORS at all.

⚠️ **Expo Go cannot run this app.** `@stripe/stripe-react-native` is a native module, and Expo Go
ships a fixed set that does not include it. `expo run:ios` builds the dev client that does.

⚠️ **React Native 0.86 needs Xcode 16.1+ and an installed simulator runtime.** Check both —
`xcodebuild -version` and `xcrun simctl list runtimes`; a fresh Xcode often has no runtime at all,
and the resulting error points nowhere useful.

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
  profile, admin, plus API guards not observable through the UI. **All three** frontends have a
  suite; they mirror each other. `pizza-react-native-mobile`'s drives the **web** target
  (react-native-web), where `testID` becomes `data-testid`.
- `pizza-react-native-mobile` also has a **Jest suite** (`npm test`, 193 tests) for everything the
  web target cannot reach: the keychain, `AppState`, and the Stripe adapter against a mocked SDK.
  Its screens show 0% in the Jest coverage report and are covered by Playwright instead.
- `pizza-angular-frontend` also has a **Vitest unit suite** (`npm test`) for the things cheaper to
  test in isolation: a pipe, a directive, a guard, the HTTP interceptor, and the debounced search.
- `pizza-ios-mobile` has an **XCTest suite** (130 cases, no backend needed) and no UI tests: the
  pure domain, the networking layer through a real `URLSession` with a stubbed `URLProtocol`, the
  Keychain-backed token store, and every store and view model against hand-written doubles.
  Duplicating the Playwright coverage there would be testing SwiftUI rather than this app.
  ⚠️ Start Playwright only once the dev server has finished rebuilding — a run started mid-rebuild
  has produced failures that then passed in isolation and on every later run.
- ⚠️ **Never run two suites at once.** All three share the backend and the database, so each sees
  the others' fixtures and counts.
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
