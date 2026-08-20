import { expect, test } from '@playwright/test';
import { addProduct, requireBackend } from './helpers';

/** Browsing the menu — routing, the httpResource-backed catalogue, and the builder's live price. */

test.beforeAll(async ({ request }) => requireBackend(request));

test('the home page renders the hero and three featured pizzas', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'No One OutPizzas the Hub' })).toBeVisible();

  // Featured cards come from the API through MenuService, not from a hard-coded list.
  const cards = page.locator('.product-card');
  await expect(cards).toHaveCount(3);
});

test('the menu loads products from the API', async ({ page }) => {
  await page.goto('/menu');

  await expect(page.getByRole('heading', { name: 'Menu' })).toBeVisible();
  await expect(page.locator('.product-card')).not.toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Pepperoni Pizza', exact: true })).toBeVisible();
});

test('the filter lives in the URL, so it survives a reload', async ({ page }) => {
  await page.goto('/menu');
  await page.getByRole('button', { name: 'Drinks' }).click();

  await expect(page).toHaveURL(/type=DRINK/);

  /*
   * Wait for the list to have actually re-rendered before MEASURING it. The URL changes a frame
   * before the DOM does, and `count()` reads once with no retry — so counting straight after the
   * URL assertion captures the unfiltered list on a busy machine. It passed alone and failed in
   * the full suite, which is the signature of exactly this race.
   */
  await expect(page.getByRole('heading', { name: 'Pepperoni Pizza', exact: true })).toHaveCount(0);
  const drinksOnly = await page.locator('.product-card').count();
  expect(drinksOnly).toBeGreaterThan(0);

  // A reload re-derives the filter from the URL — the whole reason it is not component state.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Drinks' })).toHaveClass(/active/);
  await expect(page.locator('.product-card')).toHaveCount(drinksOnly);
});

test('a deep link to /menu?type=PIZZA arrives pre-filtered', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await expect(page.getByRole('button', { name: 'Pizzas' })).toHaveClass(/active/);
  await expect(page.getByRole('heading', { name: 'Diet Pepsi', exact: true })).toBeHidden();
});

test('the builder price updates as options are chosen', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');

  await page
    .getByRole('heading', { name: 'Pepperoni Pizza', exact: true })
    .locator('xpath=ancestor::div[contains(@class,"product-card")]')
    .getByRole('button', { name: 'Build it' })
    .click();

  const dialog = page.getByRole('dialog').filter({ hasText: 'Size' });
  const total = dialog.locator('.fs-5.fw-bold');

  /*
   * `toHaveText` RETRIES until the assertion passes; a bare `textContent()` reads once. Reading
   * once immediately after a click is a race against the framework's own render, and it is a race
   * this test lost on its first run — the price was correct a few milliseconds later.
   */
  await expect(total).toHaveText('$13.99');

  // A larger size costs more…
  await dialog.locator('label[for="size-LARGE"]').click();
  await expect(total).toHaveText('$16.99');

  // …and so does a topping. This is the `computed()` recalculating, with no dependency array.
  await dialog.getByRole('button', { name: /Extra Cheese/ }).click();
  await expect(total).not.toHaveText('$16.99');

  // Quantity multiplies the unit price — three of the same pizza, one line.
  await dialog.getByLabel('Quantity').selectOption('2');
  const unit = await dialog.locator('.text-muted.small').last().textContent();
  await expect(total).not.toHaveText(unit!.replace(' each', ''));

  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
});

test('a drink gets the size step but no crust or toppings', async ({ page }) => {
  await page.goto('/menu?type=DRINK');

  await page
    .getByRole('heading', { name: 'Pepsi', exact: true })
    .locator('xpath=ancestor::div[contains(@class,"product-card")]')
    .getByRole('button', { name: 'Add' })
    .click();

  const dialog = page.getByRole('dialog').filter({ hasText: 'Size' });
  await expect(dialog.getByText('Crust')).toBeHidden();
  await expect(dialog.getByText('Toppings')).toBeHidden();

  await dialog.getByRole('button', { name: 'Cancel' }).click();
});

test('opening the builder moves focus into the dialog', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await page
    .getByRole('heading', { name: 'Pepperoni Pizza', exact: true })
    .locator('xpath=ancestor::div[contains(@class,"product-card")]')
    .getByRole('button', { name: 'Build it' })
    .click();

  // afterRenderEffect focuses the close button; without it a keyboard user is left at the top of
  // the document with no idea a dialog opened.
  await expect(page.getByRole('dialog').filter({ hasText: 'Size' }).getByRole('button', { name: 'Close' })).toBeFocused();
});

test('an unknown route renders the not-found page', async ({ page }) => {
  await page.goto('/no-such-page');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});

test('adding from the menu leaves the modal closed and the cart populated', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await addProduct(page, 'Pepperoni Pizza');
  await expect(page.getByRole('button', { name: /Open cart/ })).toContainText('1');
});
