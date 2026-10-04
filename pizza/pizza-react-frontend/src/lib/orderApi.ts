import { api } from './api';
import type { UUID } from '../types';

/**
 * Order calls beyond placing one.
 *
 * (Placing an order is still the inline `api.post` in CheckoutPage, which is where it has always
 * lived; this module holds what checkout's payment step needs.)
 */
export const orderApi = {
  /**
   * Puts one of the signed-in customer's saved cards on the order's PaymentIntent.
   *
   * Sends OUR card id, never a Stripe token — the browser does not have one. Nothing is charged:
   * the caller still has to confirm the payment with Stripe.js afterwards. Resolves with no value
   * (the server answers 204).
   */
  selectSavedCard: (orderId: UUID, paymentMethodId: UUID) =>
    api.put<void>(`/api/orders/${orderId}/payment-method`, { paymentMethodId }, { auth: true }),
};
