/**
 * The domain enumerations, shared by the entities, the DTOs and the services.
 *
 * These mirror `contractor-react-frontend/src/types/domain.ts` exactly. Two copies of an enum in
 * two languages is the one duplication this project accepts — the alternative is a code generator
 * between the two apps, which is a lot of machinery to keep six string literals in step.
 *
 * ⚠️ Written as `const` objects rather than TypeScript `enum`s, for the same reason the frontend
 * does it: a `const enum` cannot be used across module boundaries under `isolatedModules`, and a
 * regular `enum` emits a runtime object whose reverse mapping (`Status[0] === 'OPEN'`) is a
 * genuine source of bugs when the values are strings. The pattern below has neither problem, and
 * the values are plain strings that go straight into a varchar column.
 */

export const UserRole = {
  HOMEOWNER: 'homeowner',
  CONTRACTOR: 'contractor',
  /**
   * ⚠️ The value is `staff`, NOT `admin`, and that is a security decision rather than a naming
   * preference.
   *
   * `admin` is Hasura's BUILT-IN superuser role. It is not a role you configure — it is the role
   * the admin secret grants, it bypasses every permission in `hasura/metadata.mjs`, and Hasura
   * refuses to let you define permissions for it at all ("cannot define permission for admin
   * role"). A JWT whose `x-hasura-default-role` is the literal string `admin` therefore gets
   * unrestricted read AND WRITE access to every table — which would quietly reopen the one door
   * this whole architecture closes, since no NestJS service would ever see those writes.
   *
   * Naming the app's own staff role anything else keeps it an ordinary role with ordinary,
   * reviewable permissions.
   */
  STAFF: 'staff',
} as const
export type UserRole = (typeof UserRole)[keyof typeof UserRole]

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

/** `Object.values` on the const object, typed as the union rather than as `string[]`. Used by the
 *  `@IsIn` validators on the DTOs and by the CHECK constraints in the migration. */
export const USER_ROLES = Object.values(UserRole)
export const PROJECT_STATUSES = Object.values(ProjectStatus)
export const QUOTE_STATUSES = Object.values(QuoteStatus)

/**
 * A project accepts new quotes in exactly these states.
 *
 * Defined once because three services ask the question — `QuotesService` before accepting a bid,
 * `ProjectsService` before accepting a hire, and the Hasura permission that decides which projects
 * a contractor can see at all.
 */
export const QUOTABLE_STATUSES: ProjectStatus[] = [ProjectStatus.OPEN, ProjectStatus.QUOTED]
