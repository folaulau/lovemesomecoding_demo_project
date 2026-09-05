import { ForbiddenException } from '@nestjs/common'
import type { ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import { describe, expect, it, beforeEach } from 'vitest'

import type { AuthenticatedUser } from '../../auth/jwt-payload.js'
import { UserRole } from '../enums.js'
import { ROLES_KEY } from '../decorators/roles.decorator.js'
import { RolesGuard } from './roles.guard.js'

/**
 * `RolesGuard` against a fake `ExecutionContext`.
 *
 * ⚠️ This is the one part of the authorization story the e2e suite cannot pin down precisely.
 * End to end, "Nina gets a 403" is true whether the guard read the metadata correctly, or read
 * nothing and rejected everyone, or the route simply has no handler. Here the metadata and the
 * user are set one at a time, so each branch is a separate fact.
 *
 * ⚠️ And note the FIRST test. `getAllAndOverride` returning `undefined` — a route with no `@Roles`
 * — must open the route, not close it. A guard that returns `false` there would 403 every
 * unannotated endpoint, which in this app means `PATCH /projects/:id/status`, the one route that
 * deliberately has no `@Roles` because the answer depends on the row. That is a real bug this file
 * would catch and the e2e suite would report as "status transitions are broken".
 */
describe('RolesGuard', () => {
  let guard: RolesGuard
  let reflector: Reflector

  beforeEach(async () => {
    /**
     * ⚠️ `Test.createTestingModule` rather than `new RolesGuard(new Reflector())`.
     *
     * Both work today. The testing module is what keeps working when the guard grows a second
     * dependency — it resolves whatever the constructor asks for out of the same DI container the
     * application uses, so the test does not have to be edited every time the graph changes.
     * It is also the only way to supply a mock for a provider the class does not receive directly.
     */
    const moduleRef = await Test.createTestingModule({
      providers: [RolesGuard, Reflector],
    }).compile()

    guard = moduleRef.get(RolesGuard)
    reflector = moduleRef.get(Reflector)
  })

  it('allows a route with no @Roles through', () => {
    expect(guard.canActivate(contextFor(undefined, homeowner))).toBe(true)
  })

  it('allows an empty @Roles() through', () => {
    expect(guard.canActivate(contextFor([], homeowner))).toBe(true)
  })

  it('allows a user whose role is listed', () => {
    expect(guard.canActivate(contextFor([UserRole.HOMEOWNER], homeowner))).toBe(true)
  })

  it('rejects a user whose role is not listed', () => {
    const context = contextFor([UserRole.CONTRACTOR], homeowner)
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException)
  })

  /**
   * ⚠️ The ordering rule, made into a test. `RolesGuard` reads the user that `JwtAuthGuard`
   * attached, so with the guards listed the wrong way round it sees no user at all. The behaviour
   * has to be a clean 403 rather than a `TypeError` reading `.role` of undefined — a 500 there
   * would be an unauthenticated caller crashing the handler.
   */
  it('rejects when no user is attached, as happens if the guards are ordered wrongly', () => {
    const context = contextFor([UserRole.HOMEOWNER], undefined)
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException)
  })

  it('reads the metadata from the handler and the class, so a method-level @Roles can win', () => {
    const spy: Array<unknown[]> = []
    // `getAllAndOverride` is what makes a method-level decorator override a class-level one. `get`
    // alone would only ever see one of the two, and `ProjectsController` relies on the difference.
    const original = reflector.getAllAndOverride.bind(reflector)
    reflector.getAllAndOverride = ((key: string, targets: unknown[]) => {
      spy.push([key, targets])
      return original(key, targets as never)
    }) as typeof reflector.getAllAndOverride

    guard.canActivate(contextFor([UserRole.HOMEOWNER], homeowner))

    expect(spy).toHaveLength(1)
    expect(spy[0][0]).toBe(ROLES_KEY)
    expect(spy[0][1]).toHaveLength(2)
  })
})

const homeowner: AuthenticatedUser = {
  id: '1',
  publicId: '00000000-0000-4000-8000-000000000001',
  email: 'maya@contractor.test',
  role: UserRole.HOMEOWNER,
}

/**
 * The smallest thing `RolesGuard` will accept as an `ExecutionContext`.
 *
 * ⚠️ Only `getHandler`, `getClass` and `switchToHttp().getRequest()` are implemented, because
 * those are the only three the guard calls. Faking the whole interface would be a lot of code
 * asserting nothing — and the cast is what says "this is a stub, on purpose", rather than hiding
 * behind an `any` that would also hide a genuine change to what the guard needs.
 */
function contextFor(roles: string[] | undefined, user: AuthenticatedUser | undefined) {
  // The metadata is attached to a real function with `Reflect.defineMetadata`, exactly as
  // `SetMetadata` does it — so the Reflector under test is doing its real work, not a stub's.
  const handler = () => undefined
  if (roles !== undefined) Reflect.defineMetadata(ROLES_KEY, roles, handler)

  return {
    getHandler: () => handler,
    getClass: () => class StubController {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext
}
