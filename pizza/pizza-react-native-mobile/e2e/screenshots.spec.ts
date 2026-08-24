import { test, type Page } from '@playwright/test';
import { openApp, openMenu, signIn } from './helpers';

/**
 * Regenerates `screenshots/`.
 *
 * <p>Excluded from `npm run test:all` — it asserts nothing and only exists to keep the images in
 * the repo current. Run it with `npm run screenshots`.
 */

async function shoot(page: Page, name: string) {
  // Let layout and any entering animation settle, so the images are not caught mid-transition.
  await page.waitForTimeout(400);
  await page.screenshot({ path: `screenshots/${name}.png`, fullPage: false });
}

test.describe('capture the app', () => {
  test('home', async ({ page }) => {
    await openApp(page);
    await shoot(page, '01-home');
  });

  test('menu and the pizza builder', async ({ page }) => {
    await openMenu(page);
    await shoot(page, '02-menu');

    await page.getByTestId('menu-filter-PIZZA').click();
    await page.locator('[data-testid^="product-card-"]').first().click();
    await page.getByTestId('size-LARGE').click();
    await page.locator('[data-testid^="topping-"]').first().click();
    await page.locator('[data-testid^="topping-"]').nth(2).click();
    await shoot(page, '03-pizza-builder');

    await page.getByTestId('builder-add').click();
    await page.getByTestId('cart-button').click();
    await shoot(page, '04-cart');
  });

  test('checkout, both steps', async ({ page }) => {
    await openMenu(page);
    await page.getByTestId('menu-filter-PIZZA').click();
    await page.locator('[data-testid^="product-card-"]').first().click();
    await page.getByTestId('builder-add').click();
    await page.getByTestId('cart-button').click();
    await page.getByTestId('cart-checkout').click();

    await page.getByTestId('field-name').fill('Folau Kaveinga');
    await page.getByTestId('field-email').fill('guest@pizza.test');
    await page.getByTestId('field-phone').fill('5551234567');
    await page.getByTestId('field-address').fill('1 Market St');
    await page.getByTestId('field-city').fill('San Francisco');
    await page.getByTestId('field-state').fill('CA');
    await page.getByTestId('field-zip').fill('94105');
    await shoot(page, '05-checkout');

    await page.getByTestId('checkout-continue').click();
    await page.getByTestId('checkout-payment-step').waitFor();
    await shoot(page, '06-checkout-payment');
  });

  test('sign in, orders and profile', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-screen').waitFor({ timeout: 90_000 });
    await shoot(page, '07-sign-in');

    await signIn(page);

    await page.goto('/orders');
    await page.getByTestId('orders-screen').waitFor({ timeout: 90_000 });
    await shoot(page, '08-orders');

    await page.goto('/profile');
    await page.getByTestId('profile-screen').waitFor({ timeout: 90_000 });
    await shoot(page, '09-profile');
  });
});
