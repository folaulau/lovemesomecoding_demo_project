import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import { MoneyPipe, humanise } from '../../core/money.pipe';
import { CartService } from '../../core/cart.service';
import { lineTotal, unitPrice } from '../../core/money';
import type { CartItem, OrderType } from '../../core/models';

/**
 * The cart, in a Bootstrap offcanvas (a slide-in drawer).
 *
 * <p>react-bootstrap's `<Offcanvas>` supplies the backdrop, the escape key and focus trapping.
 * Angular has no such component, so the markup below is Bootstrap's own and the `.show` class is
 * toggled here — see the note in `Modal` for why that is preferred over driving Bootstrap's
 * JavaScript from a declarative template.
 *
 * <p>What that trade costs, honestly: focus is not trapped inside the drawer. Bootstrap's CSS does
 * not do that; its JavaScript does. Escape and the backdrop click are wired up below, but a
 * production build should either add a focus trap or use a `<dialog>` element, which gets one from
 * the platform.
 */
@Component({
  selector: 'app-cart-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MoneyPipe],
  templateUrl: './cart-drawer.html',
})
export class CartDrawer {
  private readonly cart = inject(CartService);
  private readonly router = inject(Router);

  readonly open = input(false);
  readonly closed = output<void>();

  readonly items = this.cart.items;
  readonly totals = this.cart.totals;
  readonly orderType = this.cart.orderType;

  setOrderType(orderType: OrderType): void {
    this.cart.setOrderType(orderType);
  }

  setQuantity(lineId: string, quantity: number): void {
    this.cart.setQuantity(lineId, quantity);
  }

  removeItem(lineId: string): void {
    this.cart.removeItem(lineId);
  }

  /** Per-line money, exposed to the template. Both are pure functions shared with the React app. */
  unit(item: CartItem): number {
    return unitPrice(item);
  }

  line(item: CartItem): number {
    return lineTotal(item);
  }

  describe(item: CartItem): string {
    return humanise(item.size) + (item.crustName ? ` · ${item.crustName}` : '');
  }

  goToCheckout(): void {
    this.closed.emit();
    void this.router.navigate(['/checkout']);
  }
}
