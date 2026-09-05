import { Column, Entity, Index, OneToMany, OneToOne } from 'typeorm'

import { USER_ROLES } from '../../common/enums.js'
import type { UserRole } from '../../common/enums.js'
import { BaseEntity } from './base.entity.js'
import type { ContractorProfile } from './contractor-profile.entity.js'
import type { Project } from './project.entity.js'

/**
 * One account, whichever side of the job it is on.
 *
 * The README asks for a single app serving homeowners and contractors, so there is one `users`
 * table and a `role` column rather than two tables. A contractor additionally has a
 * `ContractorProfile` row holding everything a homeowner has no use for.
 *
 * ⚠️ Note the `.js` on every relative import in this file. The Nest scaffold is ESM
 * (`"type": "module"` with `moduleResolution: nodenext`), and Node's ESM resolver does not guess
 * extensions — the specifier has to name the file that will exist at runtime, which is the
 * COMPILED `.js`, even though the source next to it is `.ts`. Leave the extension off and it
 * compiles fine and then dies at startup with `ERR_MODULE_NOT_FOUND`.
 */
@Entity('users')
export class User extends BaseEntity {
  /**
   * ⚠️ Unique, and stored lower-cased by `AuthService` before it ever reaches here. Postgres
   * comparison is case-SENSITIVE, so without normalising, `Maya@x.com` and `maya@x.com` are two
   * different accounts that both pass the unique constraint — and the second one can never sign in
   * because the login lookup will not find it consistently.
   */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email: string

  /**
   * ⚠️ The bcrypt hash. Never the password.
   *
   * 60 characters is exactly what bcrypt produces (`$2b$` + cost + 22-char salt + 31-char digest).
   * The column is deliberately not called `password`, so that a stray `console.log(user)` in a
   * review reads as obviously wrong rather than merely careless.
   *
   * It is excluded from every response by `@Exclude()` on the DTO — see `users/dto/user.dto.ts`.
   */
  @Column({ type: 'varchar', length: 72, name: 'password_hash' })
  passwordHash: string

  @Column({ type: 'varchar', length: 80, name: 'first_name' })
  firstName: string

  @Column({ type: 'varchar', length: 80, name: 'last_name' })
  lastName: string

  /** Nullable: a homeowner can sign up without one and add it later. Stored as text, not as a
   *  number — phone "numbers" have leading zeros, extensions and punctuation. */
  @Column({ type: 'varchar', length: 40, nullable: true })
  phone: string | null

  /**
   * ⚠️ Set ONLY by the server. `AuthService.register` accepts `homeowner` or `contractor` from the
   * sign-up form and rejects anything else outright; nothing anywhere can set `admin` through the
   * API. A role that can be chosen in a request body is the shortest path to privilege escalation
   * in an app like this.
   */
  @Column({ type: 'varchar', length: 20 })
  role: UserRole

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'avatar_url' })
  avatarUrl: string | null

  /**
   * Soft delete. Bookings, quotes and reviews reference a user forever — a hard delete would
   * either cascade away a contractor's whole review history or fail on the foreign key.
   */
  @Column({ type: 'boolean', default: false })
  deleted: boolean

  /**
   * ⚠️ `type` is a FUNCTION returning the class, not the class itself, and this is not a style
   * choice. `user.entity.ts` and `contractor-profile.entity.ts` import each other; a direct class
   * reference would be evaluated while the other module is still initialising and read as
   * `undefined`. The thunk defers it until both modules exist.
   *
   * The matching `import type` above is the other half: a type-only import is erased at compile
   * time, so it cannot create the runtime cycle in the first place.
   */
  @OneToOne('ContractorProfile', (profile: ContractorProfile) => profile.user)
  contractorProfile: ContractorProfile | null

  @OneToMany('Project', (project: Project) => project.homeowner)
  projects: Project[]

  /** Convenience for logging and for the JWT payload; not a column. */
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`
  }
}

/** Re-exported so the migration and the seed can build the CHECK constraint from one list. */
export const USER_ROLE_VALUES = USER_ROLES
