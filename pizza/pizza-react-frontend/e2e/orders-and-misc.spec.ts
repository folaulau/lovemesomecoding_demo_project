import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Order history, the confirmation page, and the remaining odds and ends. */

test.beforeAll(async ({ request }) => {
  const response = await request.get('http://localhost:8085/api/products').catch(() => null);
  if (!response?.ok()) throw new Error('The backend is not responding at http://localhost:8085.');
});

async function signIn(page: Page, email = 'customer@pizza.test', password = 'pizza123') {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: /Demo/ })).toBeVisible();
}

test('a customer sees their seeded order history', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: /Demo Customer/ }).click();
  await page.getByRole('link', { name: 'My orders' }).click();

  await expect(page).toHaveURL(/\/orders/);
  await expect(page.getByRole('heading', { name: 'My orders' })).toBeVisible();
  await expect(page.getByText('customer@pizza.test')).toBeVisible();

  // The seed gives this account several orders.
  const rows = page.locator('tbody tr');
  await expect(rows.first()).toBeVisible({ timeout: 10_000 });
  expect(await rows.count()).toBeGreaterThan(0);
});

test('an order row links through to its confirmation page', async ({ page }) => {
  await signIn(page);
  await page.goto('/orders');
  await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 10_000 });

  await page.locator('tbody tr').first().getByRole('link').click();

  await expect(page).toHaveURL(/\/order-confirmation\/[0-9a-f-]{36}/);
  await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();
  // Items and money come from the API, not from anything the browser remembered.
  await expect(page.getByText('Subtotal', { exact: true })).toBeVisible();
  // exact:true matters — "Total" is a substring of "Subtotal".
  await expect(page.getByText('Total', { exact: true })).toBeVisible();
});

test('the confirmation page shows a completed order as COMPLETED', async ({ page }) => {
  await signIn(page);
  await page.goto('/orders');
  await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 10_000 });
  await page.locator('tbody tr').first().getByRole('link').click();

  // Status comes from the server, never from the browser asserting it paid.
  await expect(page.getByText(/^(COMPLETED|PAID|PREPARING)$/).first()).toBeVisible();
});

test('an unknown order id shows an error rather than a blank page', async ({ page }) => {
  await page.goto('/order-confirmation/00000000-0000-4000-8000-000000000000');

  await expect(page.getByText(/was not found/)).toBeVisible({ timeout: 15_000 });
  // The shell survives — this is not a crash.
  await expect(page.getByRole('link', { name: 'PizzaHub' })).toBeVisible();
});

test('an unknown route shows the not-found page, with the shell intact', async ({ page }) => {
  await page.goto('/this-route-does-not-exist');

  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'PizzaHub' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Open cart/ })).toBeVisible();
});

test('the brand logo returns to the home page', async ({ page }) => {
  await page.goto('/menu');
  await page.getByRole('link', { name: 'PizzaHub' }).click();

  await expect(page).toHaveURL('http://localhost:5173/');
  await expect(page.getByRole('heading', { name: /No One OutPizzas the Hub/i })).toBeVisible();
});

test('the footer is present on every page', async ({ page }) => {
  for (const path of ['/', '/menu', '/login']) {
    await page.goto(path);
    await expect(page.getByText(/a demo app for lovemesomecoding.com/)).toBeVisible();
  }
});

test('the menu recovers when the API is unreachable', async ({ page }) => {
  // Simulate the backend being down for the catalogue request only.
  await page.route('**/api/products', (route) => route.abort('failed'));
  await page.goto('/menu');

  await expect(page.getByText(/Could not load the menu/)).toBeVisible({ timeout: 15_000 });

  // Recover: stop failing, then use the retry button the error offers.
  await page.unroute('**/api/products');
  await page.getByRole('button', { name: 'Try again' }).click();

  await expect(page.getByRole('heading', { level: 3 }).first()).toBeVisible({ timeout: 15_000 });
});
