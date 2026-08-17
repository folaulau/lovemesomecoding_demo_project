import { expect, test } from '@playwright/test';

/** Sign-in, registration, sessions and route guards — all through the UI. */

test.beforeAll(async ({ request }) => {
  const response = await request.get('http://localhost:8085/api/products').catch(() => null);
  if (!response?.ok()) throw new Error('The backend is not responding at http://localhost:8085.');
});

test('the login page offers the demo credentials and a guest reminder', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByText(/customer@pizza.test/)).toBeVisible();
  await expect(page.getByText(/never have to sign in to order/)).toBeVisible();
});

test('a customer can sign in and out', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('customer@pizza.test');
  await page.getByLabel('Password').fill('pizza123');
  await page.getByRole('button', { name: 'Sign in' }).click();

  // The navbar swaps "Sign in" for the account menu.
  await expect(page.getByRole('button', { name: /Demo Customer/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeHidden();

  await page.getByRole('button', { name: /Demo Customer/ }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();

  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
});

test('bad credentials show the API error and keep you on the page', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('customer@pizza.test');
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText('Invalid email or password')).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test('an unknown email fails the same way — no account enumeration', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('nobody@pizza.test');
  await page.getByLabel('Password').fill('whatever1');
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Deliberately identical to the wrong-password message.
  await expect(page.getByText('Invalid email or password')).toBeVisible();
});

test('the session survives a page refresh', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('customer@pizza.test');
  await page.getByLabel('Password').fill('pizza123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: /Demo Customer/ })).toBeVisible();

  await page.reload();

  // The stored token is re-validated against /api/auth/me on load.
  await expect(page.getByRole('button', { name: /Demo Customer/ })).toBeVisible();
});

test('signing out really clears the session', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('customer@pizza.test');
  await page.getByLabel('Password').fill('pizza123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: /Demo Customer/ })).toBeVisible();

  await page.getByRole('button', { name: /Demo Customer/ }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.reload();

  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
});

test('/orders redirects to login and then returns you there', async ({ page }) => {
  await page.goto('/orders');
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel('Email').fill('customer@pizza.test');
  await page.getByLabel('Password').fill('pizza123');
  await page.getByRole('button', { name: 'Sign in' }).click();

  // ProtectedRoute stashed the attempted location, so we land back on /orders, not the home page.
  await expect(page).toHaveURL(/\/orders/);
  await expect(page.getByRole('heading', { name: 'My orders' })).toBeVisible();
});

test('the Admin tab is hidden from customers and shown to admins', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('customer@pizza.test');
  await page.getByLabel('Password').fill('pizza123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: /Demo Customer/ })).toBeVisible();

  await expect(page.getByRole('navigation').getByRole('link', { name: 'Admin' })).toBeHidden();

  await page.getByRole('button', { name: /Demo Customer/ }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();

  await page.getByRole('link', { name: 'Sign in' }).click();
  await page.getByLabel('Email').fill('admin@pizza.test');
  await page.getByLabel('Password').fill('admin123');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('navigation').getByRole('link', { name: 'Admin' })).toBeVisible();
});

test('a signed-in customer is bounced off /admin', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('customer@pizza.test');
  await page.getByLabel('Password').fill('pizza123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: /Demo Customer/ })).toBeVisible();

  await page.goto('/admin');
  await expect(page).toHaveURL('http://localhost:5173/');
});

test('refreshing on /admin keeps an admin signed in', async ({ page }) => {
  await page.goto('/admin');
  await page.getByLabel('Email').fill('admin@pizza.test');
  await page.getByLabel('Password').fill('admin123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin/);

  await page.reload();

  // Regression guard: the route guard used to decide before the stored token had been
  // validated, so a refresh here bounced a perfectly valid admin to the login page.
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByRole('heading', { name: 'Sales reports' })).toBeVisible();
});

test('a new customer can register and is signed in immediately', async ({ page }) => {
  const email = `e2e-signup-${Date.now()}@example.com`;

  await page.goto('/login');
  await page.getByRole('link', { name: /Create one/ }).click();

  await page.getByLabel('Full name').fill('E2E Signup');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByRole('button', { name: /E2E Signup/ })).toBeVisible();
});

test('registering with an existing email shows the API error', async ({ page }) => {
  await page.goto('/register');

  await page.getByLabel('Full name').fill('Duplicate');
  await page.getByLabel('Email').fill('customer@pizza.test');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByText(/already registered/)).toBeVisible();
});
