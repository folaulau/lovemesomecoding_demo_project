/**
 * The GraphQL Hasura is asked for, and the mapping back to the app's own types.
 *
 * Two things worth knowing before reading this file:
 *
 * 1. **Hasura's schema is the DATABASE's schema.** Fields are snake_case, `contractor_profiles`
 *    is plural, and a contractor's trades arrive as rows of the join table rather than as a list
 *    of categories. The mappers at the bottom absorb all of that so the components keep using the
 *    camelCase interfaces in `types/domain.ts`.
 *
 * 2. **Nothing here filters for security.** The `where` clauses below narrow what is asked for;
 *    the row-level permissions in `hasura/metadata.mjs` decide what is allowed. A query with no
 *    `where` at all still only returns rows the caller's JWT permits — which is exactly why a
 *    contractor asking for "all quotes" gets only their own.
 */

import { gql } from '@apollo/client'

import type {
  ContractorProfile,
  PortfolioImage,
  Project,
  ProjectStatus,
  Quote,
  QuoteStatus,
  Review,
  ServiceCategory,
} from '../types/domain'

/* ------------------------------------------------------------------------------------------- */
/* Fragments                                                                                     */
/* ------------------------------------------------------------------------------------------- */

/**
 * ⚠️ `email` and `phone` are not requested — and could not be. They are absent from the column
 * allowlist on `users` in the metadata, so asking for one is a schema error rather than a
 * permission denial. That is a stronger guarantee: the field does not exist to be leaked.
 */
const USER_SUMMARY = gql`
  fragment UserSummary on users {
    public_id
    first_name
    last_name
    avatar_url
  }
`

const CATEGORY_FIELDS = gql`
  fragment CategoryFields on service_categories {
    public_id
    slug
    name
    description
    icon
  }
`

const CONTRACTOR_FIELDS = gql`
  ${USER_SUMMARY}
  ${CATEGORY_FIELDS}
  fragment ContractorFields on contractor_profiles {
    public_id
    business_name
    bio
    years_in_business
    license_number
    city
    state
    zip
    service_radius_miles
    hourly_rate_min
    hourly_rate_max
    rating_average
    review_count
    user {
      ...UserSummary
    }
    # Two hops, because a many-to-many goes through its join table. Hasura cannot flatten
    # contractor_services into a direct "categories" array without a database view, so the
    # nesting is visible here and the mapper below flattens it instead.
    #
    # NOTE: no backticks anywhere inside a gql template literal -- a backtick ENDS the JS
    # template string, and the parse error it produces points at the line after the comment.
    contractor_services {
      category {
        ...CategoryFields
      }
    }
    # order_by belongs in the query, not in JavaScript: without it Postgres returns whatever
    # order it likes, and "the first image is the cover" quietly stops being true.
    portfolio_images(order_by: { sort_order: asc }) {
      public_id
      url
      caption
      sort_order
    }
  }
`

const QUOTE_FIELDS = gql`
  ${CONTRACTOR_FIELDS}
  fragment QuoteFields on quotes {
    public_id
    amount
    estimated_days
    message
    status
    created_at
    contractor_profile {
      ...ContractorFields
    }
  }
`

const PROJECT_FIELDS = gql`
  ${USER_SUMMARY}
  ${CATEGORY_FIELDS}
  ${QUOTE_FIELDS}
  fragment ProjectFields on projects {
    public_id
    title
    description
    city
    state
    zip
    budget_min
    budget_max
    preferred_start_date
    status
    created_at
    homeowner {
      ...UserSummary
    }
    category {
      ...CategoryFields
    }
    quotes(order_by: { created_at: asc }) {
      ...QuoteFields
    }
    review {
      public_id
      rating
      comment
      created_at
      project_title
      homeowner {
        ...UserSummary
      }
    }
  }
`

/* ------------------------------------------------------------------------------------------- */
/* Queries                                                                                       */
/* ------------------------------------------------------------------------------------------- */

export const LIST_CATEGORIES = gql`
  ${CATEGORY_FIELDS}
  query ListCategories {
    service_categories(order_by: { name: asc }) {
      ...CategoryFields
    }
  }
`

/**
 * The directory.
 *
 * `$where` is passed as a whole expression rather than as separate optional arguments. Hasura's
 * `_and` of an empty list matches everything, so one variable covers "no filters" and "three
 * filters" without the query needing a conditional anywhere.
 */
export const LIST_CONTRACTORS = gql`
  ${CONTRACTOR_FIELDS}
  query ListContractors($where: contractor_profiles_bool_exp!) {
    contractor_profiles(
      where: $where
      order_by: [{ rating_average: desc }, { review_count: desc }]
    ) {
      ...ContractorFields
    }
  }
`

export const GET_CONTRACTOR = gql`
  ${CONTRACTOR_FIELDS}
  query GetContractor($publicId: uuid!) {
    contractor_profiles(where: { public_id: { _eq: $publicId } }, limit: 1) {
      ...ContractorFields
    }
  }
`

export const GET_CONTRACTOR_BY_USER = gql`
  ${CONTRACTOR_FIELDS}
  query GetContractorByUser($userPublicId: uuid!) {
    contractor_profiles(where: { user: { public_id: { _eq: $userPublicId } } }, limit: 1) {
      ...ContractorFields
    }
  }
`

export const LIST_CONTRACTOR_REVIEWS = gql`
  ${USER_SUMMARY}
  query ListContractorReviews($contractorPublicId: uuid!) {
    reviews(
      where: { contractor_profile: { public_id: { _eq: $contractorPublicId } } }
      order_by: { created_at: desc }
    ) {
      public_id
      rating
      comment
      created_at
      project_title
      homeowner {
        ...UserSummary
      }
    }
  }
`

/**
 * ⚠️ No `where` on the homeowner. There does not need to be one — the `homeowner` role's select
 * permission is `homeowner_id = X-Hasura-User-Id`, so this returns their projects and nobody
 * else's even though the query asks for all of them. Adding a redundant client-side filter would
 * imply the permission was optional.
 */
export const LIST_MY_PROJECTS = gql`
  ${PROJECT_FIELDS}
  query ListMyProjects {
    projects(order_by: { created_at: desc }) {
      ...ProjectFields
    }
  }
`

export const GET_PROJECT = gql`
  ${PROJECT_FIELDS}
  query GetProject($publicId: uuid!) {
    projects(where: { public_id: { _eq: $publicId } }, limit: 1) {
      ...ProjectFields
    }
  }
`

/**
 * The contractor lead feed.
 *
 * The trade filter is NOT here either — the `contractor` role's permission already restricts
 * `projects` to open jobs in their trades plus anything they have quoted on. This only narrows
 * that to the still-quotable half, which is a presentation choice rather than a security one.
 */
export const LIST_LEADS = gql`
  ${PROJECT_FIELDS}
  query ListLeads {
    projects(where: { status: { _in: ["open", "quoted"] } }, order_by: { created_at: desc }) {
      ...ProjectFields
    }
  }
`

/** Every quote this pro has sent, with the project it was for. The permission narrows `quotes` to
 *  their own rows, so again there is no `where` to write. */
export const LIST_MY_QUOTES = gql`
  ${QUOTE_FIELDS}
  ${PROJECT_FIELDS}
  query ListMyQuotes {
    quotes(order_by: { created_at: desc }) {
      ...QuoteFields
      project {
        ...ProjectFields
      }
    }
  }
`

/* ------------------------------------------------------------------------------------------- */
/* Mappers — Hasura's snake_case rows into the app's types                                       */
/* ------------------------------------------------------------------------------------------- */

/* eslint-disable @typescript-eslint/no-explicit-any */

export function mapCategory(row: any): ServiceCategory {
  return {
    id: row.public_id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    icon: row.icon,
  }
}

function mapUserSummary(row: any) {
  return {
    id: row.public_id,
    firstName: row.first_name,
    lastName: row.last_name,
    avatarUrl: row.avatar_url,
  }
}

function mapPortfolioImage(row: any): PortfolioImage {
  return {
    id: row.public_id,
    url: row.url,
    caption: row.caption,
    sortOrder: row.sort_order,
  }
}

export function mapContractor(row: any): ContractorProfile {
  return {
    id: row.public_id,
    user: mapUserSummary(row.user),
    businessName: row.business_name,
    bio: row.bio,
    yearsInBusiness: row.years_in_business,
    licenseNumber: row.license_number,
    city: row.city,
    state: row.state,
    zip: row.zip,
    serviceRadiusMiles: row.service_radius_miles,
    // ⚠️ `Number(...)` on every numeric column. Postgres `numeric` is arbitrary precision, so
    // Hasura serialises it as a JSON number here but as a STRING in some versions and drivers —
    // and `"2450.00" - 0` working while `"2450.00" + 0` yields `"2450.000"` is a bug that only
    // shows up on the one screen that adds two of them.
    hourlyRateMin: Number(row.hourly_rate_min),
    hourlyRateMax: Number(row.hourly_rate_max),
    ratingAverage: Number(row.rating_average),
    reviewCount: row.review_count,
    // The join table, flattened.
    categories: (row.contractor_services ?? []).map((link: any) => mapCategory(link.category)),
    portfolio: (row.portfolio_images ?? []).map(mapPortfolioImage),
  }
}

export function mapQuote(row: any, projectId: string): Quote {
  return {
    id: row.public_id,
    projectId,
    contractor: mapContractor(row.contractor_profile),
    amount: Number(row.amount),
    estimatedDays: row.estimated_days,
    message: row.message,
    status: row.status as QuoteStatus,
    createdAt: row.created_at,
  }
}

export function mapReview(row: any, projectId: string): Review {
  return {
    id: row.public_id,
    projectId,
    // From the review row itself. `review.project.title` is unavailable to anonymous visitors —
    // see the note on the column in review.entity.ts.
    projectTitle: row.project_title,
    homeowner: mapUserSummary(row.homeowner),
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
  }
}

export function mapProject(row: any): Project {
  return {
    id: row.public_id,
    homeowner: mapUserSummary(row.homeowner),
    category: mapCategory(row.category),
    title: row.title,
    description: row.description,
    city: row.city,
    state: row.state,
    zip: row.zip,
    budgetMin: Number(row.budget_min),
    budgetMax: Number(row.budget_max),
    // Already `YYYY-MM-DD` — Postgres `date` has no time and no zone, and Hasura passes it through
    // as a string. Wrapping it in `new Date()` here would put both back and shift the day.
    preferredStartDate: row.preferred_start_date,
    status: row.status as ProjectStatus,
    createdAt: row.created_at,
    quotes: (row.quotes ?? []).map((quote: any) => mapQuote(quote, row.public_id)),
    review: row.review ? mapReview(row.review, row.public_id) : null,
  }
}
