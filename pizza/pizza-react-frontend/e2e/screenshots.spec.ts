import { test } from '@playwright/test';

/**
 * Not assertions — this file exists purely to capture the UI for review and for tutorial
 * screenshots. Run with: npx playwright test e2e/screenshots.spec.ts
 */
test('capture the main screens', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.goto('/');
  await page.screenshot({ path: 'screenshots/01-home.png', fullPage: true });

  await page.goto('/menu');
  await page.screenshot({ path: 'screenshots/02-menu.png', fullPage: true });

  await page.getByRole('button', { name: 'Build it' }).first().click();
  await page.getByRole('dialog').waitFor();
  await page.locator('label[for="size-LARGE"]').click();
  await page.getByRole('button', { name: /Bacon/ }).click();
  await page.getByRole('button', { name: /Extra Cheese/ }).click();
  // Move the pointer away and let Bootstrap's 0.15s background transition finish, otherwise
  // the capture catches the selected-size button mid-fade and looks wrong.
  await page.mouse.move(10, 10);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/03-builder.png' });

  await page.getByRole('dialog').getByRole('button', { name: 'Add to cart' }).click();
  await page.getByRole('button', { name: /Open cart/ }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'screenshots/04-cart.png' });

  await page.getByRole('button', { name: 'Checkout' }).click();
  await page.waitForURL(/checkout/);
  await page.screenshot({ path: 'screenshots/05-checkout.png', fullPage: true });

  // Step 2: create the real order and show Stripe Elements.
  await page.getByLabel('Name').fill('Demo Customer');
  await page.getByLabel('Email').fill('demo@example.com');
  await page.getByLabel('Street address').fill('123 Main St');
  await page.getByLabel('City').fill('Salt Lake City');
  await page.getByLabel('State').fill('UT');
  await page.getByLabel('ZIP').fill('84101');
  await page.getByRole('button', { name: /Continue to payment/ }).click();
  await page.getByRole('button', { name: /^Pay \$/ }).waitFor({ timeout: 30_000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'screenshots/06-payment.png', fullPage: true });
});
