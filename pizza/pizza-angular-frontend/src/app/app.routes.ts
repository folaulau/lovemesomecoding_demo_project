import { Routes } from '@angular/router';
import { adminGuard, authGuard } from './core/guards';

/* ==========================================================================
 * ANGULAR CONCEPT: lazy routes with loadComponent / loadChildren
 *
 * `loadComponent: () => import(…)` is `React.lazy` — the route's code becomes its own chunk,
 * fetched the first time someone navigates there. The difference is that Angular needs no
 * `<Suspense>` wrapper: the router simply holds the navigation until the chunk lands.
 *
 * Everything under /admin is behind `loadChildren`, so the six admin screens AND NgRx AND its
 * effects all live in a chunk that only an admin ever downloads. That is what keeps the promise in
 * the React app's store comment — Redux costs the 99% of visitors who never open /admin nothing —
 * except that here the boundary is a route rather than a Provider's position in the tree.
 *
 * The customer pages are lazy too, and that is worth a word. In React they are static imports,
 * because a route component there is just a function and code-splitting each one is a deliberate
 * act with a `<Suspense>` cost. In Angular the split is one line per route and the router already
 * handles the wait, so the cheap thing and the right thing are the same thing.
 * ========================================================================== */
export const routes: Routes = [
  {
    path: '',
    title: 'PizzaHub — order pizza',
    loadComponent: () => import('./pages/home/home').then((m) => m.Home),
  },
  {
    path: 'menu',
    title: 'Menu — PizzaHub',
    loadComponent: () => import('./pages/menu/menu-page').then((m) => m.MenuPage),
  },
  {
    path: 'checkout',
    title: 'Checkout — PizzaHub',
    loadComponent: () => import('./pages/checkout/checkout').then((m) => m.Checkout),
  },
  {
    path: 'order-confirmation/:orderId',
    title: 'Order confirmed — PizzaHub',
    loadComponent: () =>
      import('./pages/order-confirmation/order-confirmation').then((m) => m.OrderConfirmation),
  },
  {
    path: 'login',
    title: 'Sign in — PizzaHub',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: 'register',
    title: 'Create an account — PizzaHub',
    loadComponent: () => import('./pages/register/register').then((m) => m.Register),
  },

  // Signed-in customers only.
  {
    path: 'orders',
    title: 'My orders — PizzaHub',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/orders/orders').then((m) => m.Orders),
  },
  {
    path: 'profile',
    title: 'Profile — PizzaHub',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/profile/profile').then((m) => m.Profile),
  },

  /*
   * Signed-in ADMINS only.
   *
   * The guard is on the PARENT, so every admin screen inherits it — a new tab cannot be added
   * unprotected by accident. Same reasoning as guarding the layout route in the React app.
   */
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadChildren: () => import('./admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },

  {
    path: '**',
    title: 'Page not found — PizzaHub',
    loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFound),
  },
];
