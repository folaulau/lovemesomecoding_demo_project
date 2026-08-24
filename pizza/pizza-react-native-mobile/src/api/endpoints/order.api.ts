import { apiClient } from '../client';
import type { Order, OrderCreateRequest, OrderCreateResponse, Page, UUID } from '@/types';

export const orderApi = {
  /**
   * Places the order and opens a Stripe PaymentIntent.
   *
   * <p>`authenticated` is a parameter rather than a constant because this same call serves guests.
   * When a token is sent the order is attached to the account; when it is not, `guestEmail` is how
   * the customer gets their receipt.
   */
  create: (body: OrderCreateRequest, authenticated: boolean) =>
    apiClient.post<OrderCreateResponse>('/api/orders', body, { auth: authenticated }),

  /**
   * Asks the SERVER whether the payment settled.
   *
   * <p>Deliberately not "mark this order paid". The device is never the authority on money: this
   * endpoint checks with Stripe and reports what Stripe says. Anyone can call our API.
   */
  paymentStatus: (orderId: UUID, signal?: AbortSignal) =>
    apiClient.get<Order>(`/api/orders/${orderId}/payment-status`, { signal }),

  /** The signed-in customer's own orders. `/mine` — the server resolves the owner from the token. */
  listMine: (page = 0, size = 20, signal?: AbortSignal) =>
    apiClient.get<Page<Order>>(`/api/orders/mine?page=${page}&size=${size}`, {
      auth: true,
      signal,
    }),
};
