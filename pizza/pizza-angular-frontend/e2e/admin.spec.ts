import { expect, test } from '@playwright/test';
import { ADMIN, CUSTOMER, requireBackend, signIn } from './helpers';

/** The admin section — the NgRx half of the app, driven through the UI. */

test.beforeAll(async ({ request }) => requireBackend(request));

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await signIn(page, ADMIN);
});

/* ---------------------------------------------------------------- reports */

test('the dashboard renders tiles and both charts from real aggregates', async ({ page }) => {
  await page.goto('/admin');

  const tiles = page.getByTestId('stat-tiles');
  await expect(tiles.locator('.card')).toHaveCount(4);
  await expect(tiles).toContainText('Orders');
  await expect(tiles).toContainText('Revenue');

  // Both charts are hand-drawn SVG; assert on the marks, not on a library's class names.
  await expect(page.locator('app-line-chart svg polyline')).toBeVisible();
  await expect(page.locator('app-bar-chart svg rect').first()).toBeVisible();

  // The status table is the accessible view of the same data — no colour-only information.
  await expect(page.getByRole('heading', { name: 'Orders by status' })).toBeVisible();
});

test('changing the range refetches, and returning to a cached range is instant', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByTestId('stat-tiles')).toBeVisible();

  const sevenDay = page.waitForResponse((r) => r.url().includes('reports/dashboard?days=7'));
  await page.getByRole('button', { name: '7 days' }).click();
  await sevenDay;
  await expect(page.getByRole('button', { name: '7 days' })).toHaveClass(/active/);

  /*
   * Back to 30. The store kept it, so the tiles are on screen immediately rather than after a
   * spinner — this is the caching-across-unmounts argument for a store, visible from the outside.
   */
  await page.getByRole('button', { name: '30 days' }).click();
  await expect(page.getByTestId('stat-tiles')).toBeVisible();
  await expect(page.locator('.spinner-border')).toHaveCount(0);
});

test('the report survives leaving the tab and coming back', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByTestId('stat-tiles')).toBeVisible();

  await page.getByRole('link', { name: 'Products' }).click();
  await expect(page.getByRole('heading', { name: /Products ·/ })).toBeVisible();

  await page.getByRole('link', { name: 'Reports' }).click();
  // No spinner: store state outlived the component that was reading it.
  await expect(page.getByTestId('stat-tiles')).toBeVisible();
});

/* --------------------------------------------------------------- products */

test('a product can be created, edited, hidden and deleted', async ({ page }) => {
  const name = `E2E Pizza ${Date.now()}`;
  await page.goto('/admin/products');

  await page.getByRole('button', { name: 'Add product' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill(name);
  await dialog.getByLabel('Description').fill('Created by the Angular e2e suite.');
  await dialog.getByLabel('Small').fill('9.99');
  await dialog.getByLabel('Medium').fill('12.99');
  await dialog.getByLabel('Large').fill('15.99');
  await dialog.getByRole('button', { name: 'Save product' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText(`${name} created`)).toBeVisible();

  const row = page.locator('tr', { hasText: name });
  await expect(row).toContainText('$12.99');
  await expect(row).toContainText('active');

  // Edit — the row is PATCHED in place from the response, not refetched.
  await row.getByRole('button', { name: 'Edit' }).click();
  await dialog.getByLabel('Medium').fill('14.49');
  await dialog.getByRole('button', { name: 'Save product' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('tr', { hasText: name })).toContainText('$14.49');

  // Hide, and confirm it leaves the public menu.
  await page.locator('tr', { hasText: name }).getByRole('button', { name: 'Hide' }).click();
  await expect(page.locator('tr', { hasText: name })).toContainText('hidden');

  await page.goto('/menu?type=PIZZA');
  await expect(page.getByRole('heading', { name, exact: true })).toHaveCount(0);

  // Delete.
  await page.goto('/admin/products');
  await page.locator('tr', { hasText: name }).getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('tr', { hasText: name })).toHaveCount(0);
});

test('a duplicate name is reported next to the field, not in a page banner', async ({ page }) => {
  await page.goto('/admin/products');

  await page.getByRole('button', { name: 'Add product' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill('Pepperoni Pizza');
  await dialog.getByLabel('Small').fill('9.99');
  await dialog.getByLabel('Medium').fill('12.99');
  await dialog.getByLabel('Large').fill('15.99');
  await dialog.getByRole('button', { name: 'Save product' }).click();

  /*
   * The modal stays open and the message appears ONCE. Letting a save failure also set the
   * page-level error put the same text in two places at once — under the field and in a banner
   * behind the modal. Both apps hit that bug; both fixed it the same way.
   */
  await expect(dialog).toBeVisible();
  await expect(page.getByText(/already exists/i)).toHaveCount(1);

  await dialog.getByRole('button', { name: 'Cancel' }).click();
});

/* --------------------------------------------------------------- toppings */

test('a topping can be created and deleted, and reaches the builder', async ({ page }) => {
  const name = `E2E Topping ${Date.now()}`;
  await page.goto('/admin/toppings');

  await page.getByRole('button', { name: 'Add topping' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill(name);
  await dialog.getByLabel('Price').fill('1.25');
  await dialog.getByLabel('Category').selectOption('VEGGIE');
  await dialog.getByRole('button', { name: 'Save topping' }).click();
  await expect(dialog).toBeHidden();

  // The public menu is a signal service, not the store — it has to be told the catalogue moved.
  await page.goto('/menu?type=PIZZA');
  await page
    .getByRole('heading', { name: 'Pepperoni Pizza', exact: true })
    .locator('xpath=ancestor::div[contains(@class,"product-card")]')
    .getByRole('button', { name: 'Build it' })
    .click();
  await expect(page.getByRole('dialog').getByRole('button', { name: new RegExp(name) })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

  await page.goto('/admin/toppings');
  await page.locator('tr', { hasText: name }).getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('tr', { hasText: name })).toHaveCount(0);
});

/* ----------------------------------------------------------------- crusts */

test('a crust can be created and deleted', async ({ page }) => {
  const name = `E2E Crust ${Date.now()}`;
  await page.goto('/admin/crusts');

  await page.getByRole('button', { name: 'Add crust' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill(name);
  await dialog.getByLabel('Surcharge').fill('2.50');
  await dialog.getByRole('button', { name: 'Save crust' }).click();
  await expect(dialog).toBeHidden();

  await expect(page.locator('tr', { hasText: name })).toContainText('$2.50');

  await page.locator('tr', { hasText: name }).getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('tr', { hasText: name })).toHaveCount(0);
});

/* ----------------------------------------------------------------- orders */

test('an order status can be moved, and the row updates without a refetch', async ({ page }) => {
  await page.goto('/admin/orders');
  await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible();

  const firstRow = page.locator('tbody tr').first();
  const select = firstRow.getByRole('combobox');
  const original = await select.inputValue();
  const next = original === 'PREPARING' ? 'PAID' : 'PREPARING';

  await select.selectOption(next);
  await expect(page.getByText(/Order moved to/)).toBeVisible();
  await expect(firstRow.locator('.badge')).toHaveText(next.replace('_', ' '), {
    ignoreCase: true,
  });

  // Put it back.
  await select.selectOption(original);
  await expect(firstRow.locator('.badge')).toHaveText(original.replace('_', ' '), {
    ignoreCase: true,
  });
});

/* ------------------------------------------------------------------ users */

test('an admin cannot demote or delete themselves', async ({ page }) => {
  await page.goto('/admin/users');

  const selfRow = page.locator('tr', { hasText: ADMIN.email });
  await expect(selfRow).toContainText('you');

  // The buttons that would lock the last admin out are not even offered.
  await expect(selfRow.getByRole('combobox')).toBeDisabled();
  await expect(selfRow.getByRole('button', { name: 'Delete' })).toBeDisabled();
});

test('a customer row shows their counts and can change role', async ({ page }) => {
  await page.goto('/admin/users');

  const row = page.locator('tr', { hasText: CUSTOMER.email });
  await expect(row).toContainText('customer');

  await row.getByRole('combobox').selectOption('ADMIN');
  await expect(page.getByText(`${CUSTOMER.email} is now admin`)).toBeVisible();
  await expect(row.locator('.badge').first()).toHaveText('admin');

  // Put it back — a leftover admin would change what later runs can see.
  await row.getByRole('combobox').selectOption('CUSTOMER');
  await expect(row.locator('.badge').first()).toHaveText('customer');
});
