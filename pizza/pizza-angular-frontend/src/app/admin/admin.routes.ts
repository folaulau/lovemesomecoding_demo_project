import { Routes } from '@angular/router';
import { AdminLayout } from './admin-layout/admin-layout';
import { provideAdminStore } from './store';

/**
 * The admin section.
 *
 * <p>`providers` on a route creates an ENVIRONMENT INJECTOR scoped to that route and everything
 * under it. This is where the NgRx store is registered, which is what keeps it — and its four
 * features, and their effects — inside the lazily-loaded admin chunk. See `store/index.ts`.
 *
 * <p>The guard that protects all of this is on the parent `/admin` route in `app.routes.ts`, so a
 * screen added to this array is protected by default rather than by remembering to protect it.
 */
export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: AdminLayout,
    providers: [provideAdminStore()],
    children: [
      {
        path: '',
        title: 'Reports — PizzaHub admin',
        loadComponent: () => import('./pages/reports/admin-reports').then((m) => m.AdminReports),
      },
      {
        path: 'products',
        title: 'Products — PizzaHub admin',
        loadComponent: () => import('./pages/products/admin-products').then((m) => m.AdminProducts),
      },
      {
        path: 'toppings',
        title: 'Toppings — PizzaHub admin',
        loadComponent: () => import('./pages/toppings/admin-toppings').then((m) => m.AdminToppings),
      },
      {
        path: 'crusts',
        title: 'Crusts — PizzaHub admin',
        loadComponent: () => import('./pages/crusts/admin-crusts').then((m) => m.AdminCrusts),
      },
      {
        path: 'orders',
        title: 'Orders — PizzaHub admin',
        loadComponent: () => import('./pages/orders/admin-orders').then((m) => m.AdminOrders),
      },
      {
        path: 'users',
        title: 'Users — PizzaHub admin',
        loadComponent: () => import('./pages/users/admin-users').then((m) => m.AdminUsers),
      },
    ],
  },
];
