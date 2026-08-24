import { apiClient } from '../client';
import type { CartWriteRequest, ServerCart, UUID } from '@/types';

/**
 * The server-side cart.
 *
 * <p>Note there is no "add one item" endpoint. The whole cart is replaced with a single PUT, which
 * makes the write IDEMPOTENT: sending it twice — as an unreliable mobile connection will — leaves
 * the same cart, whereas two "add item" calls would leave two pizzas.
 */
export const cartApi = {
  create: () => apiClient.post<ServerCart>('/api/carts'),
  get: (cartId: UUID, signal?: AbortSignal) =>
    apiClient.get<ServerCart>(`/api/carts/${cartId}`, { signal }),
  replace: (cartId: UUID, body: CartWriteRequest) =>
    apiClient.put<ServerCart>(`/api/carts/${cartId}`, body),
};
