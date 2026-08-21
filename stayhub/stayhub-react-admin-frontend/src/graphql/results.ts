/** Result types for the queries in `queries.ts` — Apollo v4 infers `{}` without them. */

interface Count {
  aggregate: { count: number } | null
}
interface CountAndSum {
  aggregate: { count: number; sum: { total: number | null } | null } | null
}

export interface DashboardBookingRow {
  publicId: string
  checkIn: string
  checkOut: string
  total: number
  status: string
  createdAt: string
  property: { publicId: string; title: string; city: string } | null
  guest: { publicId: string; firstName: string; lastName: string } | null
}

export interface GetDashboardResult {
  propertiesAggregate: Count
  publishedAggregate: Count
  usersAggregate: Count
  hostsAggregate: Count
  bookingsAggregate: CountAndSum
  confirmedAggregate: CountAndSum
  cancelledAggregate: Count
  recentBookings: DashboardBookingRow[]
}

export interface AdminListingRow {
  publicId: string
  title: string
  city: string
  state: string | null
  country: string
  status: 'DRAFT' | 'PUBLISHED' | 'SUSPENDED'
  propertyType: string
  roomType: string
  pricePerNight: number
  maxGuests: number
  ratingAverage: number
  ratingCount: number
  createdAt: string
  host: { publicId: string; firstName: string; lastName: string } | null
  bookingsAggregate: Count
}
export interface GetAllListingsResult {
  properties: AdminListingRow[]
}

export interface AdminUserRow {
  publicId: string
  email: string
  firstName: string
  lastName: string
  role: 'CUSTOMER' | 'ADMIN'
  isHost: boolean
  createdAt: string
  propertiesAggregate: Count
  bookingsAggregate: Count
}
export interface GetAllUsersResult {
  users: AdminUserRow[]
}

export interface AdminBookingRow {
  publicId: string
  checkIn: string
  checkOut: string
  guests: number
  nights: number
  total: number
  status: string
  cancelledAt: string | null
  createdAt: string
  property: { publicId: string; title: string; city: string } | null
  guest: { publicId: string; firstName: string; lastName: string } | null
}
export interface GetAllBookingsResult {
  bookings: AdminBookingRow[]
}
