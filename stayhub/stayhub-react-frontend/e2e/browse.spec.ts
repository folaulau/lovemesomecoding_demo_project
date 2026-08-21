import { expect, test } from '@playwright/test'

test.describe('Browsing — Hasura reads and Elasticsearch search', () => {
  test('home page lists stays from Hasura', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /Find a place/i })).toBeVisible()

    // Cards come from a Hasura query run as the ANONYMOUS role — no token is sent at all.
    const cards = page.locator('a[href^="/listings/"]')
    await expect(cards.first()).toBeVisible()
    expect(await cards.count()).toBeGreaterThan(4)
  })

  test('search finds a cabin through Elasticsearch', async ({ page }) => {
    await page.goto('/search?q=cabin')
    await expect(page.getByText(/stays? for/)).toBeVisible()
    await expect(page.getByText(/Cedar Cabin/)).toBeVisible()
  })

  test('fuzzy matching tolerates a typo', async ({ page }) => {
    // "cabbin" is not in any document. It matches only because the multi_match uses
    // fuzziness: AUTO — this test is what proves that setting is doing something.
    await page.goto('/search?q=cabbin')
    await expect(page.getByText(/Cedar Cabin/)).toBeVisible()
  })

  test('amenity filters AND together', async ({ page }) => {
    await page.goto('/search')
    await expect(page.getByText(/stays/)).toBeVisible()

    await page.getByRole('button', { name: 'Pool', exact: true }).click()
    await expect(page).toHaveURL(/amenities=pool/)

    const withPool = await page.locator('a[href^="/listings/"]').count()

    await page.getByRole('button', { name: 'Hot tub', exact: true }).click()
    await expect(page).toHaveURL(/amenities=hot-tub/)
    await page.waitForTimeout(500)

    // AND, not OR: adding a second required amenity can only narrow the result set. If these
    // were a single `terms` clause the count would GROW here.
    const withBoth = await page.locator('a[href^="/listings/"]').count()
    expect(withBoth).toBeLessThanOrEqual(withPool)
  })

  test('filters live in the URL, so they survive a reload', async ({ page }) => {
    await page.goto('/search?q=cabin&amenities=wifi&sort=price_asc')
    await expect(page.getByRole('button', { name: 'Wifi', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await page.reload()
    await expect(page.getByRole('button', { name: 'Wifi', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  test('listing detail shows gallery, amenities and a live price quote', async ({ page }) => {
    await page.goto('/search?q=austin')
    await page.locator('a[href^="/listings/"]').first().click()

    await expect(page.getByRole('heading', { name: /Zilker Park/ })).toBeVisible()
    await expect(page.getByText('What this place offers')).toBeVisible()

    // The price breakdown is quoted by FastAPI, not multiplied in the browser.
    await expect(page.getByText('StayHub service fee')).toBeVisible()
    await expect(page.getByText('Total', { exact: true })).toBeVisible()
  })

  test('the exact street address is never on a public listing', async ({ page }) => {
    await page.goto('/search?q=austin')
    await page.locator('a[href^="/listings/"]').first().click()
    await expect(page.getByRole('heading', { name: /Zilker Park/ })).toBeVisible()

    // The seed gives every listing an address like "103 Example Street". It is excluded from both
    // the FastAPI DTO and the Hasura column permission, so it must not appear anywhere.
    await expect(page.getByText(/Example Street/)).toHaveCount(0)
  })
})
