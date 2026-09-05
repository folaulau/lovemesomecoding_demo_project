/**
 * The seven business rules, tested against the real application and the real database.
 *
 * These are the rules that justify the whole architecture — the reason writes go through NestJS
 * instead of through a generated Hasura mutation. If any of them can be broken by a crafted
 * request, the split has bought nothing.
 *
 * ⚠️ Needs Postgres up and migrated:
 *     docker compose up -d
 *     npm run migration:run && npm run seed
 *     npm run test:e2e
 *
 * ⚠️ These tests WRITE to the same database the app uses, and they clean up after themselves in
 * `afterAll`. A leftover project from a failed run would show up in the next run's lead feed and
 * in the Playwright suite, and the failure would look like a bug in the app.
 */

import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { DataSource } from 'typeorm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { AppModule } from '../src/app.module.js'
import { ProjectStatus, QuoteStatus } from '../src/common/enums.js'

/** Every project this file creates carries this prefix, so cleanup can find them all. */
const PREFIX = `RULETEST-${Date.now().toString().slice(-6)}`

const MAYA = { email: 'maya@contractor.test', password: 'maya123' } // homeowner
const DANIEL = { email: 'daniel@contractor.test', password: 'daniel123' } // a DIFFERENT homeowner
const LUIS = { email: 'luis@contractor.test', password: 'luis123' } // plumbing + hvac
const NINA = { email: 'nina@contractor.test', password: 'nina123' } // electrical only

describe('business rules', () => {
  let app: INestApplication
  let http: ReturnType<typeof request>
  let dataSource: DataSource

  let mayaToken: string
  let danielToken: string
  let luisToken: string
  let ninaToken: string
  let plumbingCategoryId: string

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()

    // ⚠️ The SAME pipe configuration as main.ts. Without it the DTO decorators are inert and every
    // validation assertion below passes vacuously — a test suite that proves nothing while looking
    // thorough.
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    )
    await app.init()

    http = request(app.getHttpServer())
    dataSource = app.get(DataSource)

    mayaToken = await signIn(MAYA)
    danielToken = await signIn(DANIEL)
    luisToken = await signIn(LUIS)
    ninaToken = await signIn(NINA)

    const [category] = await dataSource.query<Array<{ public_id: string }>>(
      `SELECT public_id FROM service_categories WHERE slug = 'plumbing'`,
    )
    plumbingCategoryId = category.public_id
  })

  afterAll(async () => {
    // Reviews and quotes cascade from projects; the projects themselves have to go explicitly.
    if (dataSource?.isInitialized) {
      await dataSource.query(`DELETE FROM projects WHERE title LIKE $1`, [`${PREFIX}%`])
      // The seeded ratings are recomputed from whatever reviews survive, so a test review that is
      // deleted must not leave its contribution behind in the cached average.
      await dataSource.query(`
        UPDATE contractor_profiles p SET
          review_count   = COALESCE(r.count, 0),
          rating_average = COALESCE(r.average, 0)
        FROM (SELECT id FROM contractor_profiles) all_p
        LEFT JOIN (
          SELECT contractor_profile_id AS id, COUNT(*) AS count, ROUND(AVG(rating), 2) AS average
          FROM reviews GROUP BY contractor_profile_id
        ) r ON r.id = all_p.id
        WHERE p.id = all_p.id
      `)
    }
    await app?.close()
  })

  async function signIn(who: { email: string; password: string }): Promise<string> {
    const response = await http.post('/api/v1/auth/login').send(who).expect(200)
    return response.body.token
  }

  /** Posts a fresh plumbing project as Maya and returns its public id. */
  async function createProject(suffix: string): Promise<string> {
    const response = await http
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${mayaToken}`)
      .send({
        categoryId: plumbingCategoryId,
        title: `${PREFIX} ${suffix}`,
        description: 'A test project with a description long enough to pass validation.',
        city: 'Austin',
        state: 'TX',
        zip: '78704',
        budgetMin: 200,
        budgetMax: 600,
        preferredStartDate: '2026-11-01',
      })
      .expect(201)
    return response.body.id
  }

  /**
   * ⚠️ NOT `async`. It returns supertest's request object, which is thenable AND carries `.expect`.
   * Marking it `async` wraps that in a plain Promise, so `quote(...).expect(201)` becomes
   * "expect is not a function" — the request still fires, so the failure appears one line later
   * than the mistake.
   */
  function quote(token: string, projectId: string, amount = 400) {
    return http
      .post('/api/v1/quotes')
      .set('Authorization', `Bearer ${token}`)
      .send({ projectId, amount, estimatedDays: 1, message: 'A test quote.' })
  }

  /* --------------------------------------------------------------------------------------- */

  describe('authentication', () => {
    it('gives the same answer for a wrong password and an unknown address', async () => {
      const wrongPassword = await http
        .post('/api/v1/auth/login')
        .send({ email: MAYA.email, password: 'not-it' })
        .expect(401)

      const noSuchUser = await http
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@contractor.test', password: 'not-it' })
        .expect(401)

      // ⚠️ Identical, deliberately. Any difference here turns the login form into an oracle for
      // which email addresses are registered.
      expect(wrongPassword.body.message).toBe(noSuchUser.body.message)
    })

    it('refuses a forged token', async () => {
      // `alg: none` with a hand-written admin payload — the attack `verifyAsync` exists to stop,
      // and the one `jwtService.decode` would happily accept.
      const forged =
        'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4Iiwicm9sZSI6InN0YWZmIn0.'
      await http
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${forged}`)
        .send({})
        .expect(401)
    })

    it('will not create a staff account from a request body', async () => {
      await http
        .post('/api/v1/auth/register')
        .send({
          email: `${PREFIX}-escalate@contractor.test`,
          password: 'password123',
          firstName: 'Mallory',
          lastName: 'Escalation',
          role: 'staff',
        })
        .expect(400)
    })

    it('strips unknown properties rather than passing them through', async () => {
      // `forbidNonWhitelisted` turns an unexpected field into a 400 instead of silently dropping
      // it — louder, and it names the field.
      const response = await http
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mayaToken}`)
        .send({ categoryId: plumbingCategoryId, homeownerId: '1', title: 'x' })
        .expect(400)

      expect(JSON.stringify(response.body.message)).toContain('homeownerId')
    })
  })

  describe('rule 1 — a contractor may only quote in a trade they work in', () => {
    it('refuses a quote from a pro outside the trade', async () => {
      const projectId = await createProject('rule1')
      const response = await quote(ninaToken, projectId).expect(403)
      expect(response.body.message).toContain('Plumbing')
    })

    it('accepts a quote from a pro inside the trade', async () => {
      const projectId = await createProject('rule1-ok')
      const response = await quote(luisToken, projectId).expect(201)
      expect(response.body.status).toBe(QuoteStatus.PENDING)
    })
  })

  describe('rule 2 — one quote per contractor per project, and only while open', () => {
    it('refuses a second quote from the same contractor', async () => {
      const projectId = await createProject('rule2')
      await quote(luisToken, projectId).expect(201)

      const second = await quote(luisToken, projectId, 350).expect(409)
      expect(second.body.message).toContain('already quoted')
    })

    it('moves the project from open to quoted on the first quote', async () => {
      const projectId = await createProject('rule2-status')

      const before = await projectRow(projectId)
      expect(before.status).toBe(ProjectStatus.OPEN)

      await quote(luisToken, projectId).expect(201)

      const after = await projectRow(projectId)
      expect(after.status).toBe(ProjectStatus.QUOTED)
    })
  })

  describe('rule 3 — only the owning homeowner may accept', () => {
    it('answers 404, not 403, for another homeowner', async () => {
      const projectId = await createProject('rule3')
      const quoteId = (await quote(luisToken, projectId).expect(201)).body.id

      // ⚠️ 404 matters. A 403 would confirm the project exists, which on a guessable id turns this
      // endpoint into a slow enumeration of every job on the site.
      await http
        .post(`/api/v1/projects/${projectId}/accept-quote`)
        .set('Authorization', `Bearer ${danielToken}`)
        .send({ quoteId })
        .expect(404)
    })
  })

  describe('rule 4 — accepting one quote declines the others, atomically', () => {
    it('accepts one, declines the rest and hires the project', async () => {
      const projectId = await createProject('rule4')
      const winner = (await quote(luisToken, projectId, 400).expect(201)).body.id

      // A second bid from a different pro who also works in plumbing... there is only one plumber
      // in the seed, so the rival is inserted directly. The rule under test is the CASCADE, not
      // how the second quote got there.
      await insertRivalQuote(projectId)

      const response = await http
        .post(`/api/v1/projects/${projectId}/accept-quote`)
        .set('Authorization', `Bearer ${mayaToken}`)
        .send({ quoteId: winner })
        .expect(201)

      expect(response.body.status).toBe(ProjectStatus.HIRED)

      const statuses = await dataSource.query<Array<{ public_id: string; status: string }>>(
        `SELECT q.public_id, q.status FROM quotes q
         JOIN projects p ON p.id = q.project_id WHERE p.public_id = $1`,
        [projectId],
      )
      expect(statuses.filter((q) => q.status === QuoteStatus.ACCEPTED)).toHaveLength(1)
      expect(statuses.filter((q) => q.status === QuoteStatus.DECLINED)).toHaveLength(1)
      expect(statuses.find((q) => q.public_id === winner)?.status).toBe(QuoteStatus.ACCEPTED)
    })

    it('refuses a second acceptance', async () => {
      const projectId = await createProject('rule4-twice')
      const quoteId = (await quote(luisToken, projectId).expect(201)).body.id

      await http
        .post(`/api/v1/projects/${projectId}/accept-quote`)
        .set('Authorization', `Bearer ${mayaToken}`)
        .send({ quoteId })
        .expect(201)

      await http
        .post(`/api/v1/projects/${projectId}/accept-quote`)
        .set('Authorization', `Bearer ${mayaToken}`)
        .send({ quoteId })
        .expect(409)
    })

    it('refuses a new quote once the project is hired', async () => {
      const projectId = await createProject('rule4-closed')
      const quoteId = (await quote(luisToken, projectId).expect(201)).body.id
      await http
        .post(`/api/v1/projects/${projectId}/accept-quote`)
        .set('Authorization', `Bearer ${mayaToken}`)
        .send({ quoteId })
        .expect(201)

      // `findQuotableOrFail` answers 404 rather than 409 — from a pro's point of view a hired
      // project is not a project they can act on at all.
      await quote(ninaToken, projectId).expect(404)
    })
  })

  describe('rule 5 — only the hired contractor advances the work', () => {
    it('refuses the homeowner, allows the hired pro, and rejects illegal jumps', async () => {
      const projectId = await createProject('rule5')
      const quoteId = (await quote(luisToken, projectId).expect(201)).body.id
      await http
        .post(`/api/v1/projects/${projectId}/accept-quote`)
        .set('Authorization', `Bearer ${mayaToken}`)
        .send({ quoteId })
        .expect(201)

      // The homeowner does not own this transition.
      await patchStatus(mayaToken, projectId, ProjectStatus.IN_PROGRESS).expect(404)
      // Nor does a contractor who was not hired.
      await patchStatus(ninaToken, projectId, ProjectStatus.IN_PROGRESS).expect(404)

      await patchStatus(luisToken, projectId, ProjectStatus.IN_PROGRESS).expect(200)
      await patchStatus(luisToken, projectId, ProjectStatus.COMPLETED).expect(200)

      // The transition table is an allowlist, so going backwards is not merely discouraged.
      await patchStatus(luisToken, projectId, ProjectStatus.OPEN).expect(409)
    })

    it('lets the homeowner cancel only before anyone is hired', async () => {
      const cancellable = await createProject('rule5-cancel')
      await patchStatus(mayaToken, cancellable, ProjectStatus.CANCELLED).expect(200)

      const hired = await createProject('rule5-nocancel')
      const quoteId = (await quote(luisToken, hired).expect(201)).body.id
      await http
        .post(`/api/v1/projects/${hired}/accept-quote`)
        .set('Authorization', `Bearer ${mayaToken}`)
        .send({ quoteId })
        .expect(201)

      await patchStatus(mayaToken, hired, ProjectStatus.CANCELLED).expect(409)
    })
  })

  describe('rules 6 and 7 — the review, and the rating it recomputes', () => {
    it('refuses a review before the work is complete', async () => {
      const projectId = await createProject('rule6-early')
      await quote(luisToken, projectId).expect(201)

      const response = await http
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${mayaToken}`)
        .send({ projectId, rating: 5, comment: 'too soon' })
        .expect(409)

      expect(response.body.message).toContain('marked complete')
    })

    it('accepts one review, refuses the second, and recomputes the rating', async () => {
      const projectId = await completedProject('rule6')

      const before = await contractorRating('Rivera Plumbing Co.')

      await http
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${mayaToken}`)
        .send({ projectId, rating: 4, comment: 'Tidy work.' })
        .expect(201)

      const after = await contractorRating('Rivera Plumbing Co.')
      expect(after.review_count).toBe(before.review_count + 1)

      // ⚠️ The average is DERIVED from the rows, not incremented. Recomputing the expected value
      // the same way the service does is what makes this an assertion rather than a restatement.
      const rows = await dataSource.query<Array<{ rating: number }>>(
        `SELECT r.rating FROM reviews r
         JOIN contractor_profiles c ON c.id = r.contractor_profile_id
         WHERE c.business_name = 'Rivera Plumbing Co.'`,
      )
      const expected = rows.reduce((sum, r) => sum + r.rating, 0) / rows.length
      expect(Number(after.rating_average)).toBeCloseTo(expected, 2)

      await http
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${mayaToken}`)
        .send({ projectId, rating: 1, comment: 'again' })
        .expect(409)
    })

    it('rejects a rating outside 1–5', async () => {
      const projectId = await completedProject('rule6-range')
      await http
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${mayaToken}`)
        .send({ projectId, rating: 9, comment: 'nine stars' })
        .expect(400)
    })

    it('refuses a review from a homeowner who does not own the project', async () => {
      const projectId = await completedProject('rule6-other')
      await http
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${danielToken}`)
        .send({ projectId, rating: 5, comment: 'not mine' })
        .expect(404)
    })

    it('never accepts a rating from the profile endpoint', async () => {
      // The contractor DTO has no field for it, and `forbidNonWhitelisted` makes sending one a 400
      // rather than a silently ignored property.
      const response = await http
        .patch('/api/v1/contractors/me')
        .set('Authorization', `Bearer ${luisToken}`)
        .send({
          businessName: 'Rivera Plumbing Co.',
          yearsInBusiness: 17,
          city: 'Austin',
          state: 'TX',
          zip: '78704',
          serviceRadiusMiles: 30,
          hourlyRateMin: 95,
          hourlyRateMax: 145,
          categoryIds: [],
          ratingAverage: 5,
        })
        .expect(400)

      expect(JSON.stringify(response.body.message)).toContain('ratingAverage')
    })
  })

  /* --------------------------------------------------------------------------------------- */
  /* Helpers                                                                                   */
  /* --------------------------------------------------------------------------------------- */

  function patchStatus(token: string, projectId: string, status: string) {
    return http
      .patch(`/api/v1/projects/${projectId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status })
  }

  async function projectRow(publicId: string): Promise<{ status: string }> {
    const [row] = await dataSource.query<Array<{ status: string }>>(
      `SELECT status FROM projects WHERE public_id = $1`,
      [publicId],
    )
    return row
  }

  async function contractorRating(
    businessName: string,
  ): Promise<{ rating_average: string; review_count: number }> {
    const [row] = await dataSource.query<Array<{ rating_average: string; review_count: number }>>(
      `SELECT rating_average, review_count FROM contractor_profiles WHERE business_name = $1`,
      [businessName],
    )
    return row
  }

  /** A second bid on the same project, inserted directly — the seed has only one plumber. */
  async function insertRivalQuote(projectPublicId: string): Promise<void> {
    await dataSource.query(
      `INSERT INTO quotes (project_id, contractor_profile_id, amount, estimated_days, message, status)
       SELECT p.id, c.id, 999, 2, 'rival bid', 'pending'
       FROM projects p, contractor_profiles c
       WHERE p.public_id = $1 AND c.business_name = 'Northgate HVAC'`,
      [projectPublicId],
    )
  }

  /** Runs a project all the way to `completed` so a review can be left on it. */
  async function completedProject(suffix: string): Promise<string> {
    const projectId = await createProject(suffix)
    const quoteId = (await quote(luisToken, projectId).expect(201)).body.id
    await http
      .post(`/api/v1/projects/${projectId}/accept-quote`)
      .set('Authorization', `Bearer ${mayaToken}`)
      .send({ quoteId })
      .expect(201)
    await patchStatus(luisToken, projectId, ProjectStatus.IN_PROGRESS).expect(200)
    await patchStatus(luisToken, projectId, ProjectStatus.COMPLETED).expect(200)
    return projectId
  }
})
