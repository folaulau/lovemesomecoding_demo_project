import { gql } from '@apollo/client'

/** Dashboard aggregates.
 *
 * Hasura generates `<table>Aggregate` for every tracked table with `allow_aggregations: true`.
 * These are real SQL aggregates run in Postgres — the browser never downloads rows to count them,
 * which is the difference between a dashboard that works at 12 bookings and one that works at
 * 12 million.
 *
 * ⚠️ camelCase throughout, including the aggregate roots (`bookingsAggregate`, not
 * `bookings_aggregate`) and the enum values (`DESC`, not `desc`) — the `graphql-default` naming
 * convention renames all three.
 */
export const GET_DASHBOARD = gql`
  query GetDashboard {
    propertiesAggregate {
      aggregate {
        count
      }
    }
    publishedAggregate: propertiesAggregate(where: { status: { _eq: "PUBLISHED" } }) {
      aggregate {
        count
      }
    }
    usersAggregate {
      aggregate {
        count
      }
    }
    hostsAggregate: usersAggregate(where: { isHost: { _eq: true } }) {
      aggregate {
        count
      }
    }
    bookingsAggregate {
      aggregate {
        count
        sum {
          total
        }
      }
    }
    confirmedAggregate: bookingsAggregate(where: { status: { _eq: "CONFIRMED" } }) {
      aggregate {
        count
        sum {
          total
        }
      }
    }
    cancelledAggregate: bookingsAggregate(where: { status: { _eq: "CANCELLED" } }) {
      aggregate {
        count
      }
    }
    recentBookings: bookings(limit: 8, orderBy: { createdAt: DESC }) {
      publicId
      checkIn
      checkOut
      total
      status
      createdAt
      # publicId is REQUIRED in every selection of a type that declares keyFields (lib/apollo.ts).
      # Omitting it does not degrade gracefully: Apollo throws
      # "Missing field 'publicId' while extracting keyFields" when it writes the result, and the
      # whole query fails with an error that names the cache rather than the query.
      #
      # NOTE: no backticks in these comments. A gql document is a TEMPLATE LITERAL, so a backtick
      # inside it ends the string — and the parse error then points at the line AFTER the comment,
      # blaming valid GraphQL for a stray quote character.
      property {
        publicId
        title
        city
      }
      guest {
        publicId
        firstName
        lastName
      }
    }
  }
`

/** Every listing, in ANY status — which only the staff role can see. */
export const GET_ALL_LISTINGS = gql`
  query GetAllListings {
    properties(orderBy: { createdAt: DESC }) {
      publicId
      title
      city
      state
      country
      status
      propertyType
      roomType
      pricePerNight
      maxGuests
      ratingAverage
      ratingCount
      createdAt
      host {
        publicId
        firstName
        lastName
      }
      bookingsAggregate {
        aggregate {
          count
        }
      }
    }
  }
`

export const GET_ALL_USERS = gql`
  query GetAllUsers {
    users(orderBy: { createdAt: DESC }) {
      publicId
      email
      firstName
      lastName
      role
      isHost
      createdAt
      propertiesAggregate {
        aggregate {
          count
        }
      }
      bookingsAggregate {
        aggregate {
          count
        }
      }
    }
  }
`

export const GET_ALL_BOOKINGS = gql`
  query GetAllBookings {
    bookings(orderBy: { createdAt: DESC }) {
      publicId
      checkIn
      checkOut
      guests
      nights
      total
      status
      cancelledAt
      createdAt
      property {
        publicId
        title
        city
      }
      guest {
        publicId
        firstName
        lastName
      }
    }
  }
`
