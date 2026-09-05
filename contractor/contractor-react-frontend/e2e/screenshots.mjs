/**
 * Regenerates the screenshots in `screenshots/`.
 *
 *   node e2e/screenshots.mjs
 *
 * Not a test — it asserts nothing. It exists so the images in the docs can be refreshed in one
 * command rather than by taking them by hand and forgetting one.
 *
 * ⚠️ Everything must be running (docker compose, the API, the dev server), and the database should
 * be freshly seeded — a screenshot taken over leftover test data is worse than no screenshot.
 */

import { mkdir } from 'node:fs/promises'

import { chromium } from '@playwright/test'

const BASE = 'http://localhost:5177'
const OUT = 'screenshots'

const HOMEOWNER = { email: 'maya@contractor.test', password: 'maya123' }
const CONTRACTOR = { email: 'luis@contractor.test', password: 'luis123' }

async function signIn(page, who) {
  await page.goto(`${BASE}/signin`)
  await page.getByLabel('Email').fill(who.email)
  await page.getByLabel('Password').fill(who.password)
  await page.locator('#main').getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.includes('signin'))
}

async function shot(page, path, name) {
  await page.goto(`${BASE}${path}`)
  // Waiting for the network to settle rather than for a fixed delay: every page here makes at
  // least one GraphQL round trip, and a timeout long enough to be safe is long enough to be slow.
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })
  console.log(`  ${name}.png`)
}

const browser = await chromium.launch()
// A fixed viewport, so a rerun on a different machine produces comparable images.
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

await mkdir(OUT, { recursive: true })

console.log('signed out:')
await shot(page, '/', '01-home')
await shot(page, '/contractors', '02-directory')

const firstPro = await page.locator('a[href^="/contractors/"]').first().getAttribute('href')
await shot(page, firstPro, '03-contractor-profile')

console.log('homeowner:')
await signIn(page, HOMEOWNER)
await shot(page, '/projects', '04-homeowner-projects')

// ⚠️ Exclude /projects/new. The "Post a project" button is also an `a[href^="/projects/"]` and it
// sits ABOVE the cards, so the naive `.first()` screenshots the empty form twice and the project
// detail page not at all — two files that differ only in name.
const firstProject = await page
  .locator('a[href^="/projects/"]:not([href="/projects/new"])')
  .first()
  .getAttribute('href')
await shot(page, firstProject, '05-project-with-quotes')
await shot(page, '/projects/new', '06-post-a-project')

console.log('contractor:')
await page.goto(`${BASE}/`)
await page.evaluate(() => localStorage.clear())
await signIn(page, CONTRACTOR)
await shot(page, '/pro/leads', '07-contractor-leads')
await shot(page, '/pro/quotes', '08-contractor-quotes')
await shot(page, '/pro/profile', '09-contractor-profile')

await browser.close()
console.log(`\ndone — ${OUT}/`)
