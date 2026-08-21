import { test } from '@playwright/test'

/** Regenerates `screenshots/` for the tutorial. `npm run screenshots` */
test.describe('screenshots', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('capture the console', async ({ page }) => {
    await page.goto('/')
    await page.screenshot({ path: 'screenshots/01-login.png' })

    await page.getByLabel('Email').fill('admin@stayhub.test')
    await page.getByLabel('Password').fill('admin123')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForTimeout(900)
    await page.screenshot({ path: 'screenshots/02-overview.png' })

    await page.goto('/listings')
    await page.waitForTimeout(900)
    await page.screenshot({ path: 'screenshots/03-listings.png' })

    await page.goto('/bookings')
    await page.waitForTimeout(900)
    await page.screenshot({ path: 'screenshots/04-bookings.png' })

    await page.goto('/users')
    await page.waitForTimeout(900)
    await page.screenshot({ path: 'screenshots/05-users.png' })
  })
})
