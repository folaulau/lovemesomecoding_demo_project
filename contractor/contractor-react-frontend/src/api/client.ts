/**
 * The API seam — now wired to the real stack.
 *
 * Every screen reads and writes through the functions below and knows nothing about where the data
 * comes from. That is what made phase 4 a rewrite of this one file rather than of the whole app:
 * the mock version had exactly these signatures, and not one component changed.
 *
 *     reads  ──> Hasura GraphQL   (row-level permissions do the filtering)
 *     writes ──> NestJS REST      (business rules that must not be bypassable)
 *
 * ⚠️ Notice how little filtering the read functions do. `listMyProjects` sends no `where` clause
 * for the homeowner and `listMyQuotes` sends none for the contractor, because the permissions in
 * `hasura/metadata.mjs` already restrict both to the caller's own rows. Filtering again here would
 * be dead code that implies the permission is optional — and the day someone "simplifies" that
 * permission away, the client-side filter would keep every screen looking correct while the API
 * quietly served everything to anyone who asked it directly.
 *
 * Several functions therefore take an id they never use (`_homeownerId`, `_contractorId`). They
 * are kept so the signatures still match what the pages call, and prefixed with `_` so the
 * compiler's unused-parameter check does not flag them.
 */

import { apolloClient } from '../lib/apollo'
import { API_URL } from '../lib/config'
import type {
  ContractorProfile,
  PortfolioImage,
  Project,
  ProjectStatus,
  Quote,
  Review,
  ServiceCategory,
  User,
} from '../types/domain'
import {
  GET_CONTRACTOR,
  GET_CONTRACTOR_BY_USER,
  GET_PROJECT,
  LIST_CATEGORIES,
  LIST_CONTRACTORS,
  LIST_CONTRACTOR_REVIEWS,
  LIST_LEADS,
  LIST_MY_PROJECTS,
  LIST_MY_QUOTES,
  mapCategory,
  mapContractor,
  mapProject,
  mapQuote,
  mapReview,
} from './queries'

/* eslint-disable @typescript-eslint/no-explicit-any */

/* ------------------------------------------------------------------------------------------- */
/* Errors and transport                                                                          */
/* ------------------------------------------------------------------------------------------- */

/**
 * The error every rejected call throws.
 *
 * `status` lets the UI tell "you are not allowed to do that" from "the server fell over" without
 * parsing message strings — and the codes match what NestJS actually returns.
 */
export class ApiError extends Error {
  // Declared and assigned by hand rather than as a constructor parameter property: that shorthand
  // is TypeScript-only syntax that has to emit an assignment, and `erasableSyntaxOnly` in
  // tsconfig.app.json rejects it. (The NestJS backend uses it constantly — it does not compile
  // with that flag.)
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const STORAGE_KEY = 'contractor.session'

function currentToken(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? ((JSON.parse(raw) as { token?: string }).token ?? null) : null
  } catch {
    return null
  }
}

/**
 * The one place that talks to NestJS.
 *
 * `body` is JSON-encoded here rather than by each caller, so a write can never accidentally be
 * sent without its `Content-Type` — a mistake that produces an empty DTO and a validation error
 * listing every required field, which reads like a bug in completely the wrong file.
 */
async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; formData?: FormData } = {},
): Promise<T> {
  const token = currentToken()
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`

  // ⚠️ NEVER set Content-Type on a FormData request. The browser has to generate it, because it
  // has to include the multipart boundary; setting it by hand produces a header with no boundary
  // and a body the server cannot parse. This is the most common file-upload bug there is.
  if (!options.formData) headers['Content-Type'] = 'application/json'

  const response = await fetch(`${API_URL}/api/v1${path}`, {
    method: options.method ?? 'GET',
    headers,
    body:
      options.formData ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
  })

  // 204 has no body at all, and `JSON.parse('')` throws. DELETE returns one.
  if (response.status === 204) return undefined as T

  const text = await response.text()
  const payload: unknown = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new ApiError(response.status, extractMessage(payload, response.status))
  }
  return payload as T
}

/**
 * ⚠️ Nest returns `message` as a STRING for a thrown HttpException and as an ARRAY of strings for
 * a ValidationPipe failure. Handling only the first shape renders "[object Object]" at the user
 * the moment a field fails validation — which is exactly when they need to read it.
 */
function extractMessage(payload: unknown, status: number): string {
  const message = (payload as { message?: unknown } | null)?.message
  if (typeof message === 'string') return message
  if (Array.isArray(message) && typeof message[0] === 'string') return message[0]
  return `Something went wrong (${status}).`
}

/**
 * Runs a Hasura query and surfaces GraphQL errors as `ApiError`, so callers have one thing to catch.
 *
 * ⚠️ The client sets `errorPolicy: 'all'`, which means a partial failure RESOLVES rather than
 * throws — a permission denial can arrive as data plus errors. Checking `result.error` explicitly
 * is what stops that being rendered as a cheerfully empty list.
 */
async function graphql<T>(query: unknown, variables?: Record<string, unknown>): Promise<T> {
  const result = await apolloClient.query({ query: query as any, variables })
  if (result.error) throw new ApiError(502, result.error.message)
  return result.data as T
}

/* ------------------------------------------------------------------------------------------- */
/* Auth — NestJS                                                                                 */
/* ------------------------------------------------------------------------------------------- */

export interface Session {
  /** The real JWT: NestJS signs it, Hasura verifies it with the same secret, Apollo sends it. */
  token: string
  user: User
}

export interface SignUpInput {
  email: string
  password: string
  firstName: string
  lastName: string
  phone: string
  /**
   * ⚠️ Only `homeowner` and `contractor`. `staff` is deliberately not offerable, and the backend's
   * `RegisterDto` rejects it with `@IsIn` — a role that can be chosen in a request body is a
   * privilege escalation waiting to be found.
   */
  role: Exclude<User['role'], 'staff'>
}

export async function signIn(email: string, password: string): Promise<Session> {
  return request<Session>('/auth/login', {
    method: 'POST',
    body: { email: email.trim(), password },
  })
}

export async function signUp(input: SignUpInput): Promise<Session> {
  return request<Session>('/auth/register', {
    method: 'POST',
    body: {
      email: input.email.trim(),
      password: input.password,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      // ⚠️ Omitted when blank rather than sent as `""`. `phone` is `@IsOptional()` on the DTO, and
      // an optional field that is present-but-empty is validated, not skipped.
      ...(input.phone.trim() ? { phone: input.phone.trim() } : {}),
      role: input.role,
    },
  })
}

/* ------------------------------------------------------------------------------------------- */
/* Reads — Hasura                                                                                */
/* ------------------------------------------------------------------------------------------- */

export async function listCategories(): Promise<ServiceCategory[]> {
  const data = await graphql<{ service_categories: any[] }>(LIST_CATEGORIES)
  return data.service_categories.map(mapCategory)
}

export interface ContractorFilters {
  categorySlug?: string
  /** Free text across business name, bio and city. */
  q?: string
  minRating?: number
}

export async function listContractors(
  filters: ContractorFilters = {},
): Promise<ContractorProfile[]> {
  // Hasura's `_and` over an empty array matches everything, so a single expression covers "no
  // filters" and "all three" with no conditional inside the query document.
  const conditions: Record<string, unknown>[] = []

  if (filters.categorySlug) {
    conditions.push({ contractor_services: { category: { slug: { _eq: filters.categorySlug } } } })
  }
  if (filters.minRating) {
    conditions.push({ rating_average: { _gte: filters.minRating } })
  }
  if (filters.q?.trim()) {
    // `_ilike` is case-insensitive LIKE. Fine for a directory this size; a real one would use
    // Postgres full-text search, because a leading `%` means no index can be used.
    const pattern = `%${filters.q.trim()}%`
    conditions.push({
      _or: [
        { business_name: { _ilike: pattern } },
        { bio: { _ilike: pattern } },
        { city: { _ilike: pattern } },
      ],
    })
  }

  // A profile with no business name has never been filled in. A dead result makes the whole
  // directory look abandoned, so it is excluded rather than rendered as a blank card.
  conditions.push({ business_name: { _neq: '' } })

  const data = await graphql<{ contractor_profiles: any[] }>(LIST_CONTRACTORS, {
    where: { _and: conditions },
  })
  return data.contractor_profiles.map(mapContractor)
}

export async function getContractor(id: string): Promise<ContractorProfile | null> {
  const data = await graphql<{ contractor_profiles: any[] }>(GET_CONTRACTOR, { publicId: id })
  const row = data.contractor_profiles[0]
  return row ? mapContractor(row) : null
}

export async function getContractorByUserId(userId: string): Promise<ContractorProfile | null> {
  const data = await graphql<{ contractor_profiles: any[] }>(GET_CONTRACTOR_BY_USER, {
    userPublicId: userId,
  })
  const row = data.contractor_profiles[0]
  return row ? mapContractor(row) : null
}

export async function listContractorReviews(contractorId: string): Promise<Review[]> {
  const data = await graphql<{ reviews: any[] }>(LIST_CONTRACTOR_REVIEWS, {
    contractorPublicId: contractorId,
  })
  // No project id: a public visitor cannot read `projects` at all, and nothing on the profile
  // page links through to one. The title travels on the review row instead.
  return data.reviews.map((row) => mapReview(row, ''))
}

/** Every project the signed-in homeowner has posted, newest first. */
export async function listMyProjects(_homeownerId: string): Promise<Project[]> {
  const data = await graphql<{ projects: any[] }>(LIST_MY_PROJECTS)
  return data.projects.map(mapProject)
}

export async function getProject(id: string): Promise<Project | null> {
  const data = await graphql<{ projects: any[] }>(GET_PROJECT, { publicId: id })
  const row = data.projects[0]
  return row ? mapProject(row) : null
}

/**
 * The contractor's lead feed.
 *
 * ⚠️ The trade filter is a Hasura row-level permission, not a clause in this query. A plumber
 * cannot read a roofing job even by writing the GraphQL by hand — which is the whole difference
 * between a filter and a curtain.
 */
export async function listLeadsForContractor(_contractorId: string): Promise<Project[]> {
  const data = await graphql<{ projects: any[] }>(LIST_LEADS)
  return data.projects.map(mapProject)
}

/**
 * Every quote this pro has sent, with the project it was for.
 *
 * ⚠️ The permission on `quotes` restricts the contractor role to `contractor_profile_id =
 * X-Hasura-Contractor-Id`, so this returns their own bids and never a competitor's — even though
 * the query asks for all of them. That single line in the metadata is what keeps the marketplace
 * honest; without it the last pro to quote could read every rival price.
 */
export async function listMyQuotes(
  _contractorId: string,
): Promise<Array<{ quote: Quote; project: Project }>> {
  const data = await graphql<{ quotes: any[] }>(LIST_MY_QUOTES)
  return data.quotes
    // A quote whose project is not readable would map to a broken row. That should not happen —
    // the projects permission includes anything the pro has quoted on — but a `?.` here beats a
    // white screen if a permission is ever narrowed.
    .filter((row) => row.project)
    .map((row) => ({
      quote: mapQuote(row, row.project.public_id),
      project: mapProject(row.project),
    }))
}

/* ------------------------------------------------------------------------------------------- */
/* Writes — NestJS                                                                               */
/* ------------------------------------------------------------------------------------------- */

export interface CreateProjectInput {
  categoryId: string
  title: string
  description: string
  city: string
  state: string
  zip: string
  budgetMin: number
  budgetMax: number
  preferredStartDate: string
}

/** The homeowner comes from the JWT on the server — it is not sent, and would not be trusted if
 *  it were. See `ProjectsService.create`. */
export async function createProject(
  _homeownerId: string,
  input: CreateProjectInput,
): Promise<Project> {
  const created = await request<{ id: string }>('/projects', { method: 'POST', body: input })

  // The POST response is already a full project, but re-reading it through Hasura keeps ONE
  // mapping path for project shapes rather than two that can quietly drift apart.
  const project = await getProject(created.id)
  if (!project) throw new ApiError(500, 'The project was created but could not be loaded.')
  return project
}

export interface SubmitQuoteInput {
  projectId: string
  amount: number
  estimatedDays: number
  message: string
}

export async function submitQuote(_contractorId: string, input: SubmitQuoteInput): Promise<Quote> {
  return request<any>('/quotes', {
    method: 'POST',
    body: {
      projectId: input.projectId,
      amount: input.amount,
      estimatedDays: input.estimatedDays,
      ...(input.message.trim() ? { message: input.message.trim() } : {}),
    },
  })
}

/**
 * Accepting a quote declines every other one and hires the project — three writes in one
 * transaction, server side. That is precisely why this is a REST call and not a Hasura mutation:
 * a generated mutation is one write, and the other two would simply not happen.
 */
export async function acceptQuote(
  _homeownerId: string,
  projectId: string,
  quoteId: string,
): Promise<Project> {
  await request(`/projects/${projectId}/accept-quote`, { method: 'POST', body: { quoteId } })
  const project = await getProject(projectId)
  if (!project) {
    throw new ApiError(500, 'The quote was accepted but the project could not be loaded.')
  }
  return project
}

export async function advanceProjectStatus(
  _actorUserId: string,
  projectId: string,
  next: ProjectStatus,
): Promise<Project> {
  await request(`/projects/${projectId}/status`, { method: 'PATCH', body: { status: next } })
  const project = await getProject(projectId)
  if (!project) throw new ApiError(500, 'The status changed but the project could not be loaded.')
  return project
}

export interface CreateReviewInput {
  projectId: string
  rating: number
  comment: string
}

export async function createReview(_homeownerId: string, input: CreateReviewInput): Promise<Review> {
  return request<any>('/reviews', {
    method: 'POST',
    body: {
      projectId: input.projectId,
      rating: input.rating,
      ...(input.comment.trim() ? { comment: input.comment.trim() } : {}),
    },
  })
}

export interface UpdateContractorProfileInput {
  businessName: string
  bio: string
  yearsInBusiness: number
  licenseNumber: string
  city: string
  state: string
  zip: string
  serviceRadiusMiles: number
  hourlyRateMin: number
  hourlyRateMax: number
  categoryIds: string[]
}

export async function updateContractorProfile(
  _contractorId: string,
  input: UpdateContractorProfileInput,
): Promise<ContractorProfile> {
  return request<any>('/contractors/me', {
    method: 'PATCH',
    body: {
      businessName: input.businessName,
      bio: input.bio,
      yearsInBusiness: input.yearsInBusiness,
      ...(input.licenseNumber.trim() ? { licenseNumber: input.licenseNumber.trim() } : {}),
      city: input.city,
      state: input.state,
      zip: input.zip,
      serviceRadiusMiles: input.serviceRadiusMiles,
      hourlyRateMin: input.hourlyRateMin,
      hourlyRateMax: input.hourlyRateMax,
      categoryIds: input.categoryIds,
      // ⚠️ No `ratingAverage` and no `reviewCount`. Both are derived by the backend from the
      // review rows, and its DTO has no field for either — sending one is a 400.
    },
  })
}

/**
 * Uploads one portfolio photo.
 *
 * ⚠️ The two checks below are a COURTESY — they turn a doomed upload into an instant message
 * rather than a round trip. They are not the validation. NestJS sniffs the file's magic bytes and
 * ignores `file.type` entirely, because that value is whatever the client felt like sending.
 */
export async function uploadPortfolioImage(
  _contractorId: string,
  file: File,
  caption: string,
): Promise<PortfolioImage> {
  const MAX_BYTES = 5 * 1024 * 1024
  if (file.size > MAX_BYTES) throw new ApiError(413, 'Images must be 5 MB or smaller.')
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    throw new ApiError(415, 'Upload a JPEG, PNG or WebP image.')
  }

  const formData = new FormData()
  // ⚠️ The field name must match `FileInterceptor('file')` on the controller. A mismatch is not an
  // error — multer simply finds no file, and the request fails with "Choose an image to upload",
  // which sends you looking in the wrong place.
  formData.append('file', file)
  if (caption.trim()) formData.append('caption', caption.trim())

  return request<any>('/contractors/me/portfolio', { method: 'POST', formData })
}

export async function deletePortfolioImage(_contractorId: string, imageId: string): Promise<void> {
  await request(`/contractors/me/portfolio/${imageId}`, { method: 'DELETE' })
}
