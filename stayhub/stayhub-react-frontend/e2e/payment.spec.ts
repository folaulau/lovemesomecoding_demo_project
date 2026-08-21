import { expect, test } from '@playwright/test'
import { API, apiCancelAll, apiLogin, login } from './helpers'

/** Checkout with a real Stripe test-mode account.
 *
 * ⚠️ This does NOT type a card number. Stripe's card fields live in an iframe on Stripe's own
 * domain — which is exactly what keeps this app out of PCI scope — and driving them headlessly
 * trips hCaptcha. What is asserted here is everything up to that boundary: our server creates a
 * real PaymentIntent for the server-computed amount, and Stripe's Payment Element mounts with it.
 * The pizza demo confirms payment through Stripe's API for the same reason.
 */
test.describe('Checkout', () => {
  test.afterEach(async () => {
    await apiCancelAll(await apiLogin('guest'))
  })

  test('the Stripe payment element mounts for a real intent', async ({ page }) => {
    await login(page, 'guest')
    await page.goto('/search?q=santa+fe')
    await page.locator('a[href^="/listings/"]').first().click()
    await expect(page.getByText('StayHub service fee')).toBeVisible()

    await page.getByRole('button', { name: 'Reserve' }).click()
    await expect(page).toHaveURL(/\/checkout\//)
    await expect(page.getByRole('heading', { name: 'Confirm and pay' })).toBeVisible()

    // The "payments are not configured" branch must NOT appear now that a secret key is set.
    await expect(page.getByText('Payment is not set up')).toHaveCount(0)

    await expect(page.getByRole('heading', { name: 'Pay with card' })).toBeVisible()

    // Stripe renders its fields in a cross-origin iframe. Its presence IS the assertion: Stripe
    // refuses to mount the Payment Element without a valid client_secret, so a mounted frame
    // proves the intent our server created was real.
    //
    // ⚠️ Deliberately not reaching INSIDE the frame. Stripe nests several, the inner structure is
    // theirs to change, and driving the card fields headlessly trips hCaptcha anyway.
    await expect(page.locator('iframe[name^="__privateStripeFrame"]').first())
      .toBeVisible({ timeout: 20_000 })

    // The button shows the SERVER's total, not a number the browser computed.
    const payButton = page.getByRole('button', { name: /^Pay \$/ })
    await expect(payButton).toBeVisible()
    const label = await payButton.textContent()
    expect(label).toMatch(/^Pay \$[\d,]+\.\d{2}$/)
  })

  test('the intent amount matches the booking total exactly', async ({ page }) => {
    const token = await apiLogin('guest')
    const listing = await fetch(`${API}/search?q=seattle`).then((r) => r.json())

    const start = new Date()
    start.setDate(start.getDate() + 500)
    const end = new Date(start)
    end.setDate(end.getDate() + 4)
    const iso = (d: Date) => d.toISOString().slice(0, 10)

    const booking = await fetch(`${API}/bookings`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        propertyId: listing.hits[0].publicId,
        checkIn: iso(start),
        checkOut: iso(end),
        guests: 2,
      }),
    }).then((r) => r.json())

    const intent = await fetch(`${API}/payments/intent`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: booking.publicId }),
    }).then((r) => r.json())

    // The charge is derived from the stored booking, which the server computed — never from
    // anything the client sent.
    expect(intent.amount).toBe(booking.total)
    expect(intent.paymentIntentId).toMatch(/^pi_/)
    // The publishable key must reach the browser, or Stripe.js cannot initialise and the form
    // silently never mounts.
    expect(intent.publishableKey).toMatch(/^pk_test_/)
    // ⚠️ And the SECRET key must never appear in a response.
    expect(JSON.stringify(intent)).not.toContain('sk_test_')
  })
})
