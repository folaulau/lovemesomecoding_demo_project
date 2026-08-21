/** The write side of the admin console — every staff action that changes something.
 *
 * Reads come from Hasura as the `staff` role (see lib/apollo.ts). This file only ever POSTs.
 */

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'
const TOKEN_KEY = 'stayhub.admin.token'

// ⚠️ A DIFFERENT storage key from the customer app. Both run on localhost, and localStorage is
// scoped to the ORIGIN — not the port — so a shared key means signing into one app silently
// swaps the identity in the other. It is a development-only collision, and a genuinely confusing
// one: the customer site suddenly acts as staff.
export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set: (token: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      /* ignore */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* ignore */
    }
  },
}

export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: Record<string, string>

  constructor(status: number, body: { message: string; fieldErrors?: Record<string, string> }) {
    super(body.message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = body.fieldErrors ?? {}
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = tokenStore.get()
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${BASE}${path}`, { ...init, headers })
  const raw = await response.text()
  const parsed = raw ? JSON.parse(raw) : null

  if (!response.ok) {
    throw new ApiError(response.status, parsed ?? { message: response.statusText })
  }
  return parsed as T
}

export interface AdminUser {
  publicId: string
  email: string
  firstName: string
  lastName: string
  fullName: string
  role: 'CUSTOMER' | 'ADMIN'
  isHost: boolean
  createdAt: string
}

export interface AdminStats {
  totalUsers: number
  totalHosts: number
  totalProperties: number
  publishedProperties: number
  totalBookings: number
  confirmedBookings: number
  cancelledBookings: number
  grossBookingsValue: number
}

export const adminApi = {
  login: (email: string, password: string) =>
    request<{ accessToken: string; user: AdminUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<AdminUser>('/auth/me'),

  stats: () => request<AdminStats>('/admin/stats'),

  suspendProperty: (publicId: string) =>
    request<unknown>(`/admin/properties/${publicId}/suspend`, { method: 'POST' }),

  unsuspendProperty: (publicId: string) =>
    request<unknown>(`/admin/properties/${publicId}/unsuspend`, { method: 'POST' }),

  deactivateUser: (publicId: string) =>
    request<{ message: string }>(`/admin/users/${publicId}/deactivate`, { method: 'POST' }),

  reindex: () => request<{ message: string }>('/admin/search/reindex', { method: 'POST' }),
}
