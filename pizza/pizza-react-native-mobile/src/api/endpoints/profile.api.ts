import { apiClient } from '../client';
import type { Address, AddressWriteRequest, PaymentMethod, UUID } from '@/types';

/**
 * The signed-in customer's own profile.
 *
 * <p>Every route is `/api/me/**` — the server resolves the owner from the token, so there is no
 * user id to pass (or to tamper with). Asking for someone else's address returns 404, not 403,
 * because 403 would confirm the id exists.
 */
export const profileApi = {
  listAddresses: (signal?: AbortSignal) =>
    apiClient.get<Address[]>('/api/me/addresses', { auth: true, signal }),
  addAddress: (body: AddressWriteRequest) =>
    apiClient.post<Address>('/api/me/addresses', body, { auth: true }),
  updateAddress: (id: UUID, body: AddressWriteRequest) =>
    apiClient.put<Address>(`/api/me/addresses/${id}`, body, { auth: true }),
  makeAddressPrimary: (id: UUID) =>
    apiClient.patch<Address>(`/api/me/addresses/${id}/primary`, undefined, { auth: true }),
  deleteAddress: (id: UUID) => apiClient.delete<void>(`/api/me/addresses/${id}`, { auth: true }),

  listPaymentMethods: (signal?: AbortSignal) =>
    apiClient.get<PaymentMethod[]>('/api/me/payment-methods', { auth: true, signal }),
  /** Opens a Stripe SetupIntent so a card can be collected without being charged. */
  createSetupIntent: () =>
    apiClient.post<{ clientSecret: string }>('/api/me/payment-methods/setup-intent', undefined, {
      auth: true,
    }),
  /** Saves a card the DEVICE already collected. Only the opaque pm_… token is sent. */
  addPaymentMethod: (stripePaymentMethodId: string) =>
    apiClient.post<PaymentMethod>(
      '/api/me/payment-methods',
      { stripePaymentMethodId },
      { auth: true },
    ),
  makePaymentMethodPrimary: (id: UUID) =>
    apiClient.patch<PaymentMethod>(`/api/me/payment-methods/${id}/primary`, undefined, {
      auth: true,
    }),
  deletePaymentMethod: (id: UUID) =>
    apiClient.delete<void>(`/api/me/payment-methods/${id}`, { auth: true }),
};
