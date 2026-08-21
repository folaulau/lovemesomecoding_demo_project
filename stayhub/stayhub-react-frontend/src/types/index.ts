/** The API contract, in one place.
 *
 * Both APIs speak camelCase — FastAPI via a pydantic alias generator, Hasura via its
 * `graphql-default` naming convention — so one set of types covers both.
 */

export type UserRole = 'CUSTOMER' | 'ADMIN'
export type PropertyStatus = 'DRAFT' | 'PUBLISHED' | 'SUSPENDED'
export type RoomType = 'ENTIRE_PLACE' | 'PRIVATE_ROOM' | 'SHARED_ROOM'
export type PropertyType = 'HOUSE' | 'APARTMENT' | 'CABIN' | 'CONDO' | 'LOFT' | 'VILLA'
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED'

export interface User {
  publicId: string
  email: string
  firstName: string
  lastName: string
  fullName: string
  role: UserRole
  isHost: boolean
  avatarUrl: string | null
  hostBio: string | null
  createdAt: string
}

export interface AuthResponse {
  accessToken: string
  tokenType: string
  user: User
}

export interface PropertyImage {
  url: string
  altText: string | null
  sortOrder: number
  isCover: boolean
}

export interface Amenity {
  slug: string
  name: string
  icon: string | null
}

export interface Property {
  publicId: string
  title: string
  description: string
  propertyType: PropertyType
  roomType: RoomType
  status: PropertyStatus
  city: string
  state: string | null
  country: string
  latitude: string | null
  longitude: string | null
  /** Money arrives as a STRING, deliberately — see lib/money.ts. */
  pricePerNight: string
  cleaningFee: string
  maxGuests: number
  bedrooms: number
  beds: number
  bathrooms: string
  ratingAverage: string
  ratingCount: number
  images: PropertyImage[]
  amenities: Amenity[]
  host: { publicId: string; firstName: string; avatarUrl: string | null; hostBio: string | null } | null
  createdAt: string
}

export interface SearchHit {
  publicId: string
  title: string
  city: string
  state: string | null
  country: string
  propertyType: PropertyType
  roomType: RoomType
  pricePerNight: string
  cleaningFee: string
  maxGuests: number
  bedrooms: number
  beds: number
  bathrooms: string
  ratingAverage: string
  ratingCount: number
  coverImageUrl: string | null
  amenities: string[]
  latitude: string | null
  longitude: string | null
}

export interface SearchResponse {
  hits: SearchHit[]
  total: number
  page: number
  pageSize: number
  tookMs: number
}

export interface PriceBreakdown {
  nights: number
  nightlyRate: string
  subtotal: string
  cleaningFee: string
  serviceFee: string
  total: string
}

export interface Booking {
  publicId: string
  status: BookingStatus
  checkIn: string
  checkOut: string
  guests: number
  nights: number
  nightlyRate: string
  subtotal: string
  cleaningFee: string
  serviceFee: string
  total: string
  /** Computed server-side — the server re-checks the rule on cancel regardless. */
  isCancellable: boolean
  cancellationDeadline: string
  cancelledAt: string | null
  cancellationReason: string | null
  property: { publicId: string; title: string; city: string; country: string; coverImageUrl: string | null } | null
  createdAt: string
}

export interface AvailabilityResponse {
  propertyId: string
  available: boolean
  unavailableRanges: { from: string; to: string }[]
}

export interface PaymentIntentResponse {
  clientSecret: string
  paymentIntentId: string
  amount: string
  currency: string
  publishableKey: string
}

/** The shape every error from the API takes — see the backend's core/exceptions.py. */
export interface ApiErrorBody {
  message: string
  fieldErrors: Record<string, string>
}
