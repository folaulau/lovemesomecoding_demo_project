import { expect, test } from '@playwright/test'
import { API, apiLogin, login } from './helpers'

/** Delete every listing a previous run left behind, so a failure does not poison later runs. */
async function removeTestListings() {
  const token = await apiLogin('host')
  const mine = await fetch(`${API}/properties/mine`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json())

  for (const listing of mine) {
    if (listing.title.startsWith('E2E Test Cottage')) {
      await fetch(`${API}/properties/${listing.publicId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
    }
  }
}

test.describe('Hosting — /hosts/* in the same app as guest browsing', () => {
  test.beforeAll(removeTestListings)
  test.afterAll(removeTestListings)

  test('a host reaches the dashboard and sees their own stats', async ({ page }) => {
    await login(page, 'host')
    await page.goto('/hosts/dashboard')

    await expect(page.getByRole('heading', { name: 'Hosting dashboard' })).toBeVisible()
    await expect(page.getByText('Listings', { exact: true })).toBeVisible()
    await expect(page.getByText('Booked value')).toBeVisible()
  })

  test('a guest is redirected away from host pages', async ({ page }) => {
    await login(page, 'guest')
    await page.goto('/hosts/dashboard')
    // Not a 403 page — they are offered the thing they would need to do first.
    await expect(page).toHaveURL(/become-a-host/)
  })

  test('host listings show drafts, which the public never sees', async ({ page }) => {
    await login(page, 'host')
    await page.goto('/hosts/listings')
    await expect(page.getByRole('heading', { name: 'My listings' })).toBeVisible()
    await expect(page.locator('a[href^="/listings/"]').first()).toBeVisible()
  })

  test('reservations show guest names, earned by a row permission', async ({ page }) => {
    await login(page, 'host')
    await page.goto('/hosts/reservations')
    await expect(page.getByRole('heading', { name: 'Reservations' })).toBeVisible()
  })

  test('a host can create a listing and publish it into search', async ({ page }) => {
    await login(page, 'host')
    await page.goto('/hosts/listings/new')

    const title = `E2E Test Cottage ${Date.now()}`
    await page.getByLabel('Title').fill(title)
    await page
      .getByLabel('Description')
      .fill('A small stone cottage with a wood stove and a view over the valley, tested end to end.')
    await page.getByLabel('City').fill('Bozeman')
    await page.getByLabel('State').fill('Montana')
    await page.getByLabel('Price per night (USD)').fill('165')
    await page
      .getByLabel('Photo URL 1')
      .fill('https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?w=1200&q=80')

    await page.getByRole('button', { name: 'Save and publish' }).click()

    await expect(page).toHaveURL(/\/hosts\/listings/)
    await expect(page.getByText(title)).toBeVisible()

    // ⚠️ The real assertion: publishing wrote the listing into Elasticsearch from application
    // code. If the sync were broken the listing would exist in Postgres and be completely
    // unfindable — exactly the failure this catches.
    //
    // ⚠️ …but Elasticsearch is NEAR-real-time. A freshly indexed document becomes searchable at
    // the next refresh, measured here at roughly 400 ms. Navigating once and asserting fails
    // intermittently; retrying the NAVIGATION is what makes this honest, because Playwright's
    // auto-retry only re-checks the DOM, and the page will not refetch on its own.
    await expect(async () => {
      await page.goto('/search?q=Bozeman')
      await expect(page.getByText(title)).toBeVisible({ timeout: 1000 })
    }).toPass({ timeout: 15_000 })
  })

  test('unpublishing removes a listing from search', async ({ page }) => {
    await login(page, 'host')
    await page.goto('/hosts/listings')

    const card = page
      .getByTestId('host-listing-card')
      .filter({ hasText: 'E2E Test Cottage' })
      .first()
    await expect(card).toBeVisible()
    await card.getByRole('button', { name: 'Unpublish' }).click()
    await expect(page.getByText(/Unpublished/)).toBeVisible()

    // Removed from the index rather than flagged — one forgotten status filter cannot leak it.
    // Same near-real-time caveat as publishing, so retry the navigation rather than the DOM.
    await expect(async () => {
      await page.goto('/search?q=Bozeman')
      await expect(page.getByText('E2E Test Cottage')).toHaveCount(0, { timeout: 1000 })
    }).toPass({ timeout: 15_000 })
  })
})
