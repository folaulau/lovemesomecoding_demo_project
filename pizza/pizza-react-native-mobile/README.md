# pizza-react-native-mobile

The customer-facing **iOS and Android** app for the pizza demo — the third frontend against the
same Spring Boot API as `pizza-react-frontend` (React + Vite) and `pizza-angular-frontend`
(Angular). Expo SDK 57, React Native 0.86, React 19, TypeScript, expo-router.

It exists to produce tutorial snippets, so the comments are the point: nearly every non-obvious
line says **why**, and where React Native diverges from the web the comment names both sides.

---

## What it does

Everything a customer can do, and nothing an admin can:

| | |
|---|---|
| Browse | Home, menu with a type filter, pizza builder (size · crust · toppings, priced live) |
| Cart | Server-side, so force-quitting the app never loses it. Delivery or pickup. |
| Checkout | **Guest checkout works end to end.** Saved addresses for signed-in customers. |
| Pay | Stripe's native **PaymentSheet** — the card never touches our code |
| Account | Sign in / register, order history, order confirmation with payment polling |
| Profile | Delivery addresses (exactly one primary), saved cards |

**`/admin` is deliberately absent.** Store management belongs on the web, which keeps the diff
between this app and `pizza-react-frontend` purely "native vs browser" rather than "different
product".

### Still open
- **Checkout does not offer saved cards** — it always collects a fresh one through the payment
  sheet. Cards can be saved and managed on the profile screen. This matches both web frontends.

---

## Running it

```bash
# 1. the backend, from pizza-springboot-backend
docker compose up -d && ./mvnw spring-boot:run        # :8085

# 2. this app
nvm use
npx expo run:ios                                       # or run:android
```

`expo run:ios` compiles a **development build** — a real app on the simulator, with the native
Stripe module linked. It takes a few minutes the first time and is fast afterwards.

> ⚠️ **Expo Go will not work.** `@stripe/stripe-react-native` is a native module, and Expo Go ships
> a fixed set of native modules that does not include it. `npx expo start` alone is only useful for
> the web preview below.

### Requirements

| | |
|---|---|
| Node | 22 (`nvm use` reads `.nvmrc`… of the sibling apps; 20+ is fine) |
| iOS | **Xcode 16.1+**, plus an installed iOS simulator runtime |
| Android | Android Studio and an AVD |

> ⚠️ React Native 0.86 requires **Xcode 16.1 or newer**. On Xcode 15.x the native build fails; check
> with `xcodebuild -version`, and confirm you actually have a simulator runtime with
> `xcrun simctl list runtimes` — a fresh Xcode install often has none, and the error that produces
> is unhelpful.

### The web preview

```bash
npx expo start --web        # :8081, or :8082 if 8081 is taken
```

react-native-web renders the same components in a browser. It is for **development and the
Playwright suite only** — three things genuinely do not work there, and the app says so rather than
failing silently:

- **Stripe's payment sheet** — no web implementation, so checkout shows an explanatory message
  (see `src/features/checkout/payment/paymentGateway.web.tsx`).
- **`Alert.alert`** — a silent no-op on web, so the delete-confirmation dialogs do nothing.
- **`accessibilityState`** — not mapped onto `aria-*`, so a radio's checked state is invisible to
  the DOM even though it is correct on device.

### Environment

Everything has a working default. Two optional variables, in a gitignored `.env.local`:

```bash
# Needed for the payment sheet. PUBLISHABLE key only — the secret key lives on the backend.
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Only for running on a PHYSICAL device on a different network than the auto-detected one.
PIZZA_API_URL=http://192.168.1.42:8085
```

**The API host is worked out for you** (`src/api/config.ts`): `localhost` on the iOS simulator,
`10.0.2.2` on the Android emulator, and — on a real phone — the LAN address Expo already used to
serve the bundle.

---

## Structure

Feature-first. A feature owns its state, its screens and its components; anything two features
share moves down into `components/ui`, `domain` or `api`.

```
app/                        expo-router — the folder structure IS the navigation graph
├── _layout.tsx             providers + the root stack + the splash gate
├── (tabs)/                 Home · Menu · Orders · Profile   (parentheses = no URL segment)
├── checkout.tsx
├── order/[orderId].tsx     /order/:orderId
├── login.tsx · register.tsx
└── +not-found.tsx
src/
├── api/                    client.ts (the ONLY fetch) · config · apiError · endpoints/*.api.ts
├── components/
│   ├── ui/                 the design system: Button, Card, Sheet, TextField, Screen, …
│   └── RouteErrorBoundary  what a screen shows when its render throws
├── domain/                 money.ts, ids.ts — pure, React-free, and the most-tested code here
├── features/
│   ├── auth/               state/AuthProvider · screens · RequireAuth
│   ├── cart/               state/{cartReducer, CartProvider} · CartSheet · CartHeaderButton
│   ├── checkout/           payment/ (the Stripe adapter) · hooks · components · screens
│   ├── home/ menu/ orders/ profile/
├── providers/              AppProviders (composition + ordering) · ToastProvider
├── storage/                secureStorage (keychain) · deviceStorage · the key registry
├── theme/                  tokens.ts + theme.ts — the native port of `_tokens.scss`
└── types/                  the API contract, one file per domain
```

Route files are **one line each**: they name a screen, they do not implement one. That keeps a
screen renderable in a test without a router, and makes moving a screen a file rename.

Imports use the `@/` alias (`@/features/cart/...`), configured once in `tsconfig.json` — Metro reads
it from there, so there is no second copy to keep in sync.

---

## The decisions worth knowing

### State: Context, no Redux
Four providers — auth, menu, cart, toasts — mirroring `pizza-react-frontend`'s customer side
exactly. Redux is absent because the thing that justified it there (`/admin`) is absent here.

**The provider order in `AppProviders` is load-bearing**: `MenuProvider` must sit above
`CartProvider`, because rehydrating a saved cart needs the catalogue to re-price it.

### The cart lives in the backend
Only its UUID is on the device. A stored cart holds identifiers only and is re-priced from today's
menu on every read. Three effects run it: hydrate on mount, a debounced PUT on change, and — the
one with no web equivalent — **a flush when the app is backgrounded**, because the OS can suspend
or kill the process before a 300 ms timer fires.

### The server owns every price
The app's arithmetic is a preview. `POST /api/orders` sends identifiers and quantities, never money;
`PricingService` on the backend decides what the cart costs. There is a Playwright test asserting
the request body contains no price field at all.

### Payment is quarantined
`@stripe/stripe-react-native` is imported in exactly one folder, behind a `PaymentGateway`
interface, with a `.web.tsx` sibling that Metro picks by platform. Nothing else in the app knows
Stripe exists — which is what lets the checkout screen be tested, and previewed on web, without it.

### Security
Same rules as the rest of the project:

- The JWT goes in the **OS keystore** (`expo-secure-store` → iOS Keychain / Android
  EncryptedSharedPreferences), not in plain storage. Reading it is async, which is why the app has
  an `initialising` state and holds the splash screen.
- **No card data, ever.** Only Stripe's opaque `pm_…` token plus brand/last4/expiry for display.
- Registration cannot request a role; `/api/me/**` resolves the owner from the token.
- Sign-in failures are deliberately vague, to prevent account enumeration.
- The demo credentials on the home screen are acceptable **only** because they are throwaway local
  fixtures.

---

## Testing

Two suites, and they cover different things on purpose.

```bash
npm test                # Jest — 193 unit/integration tests, no backend needed
npm run test:coverage   # …with coverage
npm run test:e2e        # Playwright — 31 tests through the UI (needs the backend + expo web)
npm run test:all        # both
npm run screenshots     # regenerate screenshots/
```

**Jest** (`jest-expo` + React Native Testing Library) covers the logic: the money maths, the cart
reducer, the HTTP client, every provider, the Stripe adapter against a mocked SDK, and the design
system. It is where anything native gets tested, because mocks are the only way to reach the
keychain or `AppState` off-device.

**Playwright** covers the screens, driving the **web** target — the same components through
react-native-web, where `testID` becomes `data-testid`. Start `npx expo start --web` and the backend
first.

> ⚠️ RNTL 14 made `render` and `fireEvent` **async**. A missing `await` surfaces as
> "`render` function has not been called", which sounds like the opposite problem.

> ⚠️ Never run this suite at the same time as the React or Angular one — they share the backend and
> the database. It is serial (`workers: 1`) for the same reason, and tests clean up what they create.

Screens show 0% in the Jest report and are covered by Playwright instead; combined, every screen and
every flow is exercised.

---

## Gotchas already paid for

- **`Alert.alert` is a no-op on react-native-web.** The delete-confirmation flow works on device and
  cannot be driven from the web target at all; `e2e/profile.spec.ts` cleans up through the API and
  says why.
- **Reset state with a `key`, not an effect.** `PizzaBuilderSheet` and `AddressFormSheet` are
  remounted by a counter their parent bumps on open. An effect that copies props into state renders
  the previous values for one frame and trips `react-hooks/set-state-in-effect`.
- **`useRef(new Animated.Value(0)).current` reads a ref during render**, which React 19's lint rules
  reject. `useState(() => new Animated.Value(0))` gives the same guarantee honestly.
- **`jest.mock` factories are hoisted above the imports.** They cannot close over an ordinary
  `const` — either prefix the name with `mock`, or `require` inside the factory.
- **A `useMenu` mock returning a fresh object each call makes the cart hydrate forever.** The
  provider memoises; a careless mock reintroduces the infinite loop.
- **`StyleSheet.absoluteFillObject` was removed in RN 0.86.** Write the four edges out.
- **Shadows are platform-split**: iOS reads `shadow*`, Android reads `elevation`. Set both, or the
  cards are flat on Android.
- **`autoCapitalize="none"` on every email field.** Without it the OS capitalises the first letter
  and the address is rejected — the single most common React Native form bug.
