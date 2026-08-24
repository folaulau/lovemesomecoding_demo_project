import type { UUID } from './common';

export type UserRole = 'CUSTOMER' | 'ADMIN';

export interface User {
  id: UUID;
  email: string;
  fullName: string | null;
  role: UserRole;
  createdAt: string;
}

export interface AuthenticationResponse {
  token: string;
  expiresInMinutes: number;
  user: User;
}

export interface Address {
  id: UUID;
  label: string | null;
  recipientName: string | null;
  phone: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  primary: boolean;
}

export interface AddressWriteRequest {
  label?: string;
  recipientName?: string;
  phone?: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  primary?: boolean;
}

/**
 * A saved card as the app sees it.
 *
 * <p>Display metadata only — no card number, no CVC, and not even the Stripe token: the device has
 * no use for it, since only the server can charge with it.
 */
export interface PaymentMethod {
  id: UUID;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  primary: boolean;
}
