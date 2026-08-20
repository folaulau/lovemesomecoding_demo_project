import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { MenuService } from './menu.service';
import { cartIdStore } from './storage';
import { calculateTotals } from './money';
import type {
  CartItem,
  CartWriteRequest,
  Crust,
  OrderType,
  Product,
  ServerCart,
  SizeName,
  Topping,
} from './models';

export interface AddItemInput {
  product: Product;
  size: SizeName;
  crust: Crust | null;
  toppings: Topping[];
  quantity: number;
}

/**
 * Two cart lines are "the same" only if the product, size, crust AND topping set all match.
 * Without this, adding a plain pepperoni and a pepperoni with extra cheese would collapse into
 * one line and the customer would be charged for the wrong pizza.
 */
function isSameConfiguration(a: CartItem, b: CartItem): boolean {
  if (a.productId !== b.productId || a.size !== b.size || a.crustId !== b.crustId) return false;
  if (a.toppings.length !== b.toppings.length) return false;

  const aIds = a.toppings.map((t) => t.id).sort();
  const bIds = b.toppings.map((t) => t.id).sort();
  return aIds.every((id, index) => id === bIds[index]);
}

/* ==========================================================================
 * The cart — and where Angular and React genuinely differ
 *
 * The React version is `useReducer` inside a Context: every change is an action object, and a pure
 * `cartReducer(state, action)` switch decides the next state. That structure exists because React
 * state updates are batched and often derive from the previous value, and a reducer keeps that
 * logic in one testable function instead of scattered across handlers.
 *
 * Signals do not need the indirection. `signal.update(current => next)` already gives the
 * "derive from the previous value" guarantee, so each operation below is one small method that
 * says what it does. The pure-function testability is kept where it actually earned its place:
 * `isSameConfiguration` and `calculateTotals` are still plain functions with no framework in them.
 *
 * PERSISTENCE is identical in both apps and is the interesting part. The cart lives in the
 * BACKEND, so refreshing the page — or opening a second tab — does not lose the basket. Only the
 * cart's UUID is kept in localStorage; the contents live in the database. The server stores
 * identifiers only and re-prices on every read, so a cart left overnight picks up today's menu
 * rather than quietly honouring yesterday's.
 * ========================================================================== */
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly api = inject(ApiService);
  private readonly menu = inject(MenuService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _items = signal<CartItem[]>([]);
  private readonly _orderType = signal<OrderType>('DELIVERY');
  /** False until the saved cart has been fetched — the badge should not flash "empty" first. */
  private readonly _hydrated = signal(false);

  readonly items = this._items.asReadonly();
  readonly orderType = this._orderType.asReadonly();
  readonly hydrated = this._hydrated.asReadonly();

  /*
   * Totals are derived, never stored — one source of truth. These figures are a PREVIEW: the
   * server recalculates everything when the order is placed, and its numbers are the ones that
   * count. See `PricingService` on the backend, which is the actual security boundary.
   */
  readonly totals = computed(() => calculateTotals(this._items(), this._orderType()));
  readonly itemCount = computed(() => this.totals().itemCount);

  /**
   * A plain field, not a signal.
   *
   * The persist effect needs the CURRENT cart id, but must not re-run when the id is assigned —
   * that would trigger an extra PUT immediately after creating the cart. A signal read inside an
   * effect becomes a dependency; a plain field does not. This is the direct equivalent of the
   * `useRef` the React version uses, and for exactly the same reason.
   */
  private cartId: string | null = cartIdStore.get();

  /** Guards the hydrate effect. A plain field, so setting it cannot re-trigger the effect. */
  private hydrationStarted = false;

  constructor() {
    this.hydrateOnce();
    this.persistOnChange();
  }

  /* -------------------------------------------------------------- 1. hydrate */

  private hydrateOnce(): void {
    /*
     * ANGULAR CONCEPT: effect()
     *
     * An effect re-runs whenever a signal it READ last time changes. There is no dependency array:
     * reading `menu.loading()` below is what subscribes this to it. That is the whole API.
     *
     * This one waits for the menu, because a saved line stores only ids — the price and the crust
     * surcharge have to be rebuilt from the catalogue.
     */
    const ref = effect(() => {
      if (this.menu.loading()) return;

      // Read the catalogue now, while inside the reactive context, then leave it.
      const products = this.menu.products();
      const crusts = this.menu.crusts();

      /*
       * The guard is a plain FIELD, not the `hydrated` signal. Reading a signal inside an effect
       * subscribes to it, so guarding on `_hydrated()` and then setting it would schedule the
       * effect to run a second time only to discover it has nothing left to do.
       */
      if (this.hydrationStarted) return;
      this.hydrationStarted = true;

      if (!this.cartId) {
        this._hydrated.set(true);
        return;
      }

      void this.loadSavedCart(this.cartId, products, crusts).finally(() =>
        // Only NOW may the persist effect write. Flipping this before the saved cart has landed
        // would let an empty cart be written over the stored one — the bug this flag exists for.
        this._hydrated.set(true),
      );
    });

    // Effects created in a constructor are cleaned up with the injector, but being explicit about
    // it keeps the lifetime obvious to a reader.
    this.destroyRef.onDestroy(() => ref.destroy());
  }

  private async loadSavedCart(cartId: string, products: Product[], crusts: Crust[]): Promise<void> {
    try {
      const cart = await firstValueFrom(this.api.get<ServerCart>(`/api/carts/${cartId}`));

      this._items.set(
        cart.items.map((line) => {
          const product = products.find((p) => p.id === line.productId);
          const crust = crusts.find((c) => c.id === line.crustId);

          return {
            // A fresh browser-only key; the server's line id is not reused because a line's
            // identity here is "this configuration", not a database row.
            lineId: crypto.randomUUID(),
            productId: line.productId,
            productName: line.productName,
            productType: line.productType,
            imageUrl: product?.imageUrl ?? null,
            size: line.size,
            basePrice: product?.sizes.find((s) => s.size === line.size)?.price ?? 0,
            crustId: line.crustId,
            crustName: line.crustName,
            crustPriceDelta: crust?.priceDelta ?? 0,
            toppings: line.toppings.map((t) => ({
              id: t.toppingId,
              name: t.toppingName,
              price: t.price,
              // Not stored on a cart line; only the id, name and price are needed to re-price.
              category: 'MEAT' as const,
              active: true,
            })),
            quantity: line.quantity,
          };
        }),
      );

      this._orderType.set(cart.orderType);
    } catch {
      // The saved cart is gone (deleted, or a stale id from another environment). Forget it rather
      // than leaving the browser pointing at a cart that will never load.
      cartIdStore.clear();
      this.cartId = null;
    }
  }

  /* -------------------------------------------------------------- 2. persist */

  private persistOnChange(): void {
    const ref = effect((onCleanup) => {
      // Reading these three is what subscribes the effect to them.
      const items = this._items();
      const orderType = this._orderType();
      const hydrated = this._hydrated();

      // Never write before hydrating — that would overwrite the saved cart with an empty one.
      if (!hydrated) return;

      /*
       * Debounced: clicking "+" three times quickly is one write, not three.
       *
       * `onCleanup` runs before the NEXT run of this effect (and on destroy), so a change arriving
       * inside the 300 ms window cancels the pending write rather than queueing a second one. It
       * is the return-a-function cleanup of a React `useEffect`, under a different name.
       */
      const timer = setTimeout(() => void this.save(items, orderType), 300);
      onCleanup(() => clearTimeout(timer));
    });

    this.destroyRef.onDestroy(() => ref.destroy());
  }

  private async save(items: CartItem[], orderType: OrderType): Promise<void> {
    try {
      if (!this.cartId) {
        // Do not create a cart row just because someone loaded the home page.
        if (items.length === 0) return;
        const created = await firstValueFrom(this.api.post<ServerCart>('/api/carts'));
        this.cartId = created.id;
        cartIdStore.set(created.id);
      }

      const body: CartWriteRequest = {
        orderType,
        items: items.map((item) => ({
          productId: item.productId,
          size: item.size,
          crustId: item.crustId,
          toppingIds: item.toppings.map((t) => t.id),
          quantity: item.quantity,
        })),
      };

      await firstValueFrom(this.api.put<ServerCart>(`/api/carts/${this.cartId}`, body));
    } catch {
      // A failed save must not break the page. The cart still works in this tab; it just will not
      // survive a refresh. Surfacing a toast on every keystroke would be worse.
    }
  }

  /* -------------------------------------------------------------- operations */

  addItem(input: AddItemInput): void {
    const basePrice = input.product.sizes.find((s) => s.size === input.size)?.price ?? 0;

    const line: CartItem = {
      // crypto.randomUUID is built into modern browsers — no library needed.
      lineId: crypto.randomUUID(),
      productId: input.product.id,
      productName: input.product.name,
      productType: input.product.type,
      imageUrl: input.product.imageUrl,
      size: input.size,
      basePrice,
      crustId: input.crust?.id ?? null,
      crustName: input.crust?.name ?? null,
      crustPriceDelta: input.crust?.priceDelta ?? 0,
      toppings: input.toppings,
      quantity: input.quantity,
    };

    this._items.update((current) => {
      const existing = current.find((item) => isSameConfiguration(item, line));

      // Same configuration already in the cart: bump the quantity instead of adding a line.
      if (existing) {
        return current.map((item) =>
          item.lineId === existing.lineId
            ? { ...item, quantity: item.quantity + line.quantity }
            : item,
        );
      }

      return [...current, line];
    });
  }

  removeItem(lineId: string): void {
    this._items.update((current) => current.filter((item) => item.lineId !== lineId));
  }

  setQuantity(lineId: string, quantity: number): void {
    // Dropping to zero removes the line — it is what a user expects from a "−" button.
    if (quantity <= 0) {
      this.removeItem(lineId);
      return;
    }

    this._items.update((current) =>
      current.map((item) => (item.lineId === lineId ? { ...item, quantity } : item)),
    );
  }

  setOrderType(orderType: OrderType): void {
    this._orderType.set(orderType);
  }

  clear(): void {
    this._items.set([]);
  }
}
