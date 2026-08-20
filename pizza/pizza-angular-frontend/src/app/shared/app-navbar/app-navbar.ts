import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { CartService } from '../../core/cart.service';

/**
 * Top navigation.
 *
 * <p>Reads the cart badge straight from the injected service — no input, no prop drilling. The
 * navbar is nowhere near the menu page in the component tree, yet it stays in sync automatically,
 * which is the entire reason `CartService` is a root singleton.
 *
 * <p>`routerLinkActive` adds a class when the link's route is active, so the current section can be
 * highlighted without comparing to the URL by hand — React Router's `NavLink` `isActive` flag.
 * `[routerLinkActiveOptions]="{ exact: true }"` is Angular's spelling of that component's `end`.
 */
@Component({
  selector: 'app-navbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './app-navbar.html',
})
export class AppNavbar {
  private readonly auth = inject(AuthService);
  private readonly cart = inject(CartService);

  readonly openCart = output<void>();

  readonly itemCount = this.cart.itemCount;
  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly isAdmin = this.auth.isAdmin;
  readonly displayName = this.auth.displayName;

  /*
   * Purely visual state, held right where it is used.
   *
   * Bootstrap's collapse and dropdown are normally driven by its JavaScript through
   * `data-bs-toggle` attributes. Two booleans and a class binding do the same job declaratively,
   * and mean the template is the only description of what is open.
   */
  readonly navOpen = signal(false);
  readonly accountOpen = signal(false);

  toggleNav(): void {
    this.navOpen.update((open) => !open);
  }

  toggleAccount(): void {
    this.accountOpen.update((open) => !open);
  }

  /** Collapse everything after a navigation, so the menu does not stay open over the new page. */
  closeMenus(): void {
    this.navOpen.set(false);
    this.accountOpen.set(false);
  }

  logout(): void {
    this.auth.logout();
    this.closeMenus();
  }
}
