import type { CartItem } from './models';

/*
 * These two constants mirror the backend's own. They exist here only so the cart can show a
 * PREVIEW before an order exists; `PricingService` on the server is the authority, and it ignores
 * anything the browser claims a pizza costs. Keeping them in step is a maintenance cost we accept
 * in exchange for a cart that updates without a round trip on every "+".
 */
export const TAX_RATE = 0.085;
export const DELIVERY_FEE = 3.99;

/** Formats a number as US currency. */
export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/**
 * Price of ONE unit of a cart line: base size price + crust surcharge + toppings.
 *
 * <p>Note the rounding. JavaScript numbers are binary floating point, so 10.99 + 1.5 + 1.75 can
 * land on 14.240000000000002. Rounding to cents at each boundary keeps the displayed totals sane.
 *
 * <p>This is display-only arithmetic. The server recomputes every price from the database when
 * the order is placed and ignores whatever the browser claims — otherwise anyone could edit the
 * request and buy a large pizza for a cent.
 */
export function unitPrice(item: CartItem): number {
  const toppingsTotal = item.toppings.reduce((sum, t) => sum + t.price, 0);
  return round2(item.basePrice + item.crustPriceDelta + toppingsTotal);
}

export function lineTotal(item: CartItem): number {
  return round2(unitPrice(item) * item.quantity);
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface CartTotals {
  subtotal: number;
  tax: number;
  deliveryFee: number;
  total: number;
  itemCount: number;
}

export function calculateTotals(items: CartItem[], orderType: 'DELIVERY' | 'CARRYOUT'): CartTotals {
  const subtotal = round2(items.reduce((sum, item) => sum + lineTotal(item), 0));
  const deliveryFee = orderType === 'DELIVERY' && subtotal > 0 ? DELIVERY_FEE : 0;
  const tax = round2(subtotal * TAX_RATE);

  return {
    subtotal,
    tax,
    deliveryFee,
    total: round2(subtotal + tax + deliveryFee),
    itemCount: items.reduce((count, item) => count + item.quantity, 0),
  };
}
