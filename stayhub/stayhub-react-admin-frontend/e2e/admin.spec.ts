import { expect, test } from '@playwright/test'

const API = 'http://localhost:8000/api/v1'

async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test.describe('Admin console', () => {
  test('a non-staff account is refused, not just hidden from', async ({ page }) => {
    await login(page, 'host@stayhub.test', 'host123')
    // Refused outright rather than let in with the buttons hidden — hiding UI is not a
    // permission, and a console where nothing works and nothing says why is worse than a "no".
    await expect(page.getByText('That account does not have staff access.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })

  test('staff see real Postgres aggregates on the overview', async ({ page }) => {
    await login(page, 'admin@stayhub.test', 'admin123')

    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
    // Scoped to <main>: "Listings" is also a nav link, twice (desktop and mobile nav both
    // render), so an unscoped text match resolves to three elements.
    const main = page.getByRole('main')
    await expect(main.getByText('Listings', { exact: true })).toBeVisible()
    await expect(main.getByText('Confirmed value')).toBeVisible()

    // Cross-check one figure against the REST aggregate endpoint, so a plausible-looking number
    // that is quietly wrong cannot pass.
    const token = await page.evaluate(() => localStorage.getItem('stayhub.admin.token'))
    const stats = await fetch(`${API}/admin/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json())

    await expect(main.getByText(String(stats.totalProperties), { exact: true }).first()).toBeVisible()
  })

  test('the session survives a reload', async ({ page }) => {
    await login(page, 'admin@stayhub.test', 'admin123')
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
  })

  test('listings show drafts and suspended, which no other role can see', async ({ page }) => {
    await login(page, 'admin@stayhub.test', 'admin123')
    await page.getByRole('link', { name: 'Listings' }).first().click()

    await expect(page.getByRole('heading', { name: 'Listings' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Draft/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Suspended/ })).toBeVisible()
  })

  test('suspending a listing pulls it out of Elasticsearch', async ({ page }) => {
    await login(page, 'admin@stayhub.test', 'admin123')
    await page.getByRole('link', { name: 'Listings' }).first().click()
    await expect(page.getByRole('heading', { name: 'Listings' })).toBeVisible()

    const row = page.locator('tr', { hasText: 'Cedar Cabin' }).first()
    await row.getByRole('button', { name: 'Suspend' }).click()
    await expect(page.getByText(/removed from search/)).toBeVisible()

    // ⚠️ Elasticsearch is near-real-time, so retry the QUERY rather than the assertion.
    await expect(async () => {
      const results = await fetch(`${API}/search?q=cabin`).then((r) => r.json())
      expect(results.hits.map((h: { title: string }) => h.title)).not.toContain(
        'Cedar Cabin with Mountain Views',
      )
    }).toPass({ timeout: 15_000 })

    // Put it back, so the suite leaves the world as it found it.
    await row.getByRole('button', { name: 'Restore' }).click()
    await expect(page.getByText(/restored and reindexed/)).toBeVisible()

    await expect(async () => {
      const results = await fetch(`${API}/search?q=cabin`).then((r) => r.json())
      expect(results.hits.map((h: { title: string }) => h.title)).toContain(
        'Cedar Cabin with Mountain Views',
      )
    }).toPass({ timeout: 15_000 })
  })

  test('staff cannot deactivate their own account', async ({ page }) => {
    await login(page, 'admin@stayhub.test', 'admin123')
    await page.getByRole('link', { name: 'Users' }).first().click()

    const myRow = page.locator('tr', { hasText: '(you)' })
    await expect(myRow).toBeVisible()
    // The button is absent — and the API refuses it too, which is the rule that actually holds.
    await expect(myRow.getByRole('button', { name: 'Deactivate' })).toHaveCount(0)
  })

  test('bookings list every stay with its status', async ({ page }) => {
    await login(page, 'admin@stayhub.test', 'admin123')
    await page.getByRole('link', { name: 'Bookings' }).first().click()
    await expect(page.getByRole('heading', { name: 'Bookings' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Confirmed/ })).toBeVisible()
  })
})
