import type { PaymentMethod } from '../types';

/**
 * Whether a saved card had expired by `now`.
 *
 * The same rule as the server's `UserPaymentMethod.isExpiredAt`: a card is valid THROUGH its
 * expiry month, so "12/2026" still works on 31 December 2026. A card with no expiry recorded
 * counts as not expired — Stripe always reports one for a card, and it decides at charge time
 * anyway.
 *
 * This only decides what the checkout greys out. The server repeats the check and is the one that
 * refuses, so a browser clock that is a few hours off at a month boundary cannot let an expired
 * card through.
 */
export function isCardExpired(
  card: Pick<PaymentMethod, 'expMonth' | 'expYear'>,
  now: Date = new Date(),
): boolean {
  if (card.expMonth == null || card.expYear == null) return false;

  // getMonth() is 0-based; expMonth is 1-based, as Stripe reports it.
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  return card.expYear < currentYear || (card.expYear === currentYear && card.expMonth < currentMonth);
}

/**
 * "Visa ••4242" — how a saved card is named on buttons and in lists.
 *
 * Stripe reports the brand in lower case ("visa", "mastercard"), so it is capitalised here. Either
 * field can in principle be null, and the label must never read "null ••null".
 */
export function cardLabel(card: Pick<PaymentMethod, 'brand' | 'last4'>): string {
  const brand = card.brand ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1) : 'Card';
  return card.last4 ? `${brand} ••${card.last4}` : brand;
}
