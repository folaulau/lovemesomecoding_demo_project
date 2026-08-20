import { expect, test } from '@playwright/test';
import { API, CUSTOMER, addProduct, openCart, requireBackend, signIn } from './helpers';

/** Checkout: the two-step flow, validation, and who decides the price. */

test.beforeAll(async ({ request }) => requireBackend(request));

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

async function fillGuestDetails(page: import('@playwright/test').Page) {
  await page.getByLabel('Name').fill('Guest Diner');
  await page.getByLabel('Email').fill('guest@pizza.test');
  await page.getByLabel('Phone').fill('5551234567');
  await page.getByLabel('Street address').fill('1 Test Street');
  await page.getByLabel('City').fill('Testville');
  await page.getByLabel('State').fill('CA');
  await page.getByLabel('ZIP').fill('90210');
}

test('a GUEST can create an order end to end — signing in is never required', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await addProduct(page, 'Pepperoni Pizza', { size: 'MEDIUM' });

  const cart = await openCart(page);
  await cart.getByRole('button', { name: 'Checkout' }).click();

  await fillGuestDetails(page);
  await page.getByRole('button', { name: 'Continue to payment' }).click();

  // Step 2 only exists once the server has created the order and opened a PaymentIntent.
  await expect(page.getByRole('heading', { name: 'Payment' })).toBeVisible();
  await expect(page.getByText(/is reserved/)).toBeVisible();
});

test('the summary switches to the SERVER figures once the order exists', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await addProduct(page, 'Pepperoni Pizza', { size: 'MEDIUM' });

  const cart = await openCart(page);
  await cart.getByRole('button', { name: 'Checkout' }).click();
  await fillGuestDetails(page);

  /*
   * `.then(r => r.json())` is attached HERE, not awaited later. Playwright discards a response
   * body once the page navigates, and reading it after the await sometimes lost the race with
   * Stripe.js — "No data found for resource with given identifier". Chaining reads the body the
   * moment the response arrives.
   */
  const created = page
    .waitForResponse((r) => r.url().endsWith('/api/orders') && r.request().method() === 'POST')
    .then((r) => r.json());

  await page.getByRole('button', { name: 'Continue to payment' }).click();
  const order = (await created).order;

  /*
   * Whatever the browser was previewing, these are now the server's numbers.
   *
   * Scoped to the TOTAL row rather than "any element containing this figure" — the same amount can
   * legitimately appear twice in the summary (a single-line cart's line total equals its subtotal),
   * and a loose text match then fails on strict mode instead of on the thing being tested.
   */
  const summary = page.locator('.sticky-summary');
  await expect(summary.locator('.fs-5.fw-bold')).toContainText(`$${order.total.toFixed(2)}`);
});

test('the browser cannot dictate a price — the server reprices the cart', async ({ page, request }) => {
  await page.goto('/menu?type=PIZZA');
  await addProduct(page, 'Pepperoni Pizza', { size: 'MEDIUM' });

  const cart = await openCart(page);
  await cart.getByRole('button', { name: 'Checkout' }).click();
  await fillGuestDetails(page);

  // Request payload and response body both captured as the response arrives, before anything can
  // navigate away and discard them.
  const captured = page
    .waitForResponse((r) => r.url().endsWith('/api/orders') && r.request().method() === 'POST')
    .then(async (r) => ({ sent: r.request().postData() ?? '{}', body: await r.json() }));

  await page.getByRole('button', { name: 'Continue to payment' }).click();
  const { sent, body } = await captured;

  // Nothing resembling a price is even sent.
  expect(sent).not.toMatch(/price|subtotal|total/i);

  // And the server's total matches the menu: $13.99 + 8.5% tax + $3.99 delivery.
  const { order } = body;
  expect(order.subtotal).toBe(13.99);
  expect(order.deliveryFee).toBe(3.99);
  expect(order.total).toBeCloseTo(13.99 + 1.19 + 3.99, 2);

  // Leave the database as we found it.
  const login = await request.post(`${API}/api/auth/login`, {
    data: { email: 'admin@pizza.test', password: 'admin123' },
  });
  const { token } = await login.json();
  await request.patch(`${API}/api/admin/orders/${order.id}/status`, {
    data: { status: 'CANCELLED' },
    headers: { Authorization: `Bearer ${token}` },
  });
});

test('an incomplete address blocks the submit', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await addProduct(page, 'Pepperoni Pizza');

  const cart = await openCart(page);
  await cart.getByRole('button', { name: 'Checkout' }).click();

  await page.getByLabel('Name').fill('Guest Diner');
  await page.getByLabel('Email').fill('guest@pizza.test');
  // Street address, city, state and ZIP deliberately left blank.
  await page.getByRole('button', { name: 'Continue to payment' }).click();

  await expect(page.getByRole('heading', { name: 'Payment' })).toBeHidden();
  await expect(page.getByText('We cannot deliver without a street address.')).toBeVisible();
});

test('a malformed ZIP is rejected', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await addProduct(page, 'Pepperoni Pizza');
  const cart = await openCart(page);
  await cart.getByRole('button', { name: 'Checkout' }).click();

  await fillGuestDetails(page);
  await page.getByLabel('ZIP').fill('123');
  await page.getByRole('button', { name: 'Continue to payment' }).click();

  await expect(page.getByText('Five digits, please.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Payment' })).toBeHidden();
});

test('choosing pickup drops the address fields AND their validators', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await addProduct(page, 'Pepperoni Pizza');
  const cart = await openCart(page);
  await cart.getByRole('button', { name: 'Checkout' }).click();

  await page.getByRole('button', { name: /Pick up/ }).click();
  await expect(page.getByLabel('Street address')).toBeHidden();

  /*
   * The bug this guards: leaving the address validators attached after the fields disappear makes
   * the form permanently invalid with nothing on screen to fix. Only name and email are filled.
   */
  await page.getByLabel('Name').fill('Guest Diner');
  await page.getByLabel('Email').fill('guest@pizza.test');
  await page.getByRole('button', { name: 'Continue to payment' }).click();

  await expect(page.getByRole('heading', { name: 'Payment' })).toBeVisible();
  // No delivery fee on a pickup.
  await expect(page.locator('.sticky-summary').getByText('Delivery')).toBeHidden();
});

test('a signed-in customer gets their PRIMARY address preselected', async ({ page }) => {
  await signIn(page, CUSTOMER);

  await page.goto('/menu?type=PIZZA');
  await addProduct(page, 'Pepperoni Pizza');
  const cart = await openCart(page);
  await cart.getByRole('button', { name: 'Checkout' }).click();

  const primary = page.locator('.form-check', { hasText: 'primary' }).locator('input[type=radio]');
  await expect(primary).toBeChecked();

  // With a saved address chosen there is nothing to type.
  await expect(page.getByLabel('Street address')).toBeHidden();
});

test('a signed-in customer can still type a different address', async ({ page }) => {
  await signIn(page, CUSTOMER);

  await page.goto('/menu?type=PIZZA');
  await addProduct(page, 'Pepperoni Pizza');
  const cart = await openCart(page);
  await cart.getByRole('button', { name: 'Checkout' }).click();

  await page.getByLabel('Use a different address').check();
  await expect(page.getByLabel('Street address')).toBeVisible();
});

test('a guest is offered sign-in but never forced into it', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await addProduct(page, 'Pepperoni Pizza');
  const cart = await openCart(page);
  await cart.getByRole('button', { name: 'Checkout' }).click();

  await expect(page.getByText(/Checking out as a guest/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeEnabled();
});
