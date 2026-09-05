/**
 * Entity → API shape.
 *
 * Every write endpoint returns one of these, and they match
 * `contractor-react-frontend/src/types/domain.ts` field for field so the React client can use the
 * same TypeScript interfaces for a REST response and for a Hasura row.
 *
 * Three rules hold across all of them, and they are the reason this file exists rather than
 * routes returning entities directly:
 *
 *  1. **`id` is the `publicId`.** The bigint primary key never leaves the process.
 *  2. **`passwordHash` is never serialised.** Not "usually not" — there is no path from here that
 *     can emit it, because no mapper reads it.
 *  3. **A missing relation is a bug, not a null.** These mappers assume the caller loaded what
 *     they ask for; a route that forgets a `relations` option gets a loud `undefined` in a test
 *     rather than a quietly incomplete response in production.
 */

import type { ContractorProfile } from '../database/entities/contractor-profile.entity.js'
import type { PortfolioImage } from '../database/entities/portfolio-image.entity.js'
import type { Project } from '../database/entities/project.entity.js'
import type { Quote } from '../database/entities/quote.entity.js'
import type { Review } from '../database/entities/review.entity.js'
import type { ServiceCategory } from '../database/entities/service-category.entity.js'
import type { User } from '../database/entities/user.entity.js'

export function toUserDto(user: User) {
  return {
    id: user.publicId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    role: user.role,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
  }
}

/** The trimmed author shape embedded in projects, quotes and reviews. Nothing that renders a
 *  byline needs an email address, so nothing that renders one is given it. */
export function toUserSummaryDto(user: User) {
  return {
    id: user.publicId,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
  }
}

export function toCategoryDto(category: ServiceCategory) {
  return {
    id: category.publicId,
    slug: category.slug,
    name: category.name,
    description: category.description,
    icon: category.icon,
  }
}

export function toPortfolioImageDto(image: PortfolioImage) {
  return {
    id: image.publicId,
    url: image.url,
    caption: image.caption,
    sortOrder: image.sortOrder,
  }
}

export function toContractorDto(profile: ContractorProfile) {
  return {
    id: profile.publicId,
    user: toUserSummaryDto(profile.user),
    businessName: profile.businessName,
    bio: profile.bio,
    yearsInBusiness: profile.yearsInBusiness,
    licenseNumber: profile.licenseNumber,
    city: profile.city,
    state: profile.state,
    zip: profile.zip,
    serviceRadiusMiles: profile.serviceRadiusMiles,
    // Already numbers here — the column transformers in the entity converted them from the
    // strings pg returns for `numeric`. See contractor-profile.entity.ts.
    hourlyRateMin: profile.hourlyRateMin,
    hourlyRateMax: profile.hourlyRateMax,
    ratingAverage: profile.ratingAverage,
    reviewCount: profile.reviewCount,
    categories: (profile.categories ?? []).map(toCategoryDto),
    portfolio: (profile.portfolio ?? [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(toPortfolioImageDto),
  }
}

export function toQuoteDto(quote: Quote) {
  return {
    id: quote.publicId,
    projectId: quote.project?.publicId ?? '',
    contractor: toContractorDto(quote.contractor),
    amount: quote.amount,
    estimatedDays: quote.estimatedDays,
    message: quote.message,
    status: quote.status,
    createdAt: quote.createdAt.toISOString(),
  }
}

export function toReviewDto(review: Review) {
  return {
    id: review.publicId,
    projectId: review.project?.publicId ?? '',
    // From the review row, not from the relation — the relation is not always loaded, and on the
    // public profile it is not even readable. See review.entity.ts.
    projectTitle: review.projectTitle,
    homeowner: toUserSummaryDto(review.homeowner),
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt.toISOString(),
  }
}

export function toProjectDto(project: Project) {
  return {
    id: project.publicId,
    homeowner: toUserSummaryDto(project.homeowner),
    category: toCategoryDto(project.category),
    title: project.title,
    description: project.description,
    city: project.city,
    state: project.state,
    zip: project.zip,
    budgetMin: project.budgetMin,
    budgetMax: project.budgetMax,
    // ⚠️ Already a `YYYY-MM-DD` string, because the column is a `date` and pg returns those as
    // text. Calling `.toISOString()` on it would be a TypeError, and wrapping it in `new Date()`
    // first would reintroduce exactly the timezone shift the `date` type exists to avoid.
    preferredStartDate: project.preferredStartDate,
    status: project.status,
    createdAt: project.createdAt.toISOString(),
    quotes: (project.quotes ?? []).map((quote) => ({
      ...toQuoteDto(quote),
      // The quote rows loaded as a project's children do not each carry the parent back, so the
      // id is filled in from the project that owns them.
      projectId: project.publicId,
    })),
    review: project.review
      ? { ...toReviewDto(project.review), projectId: project.publicId }
      : null,
  }
}
