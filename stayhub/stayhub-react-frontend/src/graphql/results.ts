/** The shapes the Hasura queries in `queries.ts` return.
 *
 * ⚠️ Apollo Client v4 infers `{}` from an untyped `gql` document, so every field access is a
 * compile error until a type parameter is supplied — `useQuery<GetListingResult>(GET_LISTING)`.
 * v3 inferred `any` and let it through silently, which is why v3 code hits a wall of
 * "Property 'properties' does not exist on type '{}'" on upgrade.
 *
 * These are hand-written to stay dependency-free. A larger project would generate them from the
 * schema with GraphQL Code Generator, and then a query and its type could never drift.
 */

export interface ListingImageRow {
  url: string
  altText: string | null
  isCover?: boolean
  sortOrder?: number
}

export interface ListingCardRow {
  publicId: string
  title: string
  city: string
  state: string | null
  country: string
  propertyType: string
  roomType: string
  status: string
  pricePerNight: number
  cleaningFee: number
  maxGuests: number
  bedrooms: number
  beds: number
  bathrooms: number
  ratingAverage: number
  ratingCount: number
  images: ListingImageRow[]
  createdAt?: string
}

export interface ListingDetailRow extends ListingCardRow {
  description: string
  latitude: number | null
  longitude: number | null
  createdAt: string
  propertyAmenities: { amenity: { slug: string; name: string; icon: string | null } }[]
  host: {
    publicId: string
    firstName: string
    avatarUrl: string | null
    hostBio: string | null
    createdAt: string
  } | null
}

export interface BookingRow {
  publicId: string
  checkIn: string
  checkOut: string
  guests: number
  nights: number
  total: number
  status: string
  cancelledAt: string | null
  createdAt: string
  property: {
    publicId: string
    title: string
    city: string
    country?: string
    images?: { url: string }[]
  } | null
}

export interface ReservationRow extends Omit<BookingRow, 'cancelledAt'> {
  guest: { publicId: string; firstName: string; lastName: string } | null
}

export interface GetFeaturedListingsResult {
  properties: ListingCardRow[]
}
export interface GetListingResult {
  properties: ListingDetailRow[]
}
export interface GetMyListingsResult {
  properties: ListingCardRow[]
}
export interface GetReservationsResult {
  bookings: ReservationRow[]
}
export interface GetMyBookingsResult {
  bookings: BookingRow[]
}
export interface GetAmenitiesResult {
  amenities: { slug: string; name: string; icon: string | null }[]
}
