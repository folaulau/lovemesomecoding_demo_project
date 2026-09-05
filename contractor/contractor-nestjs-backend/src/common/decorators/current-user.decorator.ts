import { createParamDecorator } from '@nestjs/common'
import type { ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'

import type { AuthenticatedUser } from '../../auth/jwt-payload.js'

/**
 * `@CurrentUser()` — the signed-in user, from the verified token.
 *
 * ⚠️ This reads what `JwtAuthGuard` put on the request. Used on a route with no guard it is
 * `undefined`, which is a `TypeError` at the first property access rather than an auth bypass —
 * but the failure is confusing, so the rule is simple: this decorator and `@UseGuards(JwtAuthGuard)`
 * always appear together.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>()
    return request.user as AuthenticatedUser
  },
)
