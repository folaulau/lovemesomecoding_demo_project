/** Hasura queries — every read in the app except search.
 *
 * ⚠️ Field names are camelCase because Hasura runs with
 * `HASURA_GRAPHQL_DEFAULT_NAMING_CONVENTION: graphql-default`. That setting renames THREE things,
 * and Hasura's own documentation examples use the un-renamed form:
 *
 *   columns    price_per_night      → pricePerNight
 *   arguments  order_by, where      → orderBy, where
 *   enums      asc, desc            → ASC, DESC
 *   roots      bookings_aggregate   → bookingsAggregate
 *
 * A copied example fails with "'properties' has no argument named 'order_by'".
 */

import { gql } from '@apollo/client'

/** Fragment: everything a listing CARD needs. Kept as a fragment so the home page and the host
 *  dashboard cannot drift apart in what they request. */
export const LISTING_CARD_FIELDS = gql`
  fragment ListingCardFields on Properties {
    publicId
    title
    city
    state
    country
    propertyType
    roomType
    status
    pricePerNight
    cleaningFee
    maxGuests
    bedrooms
    beds
    bathrooms
    ratingAverage
    ratingCount
    images(where: { isCover: { _eq: true } }, limit: 1) {
      url
      altText
    }
  }
`

export const GET_FEATURED_LISTINGS = gql`
  ${LISTING_CARD_FIELDS}
  query GetFeaturedListings($limit: Int = 12) {
    properties(limit: $limit, orderBy: { ratingAverage: DESC }) {
      ...ListingCardFields
    }
  }
`

export const GET_LISTING = gql`
  query GetListing($publicId: uuid!) {
    properties(where: { publicId: { _eq: $publicId } }, limit: 1) {
      publicId
      title
      description
      propertyType
      roomType
      status
      city
      state
      country
      latitude
      longitude
      pricePerNight
      cleaningFee
      maxGuests
      bedrooms
      beds
      bathrooms
      ratingAverage
      ratingCount
      createdAt
      images(orderBy: { sortOrder: ASC }) {
        url
        altText
        isCover
        sortOrder
      }
      propertyAmenities {
        amenity {
          slug
          name
          icon
        }
      }
      host {
        publicId
        firstName
        avatarUrl
        hostBio
        createdAt
      }
    }
  }
`

export const GET_MY_BOOKINGS = gql`
  query GetMyBookings {
    bookings(orderBy: { checkIn: DESC }) {
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
        country
        images(where: { isCover: { _eq: true } }, limit: 1) {
          url
        }
      }
    }
  }
`

/** A host's own listings, drafts included.
 *
 * There is no `where` clause naming the host — the ROW PERMISSION does it. The `host` role's rule
 * is "published listings OR listings whose host is me", so this same query returns different rows
 * depending on who asks. That is the point of row-level permissions: the filter cannot be
 * forgotten, because it is not in the query.
 */
export const GET_MY_LISTINGS = gql`
  ${LISTING_CARD_FIELDS}
  query GetMyListings($hostId: uuid!) {
    properties(where: { host: { publicId: { _eq: $hostId } } }, orderBy: { createdAt: DESC }) {
      ...ListingCardFields
      createdAt
    }
  }
`

export const GET_RESERVATIONS_AT_MY_PLACES = gql`
  query GetReservations($hostId: uuid!) {
    bookings(
      where: { property: { host: { publicId: { _eq: $hostId } } } }
      orderBy: { checkIn: DESC }
    ) {
      publicId
      checkIn
      checkOut
      guests
      nights
      total
      status
      createdAt
      guest {
        publicId
        firstName
        lastName
      }
      property {
        publicId
        title
        city
      }
    }
  }
`

export const GET_AMENITIES = gql`
  query GetAmenities {
    amenities(orderBy: { name: ASC }) {
      slug
      name
      icon
    }
  }
`
