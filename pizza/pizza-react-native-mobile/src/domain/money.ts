import type { CartItem, OrderType } from '@/types';

/**
 * Money arithmetic, kept pure.
 *
 * <p>Nothing in this file imports React or React Native, which is the point: it is the part of the
 * app that can be unit-tested without rendering anything, and the part most worth testing.
 *
 * <p>⚠️ Everything here is a PREVIEW. The server recomputes every price from the database when the
 * order is placed and ignores whatever the device claims — otherwise anyone could patch the app
 * and buy a large pizza for a cent. `PricingService` on the backend is the security boundary; this
 * is just so the customer sees a number before they commit.
 */

export const TAX_RATE = 0.085;
export const DELIVERY_FEE = 3.99;

/**
 * Rounds to cents.
 *
 * <p>JavaScript numbers are binary floating point, so 13.99 + 1.5 + 1.75 lands on
 * 17.240000000000002. Rounding at each boundary keeps displayed totals sane. Adding
 * `Number.EPSILON` first fixes the case where the true value is a hair BELOW the .005 boundary and
 * would otherwise round down.
 */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Formats a number as US currency.
 *
 * <p>Hermes ships a full ICU-backed `Intl` on both platforms now, so this works on device exactly
 * as it does in a browser. The fallback exists because that was NOT always true — an older Hermes
 * without Intl throws here, and a crash while rendering a price is a spectacularly bad failure for
 * a shopping app.
 */
export function formatMoney(amount: number): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  } catch {
    return `$${round2(amount).toFixed(2)}`;
  }
}

/** Price of ONE unit of a cart line: base size price + crust surcharge + toppings. */
export function unitPrice(item: CartItem): number {
  const toppingsTotal = item.toppings.reduce((sum, topping) => sum + topping.price, 0);
  return round2(item.basePrice + item.crustPriceDelta + toppingsTotal);
}

export function lineTotal(item: CartItem): number {
  return round2(unitPrice(item) * item.quantity);
}

export interface CartTotals {
  subtotal: number;
  tax: number;
  deliveryFee: number;
  total: number;
  itemCount: number;
}

export function calculateTotals(items: CartItem[], orderType: OrderType): CartTotals {
  const subtotal = round2(items.reduce((sum, item) => sum + lineTotal(item), 0));
  // Pickup has no delivery fee, and neither does an empty cart — a $3.99 "total" would be absurd.
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
