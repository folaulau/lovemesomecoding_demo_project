/**
 * The domain, in TypeScript.
 *
 * These are the shapes the UI renders. They are written once here and imported everywhere, so a
 * field that gets renamed on the backend breaks the build in one place instead of failing silently
 * as `undefined` in a component.
 *
 * ⚠️ No `enum` anywhere in this file, and that is not a style preference. This project compiles
 * with `erasableSyntaxOnly: true` (see `tsconfig.app.json`), which rejects any TypeScript syntax
 * that has to EMIT JavaScript to work — and a TS `enum` compiles down to a real runtime object.
 * The pattern below is the replacement: a `const` object plus a type derived from its values. You
 * get the same autocomplete and the same exhaustiveness checking, the values are plain strings
 * that match the database, and nothing is generated.
 */

/* ------------------------------------------------------------------------------------------- */
/* Enumerations                                                                                  */
/* ------------------------------------------------------------------------------------------- */

export const UserRole = {
  HOMEOWNER: 'homeowner',
  CONTRACTOR: 'contractor',
  /**
   * ⚠️ The value is `staff`, not `admin`. `admin` is Hasura's BUILT-IN superuser role — it
   * bypasses every row-level permission, and a JWT claiming it would get unrestricted read and
   * write access to every table. See `common/enums.ts` in the backend for the full story.
   */
  STAFF: 'staff',
} as const

// `(typeof UserRole)[keyof typeof UserRole]` reads as "the type of any value in that object", so
// this resolves to 'homeowner' | 'contractor' | 'staff'. Add a key above and the union grows by
// itself — which is the whole reason to derive it rather than write the union out twice.
export type UserRole = (typeof UserRole)[keyof typeof UserRole]

/**
 * The life of a project.
 *
 *   open ──> quoted ──> hired ──> in_progress ──> completed
 *     └──────────┴─────────┴───────────┘
 *                  cancelled
 *
 * `open` and `quoted` differ only in whether anybody has bid yet; both accept new quotes. The
 * backend owns every one of these transitions — see `ProjectsService`.
 */
export const ProjectStatus = {
  OPEN: 'open',
  QUOTED: 'quoted',
  HIRED: 'hired',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus]

export const QuoteStatus = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  WITHDRAWN: 'withdrawn',
} as const
export type QuoteStatus = (typeof QuoteStatus)[keyof typeof QuoteStatus]

/* ------------------------------------------------------------------------------------------- */
/* Entities                                                                                      */
/* ------------------------------------------------------------------------------------------- */

/**
 * ⚠️ `id` is the UUID (`public_id` in the database), never the bigint primary key.
 *
 * Every table has both: a bigint for foreign keys, which is compact and fast to join, and a UUID
 * for the outside world. Only the UUID is ever serialised. Exposing the sequence would let anyone
 * read the row count off an id and walk the table by counting upward — and on a marketplace, "how
 * many jobs has this site actually had" is competitive information you are giving away for free.
 */
export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  phone: string | null
  role: UserRole
  avatarUrl: string | null
  createdAt: string
}

export interface ServiceCategory {
  id: string
  slug: string
  name: string
  description: string
  /** A single emoji. Cheap, no icon font, no sprite sheet, and it renders everywhere. */
  icon: string
}

export interface PortfolioImage {
  id: string
  url: string
  caption: string | null
  sortOrder: number
}

export interface ContractorProfile {
  id: string
  user: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>
  businessName: string
  bio: string
  yearsInBusiness: number
  licenseNumber: string | null
  city: string
  state: string
  zip: string
  /** How far they will travel, in miles. Used by the directory's distance filter. */
  serviceRadiusMiles: number
  hourlyRateMin: number
  hourlyRateMax: number

  /**
   * ⚠️ Both of these are CACHED aggregates, recomputed by the backend whenever a review lands.
   * They are never accepted from a request body — a contractor who could PATCH their own rating
   * would be the first thing anyone tried. See `ReviewsService.recomputeRating`.
   */
  ratingAverage: number
  reviewCount: number

  categories: ServiceCategory[]
  portfolio: PortfolioImage[]
}

export interface Project {
  id: string
  homeowner: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>
  category: ServiceCategory
  title: string
  description: string
  city: string
  state: string
  zip: string
  budgetMin: number
  budgetMax: number
  /** ISO date, no time. The homeowner picks a day, not a moment. */
  preferredStartDate: string
  status: ProjectStatus
  createdAt: string
  quotes: Quote[]
  review: Review | null
}

export interface Quote {
  id: string
  projectId: string
  contractor: ContractorProfile
  amount: number
  estimatedDays: number
  message: string
  status: QuoteStatus
  createdAt: string
}

export interface Review {
  id: string
  projectId: string
  projectTitle: string
  homeowner: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>
  /** 1–5, integer. Enforced by a CHECK constraint as well as by the service. */
  rating: number
  comment: string
  createdAt: string
}

/* ------------------------------------------------------------------------------------------- */
/* Presentation helpers                                                                          */
/* ------------------------------------------------------------------------------------------- */

/**
 * Labels and badge colours for each status, kept next to the types they describe rather than
 * inlined in components — three screens render a project status badge and they must agree.
 *
 * `Record<ProjectStatus, …>` is doing real work: add a status to the union above and TypeScript
 * fails HERE until the label is written, instead of rendering a blank badge in production.
 */
export const PROJECT_STATUS_META: Record<ProjectStatus, { label: string; className: string }> = {
  open: { label: 'Open', className: 'bg-brand-100 text-brand-800' },
  quoted: { label: 'Quotes in', className: 'bg-accent-100 text-accent-700' },
  hired: { label: 'Pro hired', className: 'bg-blue-100 text-blue-800' },
  in_progress: { label: 'In progress', className: 'bg-violet-100 text-violet-800' },
  completed: { label: 'Completed', className: 'bg-slate-200 text-slate-700' },
  cancelled: { label: 'Cancelled', className: 'bg-rose-100 text-rose-700' },
}

export const QUOTE_STATUS_META: Record<QuoteStatus, { label: string; className: string }> = {
  pending: { label: 'Awaiting decision', className: 'bg-accent-100 text-accent-700' },
  accepted: { label: 'Accepted', className: 'bg-brand-100 text-brand-800' },
  declined: { label: 'Declined', className: 'bg-slate-200 text-slate-600' },
  withdrawn: { label: 'Withdrawn', className: 'bg-slate-200 text-slate-600' },
}

/** A project still accepts quotes in exactly these two states. Used by the UI and mirrored by the
 *  backend rule; the backend one is the authority, this one only decides whether to show a form. */
export const QUOTABLE_STATUSES: ProjectStatus[] = [ProjectStatus.OPEN, ProjectStatus.QUOTED]
