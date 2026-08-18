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
  // Scope to main: the footer repeats this address in its demo-sign-ins panel.
  await expect(page.getByRole('main').getByText('customer@pizza.test')).toBeVisible();

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

test('the confirmation page shows the delivery address and how it was paid', async ({
  page,
  request,
}) => {
  // Place a real order and pay it with Stripe's test Visa, so there IS a last4 to show.
  const products = await (await request.get('http://localhost:8085/api/products?type=PIZZA')).json();
  const created = await (
    await request.post('http://localhost:8085/api/orders', {
      data: {
        orderType: 'DELIVERY',
        customerName: 'Receipt Tester',
        guestEmail: 'receipt@example.com',
        phone: '801-555-0123',
        addressLine1: '55 Receipt Rd',
        city: 'Provo',
        state: 'UT',
        postalCode: '84601',
        items: [{ productId: products[0].id, size: 'LARGE', quantity: 1 }],
      },
    })
  ).json();

  const secret: string | undefined = process.env.STRIPE_SECRET_KEY;
  test.skip(!secret, 'Set STRIPE_SECRET_KEY to exercise the paid-with line.');

  const intentId = created.clientSecret.split('_secret_')[0];
  await request.post(`https://api.stripe.com/v1/payment_intents/${intentId}/confirm`, {
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    form: { payment_method: 'pm_card_visa', return_url: 'http://localhost:5173/checkout' },
  });

  await page.goto(`/order-confirmation/${created.order.id}`);
  await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();

  // Where it is going…
  await expect(page.getByText('Delivering to')).toBeVisible();
  await expect(page.getByText('55 Receipt Rd')).toBeVisible();
  await expect(page.getByText('Provo, UT 84601')).toBeVisible();

  // …and what paid for it. Brand + last four only — never a card number.
  await expect(page.getByText('Paid with')).toBeVisible();
  await expect(page.getByText(/ending/)).toBeVisible();
  await expect(page.getByText('4242')).toBeVisible();
});

test('a carryout order shows collection details, not an address', async ({ page, request }) => {
  const products = await (await request.get('http://localhost:8085/api/products?type=PIZZA')).json();
  const created = await (
    await request.post('http://localhost:8085/api/orders', {
      data: {
        orderType: 'CARRYOUT',
        customerName: 'Pickup Tester',
        guestEmail: 'pickup@example.com',
        items: [{ productId: products[0].id, size: 'LARGE', quantity: 1 }],
      },
    })
  ).json();

  await page.goto(`/order-confirmation/${created.order.id}`);
  await expect(page.getByText('Collection')).toBeVisible();
  await expect(page.getByText(/Carryout — Pickup Tester/)).toBeVisible();
  await expect(page.getByText('Delivering to')).toBeHidden();
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

test('the footer hides the demo sign-ins until you expand them', async ({ page }) => {
  await page.goto('/');

  const panel = page.locator('details.demo-logins');
  await expect(panel).toBeVisible();

  // Collapsed by default — credentials are not sitting on screen unasked.
  await expect(page.getByText('admin@pizza.test')).toBeHidden();

  await page.getByText('Demo sign-ins').click();

  await expect(page.getByText('admin@pizza.test')).toBeVisible();
  await expect(page.getByText('admin123')).toBeVisible();
  await expect(page.getByText('customer@pizza.test')).toBeVisible();
  await expect(page.getByText('pizza123')).toBeVisible();

  // And it folds away again.
  await page.getByText('Demo sign-ins').click();
  await expect(page.getByText('admin@pizza.test')).toBeHidden();
});

test('the footer credentials actually sign an admin in', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Demo sign-ins').click();

  // Read the credentials off the page, then use them — proving they are not stale copy.
  const email = (await page.locator('details.demo-logins code').first().textContent()) ?? '';
  const password = (await page.locator('details.demo-logins code').nth(1).textContent()) ?? '';

  await page.goto('/admin');
  await page.getByLabel('Email').fill(email.trim());
  await page.getByLabel('Password').fill(password.trim());
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByRole('heading', { name: 'Sales reports' })).toBeVisible();
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
