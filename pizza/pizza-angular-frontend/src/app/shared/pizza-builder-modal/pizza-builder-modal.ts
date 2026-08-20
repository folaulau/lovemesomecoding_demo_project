import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { Modal } from '../modal/modal';
import { MoneyPipe, humanise } from '../../core/money.pipe';
import { round2 } from '../../core/money';
import { CartService } from '../../core/cart.service';
import { MenuService } from '../../core/menu.service';
import { ToastService } from '../../core/toast.service';
import type { Product, SizeName, Topping, ToppingCategory } from '../../core/models';

const TOPPING_GROUPS: Array<{ label: string; category: ToppingCategory }> = [
  { label: 'Meats', category: 'MEAT' },
  { label: 'Veggies', category: 'VEGGIE' },
  { label: 'Cheeses', category: 'CHEESE' },
];

/**
 * The pizza builder: pick a size, a crust and toppings, and watch the price update live.
 *
 * <p>Drinks reuse this same modal but only get the size step — one component rather than two
 * near-identical ones.
 */
@Component({
  selector: 'app-pizza-builder-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Modal, MoneyPipe],
  templateUrl: './pizza-builder-modal.html',
})
export class PizzaBuilderModal {
  private readonly menu = inject(MenuService);
  private readonly cart = inject(CartService);
  private readonly toast = inject(ToastService);

  /** `null` means the modal is closed. One piece of state, not two. */
  readonly product = input<Product | null>(null);
  readonly closed = output<void>();

  readonly crusts = this.menu.crusts;
  readonly toppings = this.menu.toppings;
  readonly groups = TOPPING_GROUPS;

  readonly size = signal<SizeName>('MEDIUM');
  readonly crustId = signal<string | null>(null);
  readonly selectedToppingIds = signal<string[]>([]);
  readonly quantity = signal(1);

  readonly isPizza = computed(() => this.product()?.type === 'PIZZA');

  readonly crust = computed(() =>
    this.isPizza() ? (this.crusts().find((c) => c.id === this.crustId()) ?? null) : null,
  );

  readonly selectedToppings = computed<Topping[]>(() =>
    this.isPizza()
      ? this.toppings().filter((t) => this.selectedToppingIds().includes(t.id))
      : [],
  );

  /*
   * The live price, derived rather than stored.
   *
   * The React version wraps this in `useMemo` with a five-entry dependency array. A `computed`
   * needs no array at all — it re-runs when one of the signals it read has changed, and Angular
   * works out which those are by watching the reads. A dependency array that drifts out of step
   * with the body is a whole category of React bug that simply does not exist here.
   */
  readonly unitPrice = computed(() => {
    const product = this.product();
    if (!product) return 0;

    const base = product.sizes.find((s) => s.size === this.size())?.price ?? 0;
    const toppingsTotal = this.selectedToppings().reduce((sum, t) => sum + t.price, 0);
    return round2(base + (this.crust()?.priceDelta ?? 0) + toppingsTotal);
  });

  readonly totalPrice = computed(() => round2(this.unitPrice() * this.quantity()));

  constructor() {
    /*
     * Reset the form whenever a different product is opened, otherwise the previous pizza's
     * toppings would carry over to the next one. Reading `product()` and `crusts()` is what makes
     * this effect re-run when either changes — the equivalent of React's `[product, crusts]`.
     */
    effect(() => {
      const product = this.product();
      const crusts = this.crusts();
      if (!product) return;

      this.size.set('MEDIUM');
      // Default to the first crust once the catalogue has loaded.
      this.crustId.set(crusts[0]?.id ?? null);
      this.selectedToppingIds.set([]);
      this.quantity.set(1);
    });
  }

  toppingsIn(category: ToppingCategory): Topping[] {
    return this.toppings().filter((t) => t.category === category);
  }

  isSelected(id: string): boolean {
    return this.selectedToppingIds().includes(id);
  }

  toggleTopping(id: string): void {
    this.selectedToppingIds.update((current) =>
      current.includes(id) ? current.filter((t) => t !== id) : [...current, id],
    );
  }

  label(value: string): string {
    return humanise(value);
  }

  add(): void {
    const product = this.product();
    if (!product) return;

    this.cart.addItem({
      product,
      size: this.size(),
      crust: this.crust(),
      toppings: this.selectedToppings(),
      quantity: this.quantity(),
    });

    this.toast.show(`${this.quantity()} × ${product.name} added to your cart`);
    this.closed.emit();
  }
}
