import { apiClient } from '../client';
import type { AuthenticationResponse, User } from '@/types';

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<AuthenticationResponse>('/api/auth/login', { email, password }),

  /**
   * Registration.
   *
   * <p>There is no `role` field, and adding one would achieve nothing: the server always creates a
   * CUSTOMER. Role can never come from a request body — that is a security boundary, not an
   * omission.
   */
  register: (email: string, password: string, fullName: string) =>
    apiClient.post<AuthenticationResponse>('/api/auth/register', { email, password, fullName }),

  /** Validates a stored token against the API. A token that no longer works is not a session. */
  me: (signal?: AbortSignal) => apiClient.get<User>('/api/auth/me', { auth: true, signal }),
};
