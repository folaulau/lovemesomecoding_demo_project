import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Admin CRUD and reporting, against the real backend.
 *
 * Each test creates its own uniquely-named rows and deletes them again, so the suite can run
 * repeatedly without drifting the seeded demo data.
 */

const API = 'http://localhost:8085';

async function signInAsAdmin(page: Page, destination = '/admin') {
  // Navigating to the guarded route first is what makes ProtectedRoute stash it as the
  // post-login destination.
  await page.goto(destination);
  await page.getByLabel('Email').fill('admin@pizza.test');
  await page.getByLabel('Password').fill('admin123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(new RegExp(destination.replace('/', '\\/')));
}

test.beforeAll(async ({ request }) => {
  const response = await request.get(`${API}/api/products`).catch(() => null);
  if (!response?.ok()) {
    throw new Error(`The backend is not responding at ${API}.`);
  }
});

/**
 * Remove anything a previous run left behind.
 *
 * This matters more than it looks. When a test fails partway through, its cleanup step never runs
 * and the row survives — so a single failure here made an UNRELATED test in order-flow.spec.ts
 * fail ever after with "expected 14 products, received 15". Self-healing beats remembering.
 */
test.afterEach(async ({ request }) => {
  const token = await request
    .post(`${API}/api/auth/login`, {
      data: { email: 'admin@pizza.test', password: 'admin123' },
    })
    .then((r) => r.json())
    .then((body: { token: string }) => body.token);

  const auth = { Authorization: `Bearer ${token}` };

  for (const [path, list] of [
    ['products', await request.get(`${API}/api/admin/products`, { headers: auth }).then((r) => r.json())],
    ['toppings', await request.get(`${API}/api/admin/toppings`, { headers: auth }).then((r) => r.json())],
    ['crusts', await request.get(`${API}/api/admin/crusts`, { headers: auth }).then((r) => r.json())],
  ] as Array<[string, Array<{ id: string; name: string }>]>) {
    for (const row of list.filter((r) => r.name.startsWith('E2E '))) {
      await request.delete(`${API}/api/admin/${path}/${row.id}`, { headers: auth });
    }
  }
});

test('reports dashboard renders tiles and both charts', async ({ page }) => {
  await signInAsAdmin(page);

  await expect(page.getByRole('heading', { name: 'Sales reports' })).toBeVisible();

  // Scope to the tiles: "Orders" also names a nav tab, so an unscoped locator is ambiguous.
  const tiles = page.getByTestId('stat-tiles');
  await expect(tiles.getByText('Orders', { exact: true })).toBeVisible();
  await expect(tiles.getByText('Revenue', { exact: true })).toBeVisible();
  await expect(tiles.getByText('Items sold', { exact: true })).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Revenue per day' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Best sellers' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Orders by status' })).toBeVisible();

  // The marks are actually drawn — not just the axes.
  await expect(page.locator('.recharts-line-curve')).toBeVisible();
  await expect(page.locator('.recharts-bar-rectangle').first()).toBeVisible();
});

test('changing the time range refetches the report', async ({ page }) => {
  await signInAsAdmin(page);
  await expect(page.locator('.recharts-line-curve')).toBeVisible();

  const responsePromise = page.waitForResponse(
    (r) => r.url().includes('/api/admin/reports/dashboard?days=7') && r.status() === 200,
  );
  await page.getByRole('button', { name: '7 days' }).click();
  await responsePromise;

  await expect(page.getByRole('button', { name: '7 days' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('an admin can create, edit and delete a product', async ({ page }) => {
  const name = `E2E Test Pizza ${Date.now()}`;
  const renamed = `${name} (edited)`;

  await signInAsAdmin(page, '/admin/products');

  // ---- create ----
  await page.getByRole('button', { name: 'Add product' }).click();
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Description').fill('Created by an end-to-end test');
  await page.getByLabel('Small').fill('7.99');
  await page.getByLabel('Medium').fill('9.99');
  await page.getByLabel('Large').fill('11.99');
  await page.getByRole('button', { name: 'Save product' }).click();

  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('cell', { name, exact: false })).toBeVisible();

  // ---- edit ----
  const row = page.getByRole('row').filter({ hasText: name });
  await row.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Name').fill(renamed);
  await page.getByRole('button', { name: 'Save product' }).click();

  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('cell', { name: renamed, exact: false })).toBeVisible();

  // ---- delete (soft) ----
  await page
    .getByRole('row')
    .filter({ hasText: renamed })
    .getByRole('button', { name: 'Delete' })
    .click();

  await expect(page.getByRole('cell', { name: renamed, exact: false })).toBeHidden();
});

test('a duplicate product name is rejected with the API message', async ({ page }) => {
  await signInAsAdmin(page, '/admin/products');

  await page.getByRole('button', { name: 'Add product' }).click();
  // Already seeded, so the backend's uniqueness check must fire.
  await page.getByLabel('Name').fill('Pepperoni Pizza');
  await page.getByLabel('Small').fill('1.00');
  await page.getByLabel('Medium').fill('2.00');
  await page.getByLabel('Large').fill('3.00');
  await page.getByRole('button', { name: 'Save product' }).click();

  await expect(page.getByText(/already exists/)).toBeVisible();
  // The modal stays open so the mistake can be corrected.
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('an admin can create and delete a topping', async ({ page }) => {
  const name = `E2E Topping ${Date.now()}`;

  await signInAsAdmin(page, '/admin/toppings');

  await page.getByRole('button', { name: 'Add topping' }).click();
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Price').fill('2.25');
  await page.getByRole('button', { name: 'Save topping' }).click();

  await expect(page.getByRole('cell', { name, exact: false })).toBeVisible();

  await page
    .getByRole('row')
    .filter({ hasText: name })
    .getByRole('button', { name: 'Delete' })
    .click();
  await expect(page.getByRole('cell', { name, exact: false })).toBeHidden();
});

test('an admin can create and delete a crust', async ({ page }) => {
  const name = `E2E Crust ${Date.now()}`;

  await signInAsAdmin(page, '/admin/crusts');

  await page.getByRole('button', { name: 'Add crust' }).click();
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Surcharge').fill('1.50');
  await page.getByRole('button', { name: 'Save crust' }).click();

  await expect(page.getByRole('cell', { name, exact: false })).toBeVisible();

  await page
    .getByRole('row')
    .filter({ hasText: name })
    .getByRole('button', { name: 'Delete' })
    .click();
  await expect(page.getByRole('cell', { name, exact: false })).toBeHidden();
});

test('an admin can move an order through its lifecycle', async ({ page }) => {
  await signInAsAdmin(page, '/admin/orders');

  await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible();
  const firstRow = page.locator('tbody tr').first();
  await expect(firstRow).toBeVisible();

  const select = firstRow.getByRole('combobox');
  const original = await select.inputValue();
  const target = original === 'PREPARING' ? 'COMPLETED' : 'PREPARING';

  const responsePromise = page.waitForResponse(
    (r) => r.url().includes('/api/admin/orders/') && r.request().method() === 'PATCH',
  );
  await select.selectOption(target);
  const response = await responsePromise;
  expect(response.status()).toBe(200);

  await expect(select).toHaveValue(target);

  // Put it back so the seeded data is unchanged.
  await select.selectOption(original);
  await expect(select).toHaveValue(original);
});

test('a deactivated product disappears from the public menu', async ({ page, request }) => {
  const name = `E2E Hidden ${Date.now()}`;

  await signInAsAdmin(page, '/admin/products');
  await page.getByRole('button', { name: 'Add product' }).click();
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Small').fill('5.00');
  await page.getByLabel('Medium').fill('6.00');
  await page.getByLabel('Large').fill('7.00');
  await page.getByRole('button', { name: 'Save product' }).click();
  await expect(page.getByRole('cell', { name, exact: false })).toBeVisible();

  // Visible on the public menu…
  let menu = await (await request.get(`${API}/api/products`)).json();
  expect(menu.some((p: { name: string }) => p.name === name)).toBe(true);

  // Wait for the PATCH itself, then for the table to reload. Inferring completion from the badge
  // alone raced the request, and the public-menu check below then ran too early.
  const deactivated = page.waitForResponse(
    (r) => r.url().includes('/deactivate') && r.request().method() === 'PATCH' && r.ok(),
  );
  const reloaded = page.waitForResponse(
    (r) => r.url().includes('/api/admin/products') && r.request().method() === 'GET' && r.ok(),
  );
  await page.getByRole('row').filter({ hasText: name }).getByRole('button', { name: 'Hide' }).click();
  await deactivated;
  await reloaded;
  // Assert on the row's text rather than a nested locator: the badge is re-rendered by the
  // reload, so a locator resolved against the old row can go stale mid-assertion.
  await expect(page.getByRole('row').filter({ hasText: name })).toContainText('hidden');

  // …and gone once hidden, while still listed for the admin.
  menu = await (await request.get(`${API}/api/products`)).json();
  expect(menu.some((p: { name: string }) => p.name === name)).toBe(false);

  await page
    .getByRole('row')
    .filter({ hasText: name })
    .getByRole('button', { name: 'Delete' })
    .click();
  await expect(page.getByRole('cell', { name, exact: false })).toBeHidden();
});
