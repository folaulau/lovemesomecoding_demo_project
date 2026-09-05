import { CanActivate, ForbiddenException, Injectable } from '@nestjs/common'
import type { ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'

import type { AuthenticatedUser } from '../../auth/jwt-payload.js'
import { ROLES_KEY } from '../decorators/roles.decorator.js'
import type { UserRole } from '../enums.js'

/**
 * Enforces `@Roles(...)`.
 *
 * ⚠️ Must run AFTER `JwtAuthGuard`, because it reads the user that guard attaches. Nest runs the
 * guards in `@UseGuards(A, B)` in the order they are listed, so it is always
 * `@UseGuards(JwtAuthGuard, RolesGuard)`. Reversed, this guard sees no user and rejects every
 * request with a 403 that looks like a permissions bug.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // `getAllAndOverride` checks the handler first and then the controller, so a method-level
    // `@Roles` wins over a class-level one. `get` alone would only ever see one of the two.
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    // No decorator means no role requirement — the route is open to any signed-in user.
    if (!required || required.length === 0) return true

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>()
    const user = request.user

    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException('Your account cannot do that.')
    }
    return true
  }
}
