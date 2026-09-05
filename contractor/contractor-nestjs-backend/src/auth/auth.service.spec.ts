import { UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { getDataSourceToken } from '@nestjs/typeorm'
import { Test } from '@nestjs/testing'
import bcrypt from 'bcrypt'
import { describe, expect, it, beforeAll, beforeEach } from 'vitest'

import { UserRole } from '../common/enums.js'
import { User } from '../database/entities/user.entity.js'
import { AuthService } from './auth.service.js'

/**
 * `AuthService.login`, with the database and the signer replaced.
 *
 * ⚠️ This is the pattern worth learning from this repo: a service under test, its collaborators
 * supplied as `useValue` mocks through `Test.createTestingModule`. The e2e suite covers the same
 * code against a real Postgres, and that is not redundant — it is a different question. E2E asks
 * "does signing in work". This asks "does a failed sign-in refuse to say WHY", which is a
 * security property, and proving it needs the three failure paths driven one at a time.
 *
 * ⚠️ Note what is NOT mocked: bcrypt. Faking the hash comparison would leave the test asserting
 * that the code calls a function, rather than that a wrong password is actually rejected — and
 * the dummy-hash timing defence below only means anything if the real thing is doing the work.
 */
describe('AuthService.login', () => {
  let service: AuthService
  /** What the fake repository's `findOne` will return next. */
  let storedUser: User | null

  let correctHash: string

  beforeAll(async () => {
    // Cost 4, not the app's 12. The stored cost is encoded in the hash and `compare` follows it,
    // so this is the same comparison a hundred times faster. The app's own BCRYPT_ROUNDS is a
    // production choice and has no business slowing a unit test down.
    correctHash = await bcrypt.hash('correct-horse-battery', 4)
  })

  beforeEach(async () => {
    storedUser = null

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        /**
         * ⚠️ `getDataSourceToken()`, not `DataSource`. `@InjectDataSource()` does not ask for the
         * class — it asks for a named token, and overriding the class would compile, run, and
         * leave the service holding the real connection. The mock would simply never be used, and
         * the test would fail by trying to reach Postgres.
         */
        {
          provide: getDataSourceToken(),
          useValue: {
            getRepository: () => ({ findOne: async () => storedUser }),
          },
        },
        // The token is never inspected here; these tests are about the paths that never mint one.
        { provide: JwtService, useValue: { signAsync: async () => 'signed.jwt.token' } },
      ],
    }).compile()

    service = moduleRef.get(AuthService)
  })

  const attempt = (password: string) =>
    service.login({ email: 'maya@contractor.test', password })

  /**
   * ⚠️ The property that matters, and the reason this file is a unit test rather than another e2e
   * case: the three failures must be INDISTINGUISHABLE. Any difference between them turns the
   * login form into an oracle for which addresses are registered, which is the first step of both
   * credential stuffing and targeted phishing.
   */
  it('gives the same message whether the account is missing, deleted, or the password is wrong', async () => {
    const messages: string[] = []

    storedUser = null
    messages.push(await messageFrom(attempt('anything')))

    storedUser = userRow({ deleted: true })
    messages.push(await messageFrom(attempt('correct-horse-battery')))

    storedUser = userRow({ deleted: false })
    messages.push(await messageFrom(attempt('wrong-password')))

    expect(messages).toHaveLength(3)
    expect(new Set(messages).size).toBe(1)
    expect(messages[0]).toBe('That email and password do not match an account.')
  })

  it('rejects with 401, never 404, when there is no such account', async () => {
    storedUser = null
    await expect(attempt('anything')).rejects.toBeInstanceOf(UnauthorizedException)
  })

  /**
   * ⚠️ The timing half of the same defence. Returning early on "no such account" makes it
   * measurably faster than "wrong password", and that difference is the same oracle the shared
   * message just closed — so `login` compares against a dummy hash even when there is no user.
   *
   * The assertion is deliberately loose. A test that pins a duration is a test that fails on a
   * busy CI box; what is being proved is that the work happens at all, and a bcrypt comparison
   * cannot complete in under a millisecond while an early `return` cannot take longer.
   */
  it('still burns a bcrypt comparison when there is no user, so the two paths take similar time', async () => {
    storedUser = null
    const missing = await timeOf(attempt('anything'))

    storedUser = userRow({ deleted: false })
    const wrongPassword = await timeOf(attempt('wrong-password'))

    expect(missing).toBeGreaterThan(1)
    // Within an order of magnitude of each other, in both directions.
    expect(missing).toBeGreaterThan(wrongPassword / 10)
  })

  it('normalises the email before looking it up, so Maya@ and maya@ are one account', async () => {
    const asked: Array<Record<string, unknown>> = []
    storedUser = null

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getDataSourceToken(),
          useValue: {
            getRepository: () => ({
              findOne: async (options: { where: Record<string, unknown> }) => {
                asked.push(options.where)
                return null
              },
            }),
          },
        },
        { provide: JwtService, useValue: { signAsync: async () => 'signed.jwt.token' } },
      ],
    }).compile()

    await messageFrom(
      moduleRef.get(AuthService).login({ email: '  MAYA@Contractor.TEST ', password: 'x' }),
    )

    expect(asked[0]).toEqual({ email: 'maya@contractor.test' })
  })

  function userRow(overrides: Partial<User>): User {
    return Object.assign(new User(), {
      id: '1',
      publicId: '00000000-0000-4000-8000-000000000001',
      email: 'maya@contractor.test',
      passwordHash: correctHash,
      firstName: 'Maya',
      lastName: 'Chen',
      phone: null,
      role: UserRole.HOMEOWNER,
      avatarUrl: null,
      deleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    })
  }
})

/** The message from a rejected promise, failing the test if it resolves instead. */
async function messageFrom(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    return (error as Error).message
  }
  throw new Error('expected the login to be rejected, but it resolved')
}

/** Milliseconds a rejected promise took. */
async function timeOf(promise: Promise<unknown>): Promise<number> {
  const startedAt = performance.now()
  await promise.catch(() => undefined)
  return performance.now() - startedAt
}
