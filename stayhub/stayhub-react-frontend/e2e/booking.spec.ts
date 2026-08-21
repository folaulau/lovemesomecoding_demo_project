import { expect, test } from '@playwright/test'
import { API, apiCancelAll, apiLogin, login } from './helpers'

test.describe('Booking, availability and the cancellation rule', () => {
  test.afterEach(async () => {
    // Tests must clean up what they create. A leftover booking blocks the calendar for the next
    // run, and the failure then looks like a product bug rather than test debris.
    await apiCancelAll(await apiLogin('guest'))
  })

  test('a guest can pick dates and reserve, landing on checkout', async ({ page }) => {
    await login(page, 'guest')
    await page.goto('/search?q=santa+fe')
    await page.locator('a[href^="/listings/"]').first().click()
    await expect(page.getByRole('heading', { name: /Adobe/ })).toBeVisible()

    // The default range is 14 days out, so the panel is never empty on first load.
    await expect(page.getByText('StayHub service fee')).toBeVisible()
    await page.getByRole('button', { name: 'Reserve' }).click()

    await expect(page).toHaveURL(/\/checkout\//)
    await expect(page.getByRole('heading', { name: 'Confirm and pay' })).toBeVisible()
    // The checkout total shows the SERVER's figures, read back off the created booking.
    await expect(page.getByText('Total (USD)')).toBeVisible()
  })

  test('the price breakdown comes from the server and updates with the dates', async ({ page }) => {
    await login(page, 'guest')
    await page.goto('/search?q=austin')
    await page.locator('a[href^="/listings/"]').first().click()

    // A quote is present for the default range…
    await expect(page.getByText('StayHub service fee')).toBeVisible()
    const nightsLine = page.getByText(/\$\d+ × \d+ nights?/)
    await expect(nightsLine).toBeVisible()

    // …and disappears the moment the range is incomplete, because the panel only ever shows a
    // price the SERVER quoted. It never falls back to multiplying in the browser.
    await page.getByRole('button', { name: 'Clear dates' }).click()
    await expect(page.getByText('StayHub service fee')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Reserve' })).toBeDisabled()
  })

  test('booked nights are struck out on the calendar', async ({ page }) => {
    // Create a booking through the API, then confirm the UI refuses to offer those nights.
    const token = await apiLogin('guest')
    const start = new Date()
    start.setDate(start.getDate() + 45)
    const end = new Date(start)
    end.setDate(end.getDate() + 3)
    const iso = (d: Date) => d.toISOString().slice(0, 10)

    const listingId = await fetch(`${API}/search?q=maui`)
      .then((r) => r.json())
      .then((d) => d.hits[0].publicId)

    await fetch(`${API}/bookings`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        propertyId: listingId,
        checkIn: iso(start),
        checkOut: iso(end),
        guests: 2,
      }),
    })

    await login(page, 'guest')
    await page.goto(`/listings/${listingId}`)
    await expect(page.getByRole('heading', { name: /Oceanfront Villa/ })).toBeVisible()

    // The calendar opens on the current month, and the booking above is ~45 days out — so page
    // forward until the blocked nights come into view. Asserting without this passes or fails
    // depending on what day of the month the suite happens to run.
    const struck = page.locator('button.line-through')
    for (let month = 0; month < 3; month++) {
      if ((await struck.count()) > 0) break
      await page.getByRole('button', { name: 'Next month' }).click()
      await page.waitForTimeout(150)
    }

    // `line-through` is how the picker marks a night that is already taken.
    await expect(struck.first()).toBeVisible()
  })

  test('a pending booking appears in My trips and can be cancelled', async ({ page }) => {
    const token = await apiLogin('guest')
    const start = new Date()
    start.setDate(start.getDate() + 60)
    const end = new Date(start)
    end.setDate(end.getDate() + 2)
    const iso = (d: Date) => d.toISOString().slice(0, 10)

    const listingId = await fetch(`${API}/search?q=seattle`)
      .then((r) => r.json())
      .then((d) => d.hits[0].publicId)

    const created = await fetch(`${API}/bookings`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyId: listingId, checkIn: iso(start), checkOut: iso(end), guests: 2 }),
    }).then((r) => r.json())

    await login(page, 'guest')
    await page.goto('/trips')

    // Target THIS booking by id. Matching on the listing title instead picks whichever row comes
    // first, which after a few runs is a cancelled stay at the same place — and then the missing
    // Cancel button looks like a product bug.
    const row = page.getByTestId(`trip-${created.publicId}`)
    await expect(row).toBeVisible()
    await expect(row.getByText('Pending')).toBeVisible()
    await expect(row.getByText('Free until')).toBeVisible()

    await row.getByRole('button', { name: 'Cancel booking' }).click()
    await expect(page.getByText('Booking cancelled.')).toBeVisible()
    // `exact` matters: the row now contains BOTH the status badge "Cancelled" and the line
    // "Cancelled Aug 20, 2026", and a substring match resolves to two elements.
    await expect(row.getByText('Cancelled', { exact: true })).toBeVisible()
    await expect(row.getByRole('button', { name: 'Cancel booking' })).toHaveCount(0)
  })

  test('a stay inside the 2-day window offers no cancel button', async ({ page }) => {
    // The seed creates a CONFIRMED booking starting TOMORROW, which is inside the cutoff.
    await login(page, 'guest')
    await page.goto('/trips')

    const locked = page.locator('li', { hasText: 'Cancellation window closed' }).first()
    await expect(locked).toBeVisible()
    // The button is not merely disabled — it is not rendered. And the server re-checks anyway.
    await expect(locked.getByRole('button', { name: 'Cancel booking' })).toHaveCount(0)
  })
})
