import { expect, test } from '@playwright/test';
import { openApp, openMenu } from './helpers';

/**
 * The app boots and the shell renders.
 *
 * <p>These run first and are deliberately shallow: if the bundle does not compile or a provider
 * throws on mount, everything else fails in a confusing way, and this spec says so plainly.
 */
test.describe('shell', () => {
  test('the home screen renders with the hero and the tab bar', async ({ page }) => {
    await openApp(page);

    await expect(page.getByText('StayHub Pizza').first()).toBeVisible();
    await expect(page.getByText('Start your order')).toBeVisible();

    // Four tabs, and the cart button in the header.
    await expect(page.getByText('Menu', { exact: true }).first()).toBeVisible();
    await expect(page.getByTestId('cart-button')).toBeVisible();
  });

  test('an unknown route renders the not-found screen rather than a blank page', async ({
    page,
  }) => {
    await page.goto('/this-route-does-not-exist');
    await expect(page.getByText('Page not found')).toBeVisible({ timeout: 90_000 });
  });

  test('the cart starts empty and shows no badge', async ({ page }) => {
    await openApp(page);

    await expect(page.getByTestId('cart-badge')).toHaveCount(0);

    await page.getByTestId('cart-button').click();
    await expect(page.getByTestId('cart-sheet')).toBeVisible();
    await expect(page.getByText('Your cart is empty')).toBeVisible();
  });
});

test.describe('menu', () => {
  test('loads the catalogue from the API', async ({ page }) => {
    await openMenu(page);

    const cards = page.locator('[data-testid^="product-card-"]');
    await expect(cards.first()).toBeVisible();
    // The seeded catalogue has more than a couple of products.
    expect(await cards.count()).toBeGreaterThan(3);
  });

  test('the type filter narrows the list and lands in the URL', async ({ page }) => {
    await openMenu(page);
    const all = await page.locator('[data-testid^="product-card-"]').count();

    await page.getByTestId('menu-filter-DRINK').click();

    await expect(page).toHaveURL(/type=DRINK/);
    const drinks = await page.locator('[data-testid^="product-card-"]').count();
    expect(drinks).toBeGreaterThan(0);
    expect(drinks).toBeLessThan(all);
  });

  test('a filtered URL is shareable — it opens already filtered', async ({ page }) => {
    await page.goto('/menu?type=PIZZA');
    await page.getByTestId('menu-screen').waitFor({ timeout: 90_000 });
    await page.locator('[data-testid^="product-card-"]').first().waitFor();

    // Every card is a pizza, so none of them offers the drink shortcut.
    await expect(page.getByText('Add →')).toHaveCount(0);
    await expect(page.getByText('Build it →').first()).toBeVisible();
  });
});
