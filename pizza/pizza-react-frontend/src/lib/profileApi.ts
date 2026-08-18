import { api } from './api';
import type { Address, AddressWriteRequest, PaymentMethod, UUID } from '../types';

/**
 * The signed-in customer's own profile.
 *
 * Every route is /api/me/** — the server resolves the owner from the token, so there is no user id
 * to pass (or to tamper with).
 */
export const profileApi = {
  // ---- addresses ----
  listAddresses: () => api.get<Address[]>('/api/me/addresses', { auth: true }),
  addAddress: (body: AddressWriteRequest) =>
    api.post<Address>('/api/me/addresses', body, { auth: true }),
  updateAddress: (id: UUID, body: AddressWriteRequest) =>
    api.put<Address>(`/api/me/addresses/${id}`, body, { auth: true }),
  makeAddressPrimary: (id: UUID) =>
    api.patch<Address>(`/api/me/addresses/${id}/primary`, undefined, { auth: true }),
  deleteAddress: (id: UUID) => api.delete<void>(`/api/me/addresses/${id}`, { auth: true }),

  // ---- payment methods ----
  listPaymentMethods: () => api.get<PaymentMethod[]>('/api/me/payment-methods', { auth: true }),
  /** Opens a Stripe SetupIntent so a card can be collected without being charged. */
  createSetupIntent: () =>
    api.post<{ clientSecret: string }>('/api/me/payment-methods/setup-intent', undefined, {
      auth: true,
    }),
  /** Saves a card the BROWSER already collected. Only the pm_… token is sent. */
  addPaymentMethod: (stripePaymentMethodId: string) =>
    api.post<PaymentMethod>('/api/me/payment-methods', { stripePaymentMethodId }, { auth: true }),
  makePaymentMethodPrimary: (id: UUID) =>
    api.patch<PaymentMethod>(`/api/me/payment-methods/${id}/primary`, undefined, { auth: true }),
  deletePaymentMethod: (id: UUID) =>
    api.delete<void>(`/api/me/payment-methods/${id}`, { auth: true }),
};
