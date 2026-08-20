# pizza-angular-frontend

The Angular build of PizzaHub. Same backend, same Bootstrap theme, same features as
`pizza-react-frontend` — written the way Angular wants it written, so the two can be read
side by side.

Angular 21 (standalone, zoneless) · TypeScript · Bootstrap 5 · NgRx 21 (admin only) · Stripe.js

```bash
nvm use            # Node 22
npm install
npm start          # http://localhost:4200
```

The backend has to be running on **:8085**:

```bash
cd ../pizza-springboot-backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=local
```

> ⚠️ Port **4200** is not arbitrary. The backend's `pizza.cors.allowed-origins` lists
> `http://localhost:5173` (React) and `http://localhost:4200` (Angular). Serve on anything else and
> every request fails CORS with an empty page and no obvious cause.

Demo logins: `admin@pizza.test` / `admin123` · `customer@pizza.test` / `pizza123`.
Guest checkout works without signing in at all. Test card: `4242 4242 4242 4242`.

## Tests

Playwright, driving every flow through the UI.

```bash
npm run test:all                                   # 73 tests, ~50s
npm run test:admin                                 # just the admin screens
STRIPE_SECRET_KEY=sk_test_… npm run test:payment   # confirms a real test-mode payment
npm run screenshots                                # regenerates screenshots/
```

The suite is **serial** (`workers: 1`): it is integration testing against one backend and one
database. For the same reason, do not run it at the same time as the React suite — they share the
database and would see each other's fixtures.

## How it is built

```
src/app/
├── core/       models · api.service · api.interceptor · api-error · storage · money(+pipe)
│               auth/menu/cart/toast services (signals) · guards · stripe
├── shared/     app-navbar · app-footer · cart-drawer · product-card · pizza-builder-modal
│               modal · toast-host · spinner · stripe-payment-form · charts/
├── pages/      home · menu · checkout · order-confirmation · login · register · orders · profile
└── admin/      admin.routes (lazy) · admin-layout · store/ (NgRx) · pages/ (six screens)
```

**State is split the same way the React app splits it, for the same reasons.**
Customer-facing screens use signal-based services injected from the root; the admin section uses
NgRx. The store's four features are registered on the `/admin` route so they ship in the lazy admin
chunk — see the long note in `admin/store/index.ts`, including the one line that cannot move there.

Nearly every file carries a comment explaining WHY it is written the way it is, and how the same
problem is solved in the React build. That is the point of this app: the comments are the tutorial.
