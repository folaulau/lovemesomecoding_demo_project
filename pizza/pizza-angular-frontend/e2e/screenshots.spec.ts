import { test } from '@playwright/test';
import { ADMIN, addProduct, openCart, signIn } from './helpers';

/**
 * Not assertions — page captures for the tutorial write-ups.
 *
 * Named "capture the …" so `npm run test:all` can exclude them with `--grep-invert`: they write
 * files and prove nothing, so they have no business in a pass/fail run.
 */

test('capture the customer screens', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.goto('/');
  await page.screenshot({ path: 'screenshots/home.png', fullPage: true });

  await page.goto('/menu');
  await page.screenshot({ path: 'screenshots/menu.png', fullPage: true });

  await page
    .getByRole('heading', { name: 'Pepperoni Pizza', exact: true })
    .locator('xpath=ancestor::div[contains(@class,"product-card")]')
    .getByRole('button', { name: 'Build it' })
    .click();
  await page.screenshot({ path: 'screenshots/builder.png' });
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

  await addProduct(page, 'Pepperoni Pizza', { size: 'LARGE', toppings: ['Extra Cheese'] });
  await openCart(page);
  // Bootstrap slides the offcanvas in over 300ms. `toBeVisible` is satisfied the moment it has a
  // bounding box — which is while it is still off the right edge — so a capture without this wait
  // shows a dimmed page and no drawer.
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/cart-drawer.png' });
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();

  await page.goto('/checkout');
  await page.screenshot({ path: 'screenshots/checkout.png', fullPage: true });

  await page.goto('/login');
  await page.screenshot({ path: 'screenshots/login.png' });
});

test('capture the admin screens', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page, ADMIN);

  for (const [path, name] of [
    ['/admin', 'admin-reports'],
    ['/admin/products', 'admin-products'],
    ['/admin/toppings', 'admin-toppings'],
    ['/admin/crusts', 'admin-crusts'],
    ['/admin/orders', 'admin-orders'],
    ['/admin/users', 'admin-users'],
  ] as const) {
    await page.goto(path);
    // Let the charts measure their container and the tables settle before capturing.
    await page.waitForTimeout(500);
    await page.screenshot({ path: `screenshots/${name}.png`, fullPage: true });
  }
});
