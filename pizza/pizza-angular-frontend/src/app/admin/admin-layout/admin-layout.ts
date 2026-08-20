import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/**
 * Shell for every admin screen.
 *
 * <p>A LAYOUT ROUTE: `<router-outlet />` is where the matched child renders, so the heading and
 * tabs are written once instead of being repeated on six pages — and switching tabs never
 * re-creates the shell.
 *
 * <p>That last part is what lets the reports feature hand back a cached dashboard instead of
 * showing a spinner again: the store is provided at this route, so it lives exactly as long as the
 * shell does.
 */
@Component({
  selector: 'app-admin-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="container py-4">
      <h1 class="h3 fw-bold mb-1">Admin</h1>
      <p class="text-muted">Menu management and reporting.</p>

      <ul class="nav nav-tabs mb-4 admin-nav">
        @for (tab of tabs; track tab.path) {
          <li class="nav-item">
            <a
              class="nav-link"
              [routerLink]="tab.path"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: tab.exact }"
            >
              {{ tab.label }}
            </a>
          </li>
        }
      </ul>

      <router-outlet />
    </div>
  `,
})
export class AdminLayout {
  readonly tabs = [
    { path: '/admin', label: 'Reports', exact: true },
    { path: '/admin/products', label: 'Products', exact: false },
    { path: '/admin/toppings', label: 'Toppings', exact: false },
    { path: '/admin/crusts', label: 'Crusts', exact: false },
    { path: '/admin/orders', label: 'Orders', exact: false },
    { path: '/admin/users', label: 'Users', exact: false },
  ];
}
