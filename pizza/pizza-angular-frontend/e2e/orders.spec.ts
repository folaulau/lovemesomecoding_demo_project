import { expect, test } from '@playwright/test';
import { CUSTOMER, requireBackend, signIn } from './helpers';

/** Order history, and the confirmation page's polling. */

test.beforeAll(async ({ request }) => requireBackend(request));

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('a customer sees their own order history', async ({ page }) => {
  await signIn(page, CUSTOMER);
  await page.goto('/orders');

  await expect(page.getByRole('heading', { name: 'My orders' })).toBeVisible();
  // Scoped to <main>: the footer's demo-logins block prints the same address.
  await expect(page.getByRole('main').getByText(CUSTOMER.email)).toBeVisible();
  await expect(page.locator('tbody tr').first()).toBeVisible();
});

test('an order links through to its confirmation page', async ({ page }) => {
  await signIn(page, CUSTOMER);
  await page.goto('/orders');

  await page.locator('tbody tr').first().getByRole('link').click();

  await expect(page).toHaveURL(/\/order-confirmation\//);
  await expect(page.getByRole('heading', { name: /Order confirmed|Confirming your payment/ })).toBeVisible();
});

test('the confirmation page reads the order from the SERVER, not from checkout', async ({ page }) => {
  await signIn(page, CUSTOMER);
  await page.goto('/orders');

  // Straight to a URL, with no checkout having happened in this tab. Everything on the page has
  // to come from the API for this to render at all.
  const href = await page.locator('tbody tr').first().getByRole('link').getAttribute('href');
  await page.goto(href!);

  await expect(page.getByText(/Subtotal/)).toBeVisible();
  await expect(page.getByText(/Total/)).toBeVisible();
  await expect(page.locator('.list-group-item').first()).toBeVisible();
});

test('an unknown order id reports an error rather than hanging', async ({ page }) => {
  await page.goto('/order-confirmation/00000000-0000-0000-0000-000000000000');
  await expect(page.locator('.alert-danger')).toBeVisible();
});

test('the footer offers the demo logins, collapsed', async ({ page }) => {
  await page.goto('/');

  const details = page.locator('details.demo-logins');
  await expect(details).toBeVisible();
  await expect(details.getByText('admin@pizza.test')).toBeHidden();

  await details.getByText('Demo sign-ins').click();
  await expect(details.getByText('admin@pizza.test')).toBeVisible();
});
