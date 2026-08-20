import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MenuService } from '../../core/menu.service';
import { ProductCard } from '../../shared/product-card/product-card';
import { PizzaBuilderModal } from '../../shared/pizza-builder-modal/pizza-builder-modal';
import { Spinner } from '../../shared/spinner/spinner';
import type { Product, ProductType } from '../../core/models';

type Filter = 'ALL' | ProductType;

@Component({
  selector: 'app-menu-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProductCard, PizzaBuilderModal, Spinner],
  templateUrl: './menu-page.html',
})
export class MenuPage {
  private readonly menu = inject(MenuService);
  private readonly router = inject(Router);

  /* ==========================================================================
   * ANGULAR CONCEPT: a query parameter bound straight to an input
   *
   * `withComponentInputBinding()` in app.config.ts makes the router assign matching route params
   * and query params to `input()`s on the routed component. `?type=PIZZA` arrives here as a signal
   * with no `ActivatedRoute` injected and no subscription to clean up — the tidiest form of React
   * Router's `useSearchParams`.
   *
   * The filter lives in the URL rather than in component state on purpose, in both apps:
   * /menu?type=PIZZA is then shareable, bookmarkable, and survives a refresh. Treating the URL as
   * state is usually the right call for anything a user might want to link to.
   * ========================================================================== */
  readonly type = input<Filter | undefined>(undefined);

  readonly filters: Array<{ key: Filter; label: string }> = [
    { key: 'ALL', label: 'Everything' },
    { key: 'PIZZA', label: 'Pizzas' },
    { key: 'DRINK', label: 'Drinks' },
  ];

  readonly activeFilter = computed<Filter>(() => this.type() ?? 'ALL');

  readonly loading = this.menu.loading;
  readonly error = this.menu.error;

  readonly visibleProducts = computed(() => {
    const filter = this.activeFilter();
    const products = this.menu.products();
    return filter === 'ALL' ? products : products.filter((p) => p.type === filter);
  });

  /** `null` means the builder is closed. One piece of state, not two. */
  readonly selectedProduct = signal<Product | null>(null);

  applyFilter(filter: Filter): void {
    void this.router.navigate(['/menu'], {
      queryParams: filter === 'ALL' ? {} : { type: filter },
    });
  }

  reload(): void {
    this.menu.reload();
  }
}
