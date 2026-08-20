import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import type { Address, AddressWriteRequest, PaymentMethod, UUID } from './models';

/**
 * The signed-in customer's own profile.
 *
 * <p>Every route is /api/me/** — the server resolves the owner from the token, so there is no user
 * id to pass (or to tamper with). A foreign-owned resource returns 404 rather than 403, because a
 * 403 would confirm that the id exists.
 */
@Injectable({ providedIn: 'root' })
export class ProfileApiService {
  private readonly api = inject(ApiService);

  // ---- addresses ----
  listAddresses = () => this.api.get<Address[]>('/api/me/addresses');
  addAddress = (body: AddressWriteRequest) => this.api.post<Address>('/api/me/addresses', body);
  updateAddress = (id: UUID, body: AddressWriteRequest) =>
    this.api.put<Address>(`/api/me/addresses/${id}`, body);
  makeAddressPrimary = (id: UUID) => this.api.patch<Address>(`/api/me/addresses/${id}/primary`);
  deleteAddress = (id: UUID) => this.api.delete<void>(`/api/me/addresses/${id}`);

  // ---- payment methods ----
  listPaymentMethods = () => this.api.get<PaymentMethod[]>('/api/me/payment-methods');
  /** Opens a Stripe SetupIntent so a card can be collected without being charged. */
  createSetupIntent = () =>
    this.api.post<{ clientSecret: string }>('/api/me/payment-methods/setup-intent');
  /** Saves a card the BROWSER already collected. Only the pm_… token is sent. */
  addPaymentMethod = (stripePaymentMethodId: string) =>
    this.api.post<PaymentMethod>('/api/me/payment-methods', { stripePaymentMethodId });
  makePaymentMethodPrimary = (id: UUID) =>
    this.api.patch<PaymentMethod>(`/api/me/payment-methods/${id}/primary`);
  deletePaymentMethod = (id: UUID) => this.api.delete<void>(`/api/me/payment-methods/${id}`);
}
