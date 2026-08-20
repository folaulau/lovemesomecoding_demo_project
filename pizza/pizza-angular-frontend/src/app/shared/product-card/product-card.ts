import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MoneyPipe } from '../../core/money.pipe';
import type { Product } from '../../core/models';

/* ==========================================================================
 * ANGULAR CONCEPT: OnPush is the built-in React.memo
 *
 * The React version of this card is wrapped in `React.memo`, and the menu page has to wrap its
 * `onSelect` handler in `useCallback` for the memo to hit at all — an inline arrow would be a new
 * function identity on every render and the comparison would never succeed.
 *
 * `ChangeDetectionStrategy.OnPush` gets the same result without either. Angular re-checks this
 * component only when an input reference changes or a signal it read changes; a handler bound with
 * `(selected)="…"` in the parent is not an input, so it cannot invalidate anything. There is no
 * `useCallback` in Angular because there is nothing for it to fix.
 *
 * The other half of the React comment still applies to both: do not reach for this by default. It
 * is worth it for components that are numerous, expensive, or both. Fourteen of these render on
 * the menu page, which qualifies.
 * ========================================================================== */
@Component({
  selector: 'app-product-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MoneyPipe],
  template: `
    <div class="card product-card">
      <div class="product-thumb" aria-hidden="true">{{ isPizza() ? '🍕' : '🥤' }}</div>
      <div class="card-body d-flex flex-column">
        <h3 class="card-title h6 fw-bold mb-1">{{ product().name }}</h3>
        <p class="card-text text-muted small flex-grow-1">{{ product().description }}</p>
        <div class="d-flex justify-content-between align-items-center mt-2">
          <span class="fw-bold">
            from <span class="text-pizza-red">{{ cheapest() | money }}</span>
          </span>
          <button type="button" class="btn btn-sm btn-primary" (click)="selected.emit(product())">
            {{ isPizza() ? 'Build it' : 'Add' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ProductCard {
  /** `input.required` makes a missing binding a COMPILE error, not an undefined at runtime. */
  readonly product = input.required<Product>();
  readonly selected = output<Product>();

  readonly isPizza = computed(() => this.product().type === 'PIZZA');
  readonly cheapest = computed(() => Math.min(...this.product().sizes.map((s) => s.price)));
}
