/** The ONLY module that calls `fetch` against FastAPI.
 *
 * Every write in StayHub goes through here; reads go through Apollo/Hasura instead (see
 * lib/apollo.ts), with one exception — search, which is a REST call because it queries
 * Elasticsearch rather than Postgres.
 *
 * Keeping fetch in one file means the token header, the error shape and the base URL are decided
 * once. A component that calls fetch directly is a component that will forget one of them.
 */

import type {
  ApiErrorBody,
  AuthResponse,
  AvailabilityResponse,
  Booking,
  Amenity,
  PaymentIntentResponse,
  PriceBreakdown,
  Property,
  SearchResponse,
  User,
} from '../types'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'
const TOKEN_KEY = 'stayhub.token'

/** An API failure, carrying the per-field messages a form needs.
 *
 * A plain `Error` loses `fieldErrors`, and every form then has to re-derive which input was wrong
 * from a sentence written for a human.
 */
export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: Record<string, string>

  constructor(status: number, body: ApiErrorBody) {
    super(body.message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = body.fieldErrors ?? {}
  }

  /** The message for one field, if the server blamed it. */
  fieldError(name: string): string | undefined {
    return this.fieldErrors[name]
  }
}

export const tokenStore = {
  get: (): string | null => {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      // Safari in private mode throws on localStorage rather than returning null. Treat an
      // unreadable store as "signed out" instead of crashing the whole app on boot.
      return null
    }
  },
  set: (token: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      /* nothing we can do; the session simply will not survive a reload */
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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = tokenStore.get()
  const headers = new Headers(init.headers)
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${BASE}${path}`, { ...init, headers })

  if (response.status === 204) return undefined as T

  // ⚠️ Read the body ONCE. A Response body is a stream and can only be consumed a single time —
  // calling .json() after .text() throws "body stream already read", which looks like a network
  // fault rather than a bug here.
  const raw = await response.text()
  const parsed = raw ? safeParse(raw) : null

  if (!response.ok) {
    throw new ApiError(
      response.status,
      (parsed as ApiErrorBody) ?? { message: response.statusText, fieldErrors: {} },
    )
  }
  return parsed as T
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return { message: raw, fieldErrors: {} }
  }
}

const get = <T>(path: string) => request<T>(path)
const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })
const patch = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'PATCH', body: JSON.stringify(body) })
const del = <T>(path: string) => request<T>(path, { method: 'DELETE' })

// --------------------------------------------------------------------------- auth

export const authApi = {
  register: (payload: {
    email: string
    password: string
    firstName: string
    lastName: string
    becomeHost?: boolean
  }) => post<AuthResponse>('/auth/register', payload),

  login: (email: string, password: string) => post<AuthResponse>('/auth/login', { email, password }),

  me: () => get<User>('/auth/me'),

  /** Returns a NEW token — the old one does not carry the `host` Hasura role. Storing the new
   *  one is not optional; skip it and every /hosts GraphQL query is denied. */
  becomeHost: (hostBio?: string) => post<AuthResponse>('/auth/become-host', { hostBio }),
}

// ------------------------------------------------------------------------- search

export interface SearchParams {
  q?: string
  guests?: number
  minPrice?: number
  maxPrice?: number
  propertyType?: string
  roomType?: string
  amenities?: string[]
  sort?: string
  page?: number
  pageSize?: number
}

export const searchApi = {
  search: (params: SearchParams) => {
    const qs = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === '' || value === null) continue
      // Amenities repeat the key — ?amenities=wifi&amenities=pool — which is what the backend
      // expects, and what makes them AND together.
      if (Array.isArray(value)) value.forEach((v) => qs.append(key, String(v)))
      else qs.set(key, String(value))
    }
    return get<SearchResponse>(`/search?${qs.toString()}`)
  },
}

// ---------------------------------------------------------------------- properties

export const propertyApi = {
  amenities: () => get<Amenity[]>('/properties/amenities'),
  get: (publicId: string) => get<Property>(`/properties/${publicId}`),
  mine: () => get<Property[]>('/properties/mine'),
  create: (payload: unknown) => post<Property>('/properties', payload),
  update: (publicId: string, payload: unknown) => patch<Property>(`/properties/${publicId}`, payload),
  publish: (publicId: string) => post<Property>(`/properties/${publicId}/publish`),
  unpublish: (publicId: string) => post<Property>(`/properties/${publicId}/unpublish`),
  remove: (publicId: string) => del<{ message: string }>(`/properties/${publicId}`),
}

// ------------------------------------------------------------------------ bookings

export const bookingApi = {
  quote: (propertyId: string, checkIn: string, checkOut: string, guests: number) =>
    post<PriceBreakdown>('/bookings/quote', { propertyId, checkIn, checkOut, guests }),

  availability: (propertyId: string) =>
    get<AvailabilityResponse>(`/bookings/availability/${propertyId}`),

  /** ⚠️ Sends dates and a guest count — never a price. The server computes every figure. */
  create: (propertyId: string, checkIn: string, checkOut: string, guests: number) =>
    post<Booking>('/bookings', { propertyId, checkIn, checkOut, guests }),

  mine: () => get<Booking[]>('/bookings/mine'),
  atMyPlaces: () => get<Booking[]>('/bookings/hosting'),
  get: (publicId: string) => get<Booking>(`/bookings/${publicId}`),
  cancel: (publicId: string, reason?: string) =>
    post<Booking>(`/bookings/${publicId}/cancel`, { reason }),
}

// ------------------------------------------------------------------------ payments

export const paymentApi = {
  createIntent: (bookingId: string) => post<PaymentIntentResponse>('/payments/intent', { bookingId }),
  status: (bookingId: string) =>
    get<{ publicId: string; status: string; amount: string; cardBrand: string | null; cardLast4: string | null }>(
      `/payments/booking/${bookingId}`,
    ),
}
