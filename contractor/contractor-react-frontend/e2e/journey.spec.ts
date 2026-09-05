/**
 * The whole marketplace loop, driven through the real UI against the real stack.
 *
 * This is the test that proves the three pieces fit together: React reads from Hasura, writes to
 * NestJS, and the business rules hold when a human clicks the buttons rather than when curl posts
 * the JSON.
 *
 * ⚠️ Everything must be running:
 *     docker compose up -d
 *     cd contractor-nestjs-backend && npm run migration:run && npm run seed && npm run start:prod
 *     cd contractor-react-frontend && npm run dev
 *
 * ⚠️ `workers: 1` and no parallelism (see playwright.config.ts). Every test shares ONE database, so
 * two specs running at once see each other's projects and quotes — and the failure looks like a
 * bug in the app rather than in the test setup.
 */

import { expect, test } from '@playwright/test'

const HOMEOWNER = { email: 'maya@contractor.test', password: 'maya123' }
const PLUMBER = { email: 'luis@contractor.test', password: 'luis123' }
const ELECTRICIAN = { email: 'nina@contractor.test', password: 'nina123' }

/** A title unique to this run, so a re-run does not collide with the last one's leftovers. */
const RUN = Date.now().toString().slice(-6)
const PROJECT_TITLE = `E2E ${RUN}: replace the kitchen faucet`

async function signIn(page: import('@playwright/test').Page, who: { email: string; password: string }) {
  await page.goto('/signin')
  await page.getByLabel('Email').fill(who.email)
  await page.getByLabel('Password').fill(who.password)
  // ⚠️ Scoped to #main. The header ALSO has a "Sign in" button, and an unscoped role locator
  // matches both — Playwright's strict mode then fails rather than guessing. Scoping beats
  // `.first()`, which would silently keep passing if the two ever swapped order.
  await page.locator('#main').getByRole('button', { name: 'Sign in' }).click()
  // Waiting for the nav to change rather than for a fixed timeout: the redirect target differs by
  // role, so the assertion is "we left the sign-in page", not "we arrived somewhere specific".
  await expect(page).not.toHaveURL(/signin/)
}

async function signOut(page: import('@playwright/test').Page) {
  await page.getByRole('banner').getByRole('button', { name: /^(Maya|Luis|Nina)$/ }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(page.getByRole('banner').getByRole('button', { name: 'Sign in' })).toBeVisible()
}

test.describe('the marketplace loop', () => {
  test('anonymous visitors can browse pros but not projects', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /Find a pro for anything/ })).toBeVisible()

    // The directory is served by Hasura under the `anonymous` role. If the JWT link were sending
    // `Bearer null` this would be empty — see the note in lib/apollo.ts.
    await expect(page.getByRole('heading', { name: 'Top-rated pros near you' })).toBeVisible()
    await expect(page.getByText('Rivera Plumbing Co.').first()).toBeVisible()

    await page.goto('/contractors')
    await expect(page.getByText(/pros? found/)).toBeVisible()

    // Filtering by trade goes through the join table in the `where` clause.
    await page.getByRole('button', { name: /Plumbing/ }).click()
    await expect(page).toHaveURL(/category=plumbing/)
    await expect(page.getByText('Rivera Plumbing Co.').first()).toBeVisible()
    await expect(page.getByText('BrightSpark Electric')).toHaveCount(0)

    // A guarded route with no session lands on sign-in rather than rendering an empty dashboard.
    await page.goto('/projects')
    await expect(page).toHaveURL(/signin/)
  })

  test('a contractor profile shows portfolio and reviews', async ({ page }) => {
    await page.goto('/contractors')
    await page.getByText('TrueLine Painting').first().click()

    await expect(page.getByRole('heading', { name: 'TrueLine Painting' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Recent work' })).toBeVisible()
    // The seeded review, and the rating recomputed from it by the backend.
    await expect(page.getByText(/Marco found rot in two soffit boards/)).toBeVisible()
    await expect(page.getByText('Rated 5.0 out of 5').first()).toBeVisible()
  })

  test('post a project, quote it, hire, complete and review', async ({ page }) => {
    /* ---- the homeowner posts a job ------------------------------------------------------- */
    await signIn(page, HOMEOWNER)
    await expect(page).toHaveURL(/projects/)

    await page.goto('/projects/new')
    // ⚠️ Click the LABEL, not the radio. The inputs on this form are `sr-only` — a 1px box behind
    // a sticky header — so `.check()` scrolls to it and the header intercepts the click. The label
    // is the visible control, and clicking it is also what a real user does.
    await page.locator('label').filter({ hasText: 'Plumbing' }).click()
    await page.getByLabel('Title').fill(PROJECT_TITLE)
    await page
      .getByLabel('Describe the job')
      .fill('The kitchen faucet drips constantly and the shutoff underneath is seized solid.')
    await page.getByLabel('City').fill('Austin')
    await page.getByLabel('State').fill('TX')
    await page.getByLabel('ZIP').fill('78704')
    await page.getByLabel('Budget from').fill('200')
    await page.getByLabel('Budget to').fill('600')
    await page.getByLabel('Preferred start date').fill('2026-10-15')
    await page.getByRole('button', { name: 'Post project' }).click()

    await expect(page.getByRole('heading', { name: PROJECT_TITLE })).toBeVisible()
    await expect(page.getByText('Open', { exact: true })).toBeVisible()
    await expect(page.getByText('No quotes yet')).toBeVisible()
    const projectUrl = page.url()

    await signOut(page)

    /* ---- RULE 1: the electrician cannot see a plumbing job -------------------------------- */
    await signIn(page, ELECTRICIAN)
    await page.goto('/pro/leads')
    // Nina works in Electrical only. Hasura's row-level permission is what excludes this row —
    // the query itself asks for every open project.
    await expect(page.getByText(PROJECT_TITLE)).toHaveCount(0)
    await signOut(page)

    /* ---- the plumber quotes --------------------------------------------------------------- */
    await signIn(page, PLUMBER)
    await page.goto('/pro/leads')
    await expect(page.getByText(PROJECT_TITLE)).toBeVisible()
    await page.getByText(PROJECT_TITLE).click()

    await page.getByLabel('Your price').fill('425')
    await page.getByLabel('Days of work').fill('1')
    await page.getByLabel('Message').fill('New faucet plus both angle stops, parts included.')
    await page.getByRole('button', { name: 'Send quote' }).click()

    await expect(page.getByRole('heading', { name: 'Your quote' })).toBeVisible()
    await expect(page.getByText('$425')).toBeVisible()
    await expect(page.getByText('Awaiting decision')).toBeVisible()

    /* ---- RULE 2: the same pro cannot quote twice ------------------------------------------ */
    // The form is gone entirely once a quote exists — the UI half of the rule. The backend half
    // is the unique constraint, covered by the API smoke test.
    await expect(page.getByRole('button', { name: 'Send quote' })).toHaveCount(0)
    await signOut(page)

    /* ---- the homeowner hires -------------------------------------------------------------- */
    await signIn(page, HOMEOWNER)
    await page.goto(projectUrl)
    await expect(page.getByText('Rivera Plumbing Co.').first()).toBeVisible()
    await page.getByRole('button', { name: 'Accept this quote' }).click()

    // RULE 4: accepting hires the project and marks the quote accepted, in one transaction.
    await expect(page.getByText('You hired')).toBeVisible()
    await expect(page.getByText('Pro hired')).toBeVisible()
    await expect(page.getByText('Accepted', { exact: true })).toBeVisible()

    /* ---- RULE 5: only the hired pro advances the work ------------------------------------- */
    // The homeowner is offered no button to start or complete the job.
    await expect(page.getByRole('button', { name: 'Start work' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Mark complete' })).toHaveCount(0)
    await signOut(page)

    await signIn(page, PLUMBER)
    await page.goto('/pro/quotes')
    await expect(page.getByText(PROJECT_TITLE)).toBeVisible()
    await page.getByRole('button', { name: 'Start work' }).click()
    await expect(page.getByText('In progress')).toBeVisible()
    await page.getByRole('button', { name: 'Mark complete' }).click()
    await expect(page.getByText('Finished — waiting on their review.')).toBeVisible()
    await signOut(page)

    /* ---- RULE 6: the review, once and only once ------------------------------------------- */
    await signIn(page, HOMEOWNER)
    await page.goto(projectUrl)
    await expect(page.getByRole('heading', { name: 'How did it go?' })).toBeVisible()

    // Same reason as the category radios above: the star inputs are visually hidden inside their
    // labels. `title` is the stable handle on each one.
    await page.locator('label[title="4 stars"]').click()
    await page
      .getByLabel('What should other homeowners know?')
      .fill('Quick, tidy, and explained why the shutoff had seized.')
    await page.getByRole('button', { name: 'Submit review' }).click()

    await expect(page.getByRole('heading', { name: 'Your review' })).toBeVisible()
    // The form is replaced by the saved review — there is no second submit.
    await expect(page.getByRole('button', { name: 'Submit review' })).toHaveCount(0)

    /* ---- RULE 7: the rating is recomputed server-side ------------------------------------- */
    await page.goto('/contractors')
    await page.getByText('Rivera Plumbing Co.').first().click()
    await expect(page.getByRole('heading', { name: 'Rivera Plumbing Co.' })).toBeVisible()
    await expect(page.getByText(/Quick, tidy, and explained/)).toBeVisible()
  })

  test('a contractor never sees a rival quote', async ({ page }) => {
    // The seeded water-heater project has TWO quotes on it: Rivera's and Northgate's.
    await signIn(page, PLUMBER)
    await page.goto('/pro/leads')
    await page.getByText('Replace leaking 50-gallon water heater').click()

    // Luis sees his own price and the fact that competition exists — never what they charged.
    await expect(page.getByText('$2,450')).toBeVisible()
    await expect(page.getByText('$2,890')).toHaveCount(0)
    await expect(page.getByText('Northgate HVAC')).toHaveCount(0)
    await signOut(page)

    // The homeowner, on the same project, sees both.
    await signIn(page, HOMEOWNER)
    await page.goto('/projects')
    await page.getByText('Replace leaking 50-gallon water heater').click()
    await expect(page.getByText('$2,450')).toBeVisible()
    await expect(page.getByText('$2,890')).toBeVisible()
    await expect(page.getByText('Northgate HVAC')).toBeVisible()
  })

  test('a homeowner sees only their own projects', async ({ page }) => {
    await signIn(page, HOMEOWNER)
    await page.goto('/projects')
    // Daniel's roof inspection is the other homeowner's, and the Hasura permission excludes it.
    await expect(page.getByText('Roof inspection after hail storm')).toHaveCount(0)
    await expect(page.getByText('Install recessed lighting in living room')).toBeVisible()
  })
})
