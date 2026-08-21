import { test } from '@playwright/test'
import { login } from './helpers'

/** Not assertions — this spec exists to regenerate `screenshots/` for the tutorial.
 *  `npm run screenshots` */
test.describe('screenshots', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('capture the app', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(1200) // let the listing photos actually load
    await page.screenshot({ path: 'screenshots/01-home.png', fullPage: false })

    await page.goto('/search?q=cabin')
    await page.waitForTimeout(1200)
    await page.screenshot({ path: 'screenshots/02-search.png' })

    await page.goto('/search?q=joshua+tree')
    await page.locator('a[href^="/listings/"]').first().click()
    await page.waitForTimeout(1500)
    await page.screenshot({ path: 'screenshots/03-listing.png' })

    await login(page, 'guest')
    await page.goto('/trips')
    await page.waitForTimeout(800)
    await page.screenshot({ path: 'screenshots/04-trips.png' })

    await login(page, 'host')
    await page.goto('/hosts/dashboard')
    await page.waitForTimeout(800)
    await page.screenshot({ path: 'screenshots/05-host-dashboard.png' })

    await page.goto('/hosts/listings')
    await page.waitForTimeout(1200)
    await page.screenshot({ path: 'screenshots/06-host-listings.png' })
  })
})
