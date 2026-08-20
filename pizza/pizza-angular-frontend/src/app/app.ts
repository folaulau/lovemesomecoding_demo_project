import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppNavbar } from './shared/app-navbar/app-navbar';
import { AppFooter } from './shared/app-footer/app-footer';
import { CartDrawer } from './shared/cart-drawer/cart-drawer';
import { ToastHost } from './shared/toast-host/toast-host';

/**
 * The app shell: navbar, the routed page, the cart drawer, the footer and the toast host.
 *
 * <p>`<router-outlet />` is where the matched route renders — React Router's `<Routes>`.
 *
 * <p>The drawer's open/closed state lives HERE because both the navbar (which opens it) and the
 * drawer itself need it, and nothing else does. The cart CONTENTS are in a root service; this one
 * piece of purely visual state is not worth putting there. Same call the React app makes, for the
 * same reason.
 */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, AppNavbar, AppFooter, CartDrawer, ToastHost],
  template: `
    <div class="d-flex flex-column min-vh-100">
      <app-navbar (openCart)="cartOpen.set(true)" />

      <main class="flex-grow-1">
        <router-outlet />
      </main>

      <app-cart-drawer [open]="cartOpen()" (closed)="cartOpen.set(false)" />
      <app-footer />
      <app-toast-host />
    </div>
  `,
})
export class App {
  readonly cartOpen = signal(false);
}
