import { SetMetadata } from '@nestjs/common'

import type { UserRole } from '../enums.js'

export const ROLES_KEY = 'contractor:roles'

/**
 * `@Roles('contractor')` — which roles may call this route.
 *
 * `SetMetadata` attaches the list to the handler; `RolesGuard` reads it back with `Reflector`.
 * That indirection is what lets one guard serve every controller instead of each one writing its
 * own role check — and a role check written twice is a role check that disagrees with itself.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles)
