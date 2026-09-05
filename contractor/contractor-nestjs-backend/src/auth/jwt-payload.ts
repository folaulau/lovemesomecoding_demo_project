import type { UserRole } from '../common/enums.js'

/**
 * The claim namespace Hasura reads. It is a URL by convention only — nothing is fetched from it;
 * it is a namespace string chosen to be collision-proof, and it must match Hasura's
 * `claims_namespace` (which defaults to exactly this).
 */
export const HASURA_CLAIMS_NAMESPACE = 'https://hasura.io/jwt/claims'

/**
 * ⚠️ Every Hasura session variable must be a STRING.
 *
 * Hasura substitutes these into permission expressions as text and casts on comparison. Sending
 * `x-hasura-user-id` as a JSON number produces "Session variable x-hasura-user-id not found" or a
 * type error deep inside a permission rule — never anything that names the real cause. `String()`
 * on the way in is the whole fix.
 */
export interface HasuraClaims {
  /** Every role this token may ASK for, via the `x-hasura-role` request header. */
  'x-hasura-allowed-roles': UserRole[]
  /** The role used when the request does not ask for one. */
  'x-hasura-default-role': UserRole
  /** The internal `users.id`, as a string. Permissions compare `homeowner_id` against this. */
  'x-hasura-user-id': string
  /**
   * The internal `contractor_profiles.id`, for contractors only.
   *
   * ⚠️ This is NOT the same value as `x-hasura-user-id`, and confusing the two is the easiest
   * mistake in this codebase: `quotes.contractor_profile_id` points at the profile, while
   * `projects.homeowner_id` points at the user. A permission that compares the wrong one does not
   * error — it silently matches nothing, or worse, matches the wrong rows.
   */
  'x-hasura-contractor-id'?: string
}

/** What this app signs, and therefore what it can trust after verifying. */
export interface JwtPayload {
  /** `sub` is the registered claim for "who this token is about". The PUBLIC id, never the bigint
   *  — this value ends up in a token the browser holds and can decode. */
  sub: string
  email: string
  role: UserRole
  [HASURA_CLAIMS_NAMESPACE]: HasuraClaims
}

/**
 * What `JwtAuthGuard` attaches to the request, and what `@CurrentUser()` hands to a controller.
 *
 * Deliberately not the `User` entity. A guard that loaded the full row on every request would add
 * a query to every endpoint, and most of them only need the ids — the ones that need the row fetch
 * it themselves and get a fresh copy rather than one that was true when the token was signed.
 */
export interface AuthenticatedUser {
  /** Internal `users.id`. */
  id: string
  publicId: string
  email: string
  role: UserRole
  /** Internal `contractor_profiles.id`, present only for contractors. */
  contractorId?: string
}
