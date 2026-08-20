import { expect, test } from '@playwright/test';
import { ADMIN, API, CUSTOMER, requireBackend, signIn } from './helpers';

/** Authentication, route guards and what each role can see. */

test.beforeAll(async ({ request }) => requireBackend(request));

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('a customer can sign in and sees their account menu', async ({ page }) => {
  await signIn(page, CUSTOMER);
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeHidden();
  // A customer must not see the admin tab.
  await expect(page.getByRole('link', { name: 'Admin' })).toBeHidden();
});

test('an admin sees the Admin tab', async ({ page }) => {
  await signIn(page, ADMIN);
  await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible();
});

test('bad credentials show a deliberately vague message', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(CUSTOMER.email);
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  const alert = page.locator('.alert-danger');
  await expect(alert).toBeVisible();
  // Vagueness is the feature: naming which half was wrong would confirm the account exists.
  await expect(alert).not.toContainText(/no such user|unknown email/i);
  await expect(page).toHaveURL(/\/login/);
});

test('signing out forgets the session', async ({ page }) => {
  await signIn(page, CUSTOMER);

  await page.getByRole('button', { name: /customer/i }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();

  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('pizza.token'))).toBeNull();
});

test('a session survives a reload — the token is re-validated against the API', async ({ page }) => {
  await signIn(page, CUSTOMER);
  await page.reload();
  await expect(page.getByRole('button', { name: /customer/i })).toBeVisible();
});

test('an invalid stored token is dropped rather than left lying around', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('pizza.token', 'not-a-real-jwt'));
  await page.reload();

  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('pizza.token')))
    .toBeNull();
});

test('a guest hitting /orders is sent to sign in, and back afterwards', async ({ page }) => {
  await page.goto('/orders');

  await expect(page).toHaveURL(/\/login\?returnUrl=%2Forders/);

  await page.getByLabel('Email').fill(CUSTOMER.email);
  await page.getByLabel('Password').fill(CUSTOMER.password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // The guard stashed where they were going, so they land there rather than on the home page.
  await expect(page).toHaveURL(/\/orders/);
});

test('a guest hitting /profile is sent to sign in', async ({ page }) => {
  await page.goto('/profile');
  await expect(page).toHaveURL(/\/login\?returnUrl=%2Fprofile/);
});

test('a signed-in CUSTOMER is bounced off /admin to the home page', async ({ page }) => {
  await signIn(page, CUSTOMER);
  await page.goto('/admin');

  // Home, not the login page — signing in again would not help.
  await expect(page).toHaveURL('http://localhost:4200/');
  await expect(page.getByRole('heading', { name: 'No One OutPizzas the Hub' })).toBeVisible();
});

test('refreshing on /admin as an admin does NOT bounce to login', async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();

  /*
   * The bug this guards: the guard AWAITS the session restore, so the router holds the navigation
   * until the answer is known. A guard that read auth state synchronously would see "not signed in"
   * on the first frame and redirect a perfectly valid admin.
   */
  await page.reload();
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();
});

test('registration creates a CUSTOMER — the role never comes from the browser', async ({ page, request }) => {
  const email = `angular-e2e-${Date.now()}@pizza.test`;

  await page.goto('/register');
  await page.getByLabel('Full name').fill('Angular E2E');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Create account' }).click();

  // The navbar shows the NAME when there is one, falling back to the email — see `displayName`.
  await expect(page.getByRole('button', { name: 'Angular E2E' })).toBeVisible();
  // No Admin tab: a request body cannot promote anyone.
  await expect(page.getByRole('link', { name: 'Admin' })).toBeHidden();

  // Clean up, or the users table grows by one on every run.
  const login = await request.post(`${API}/api/auth/login`, { data: ADMIN });
  const { token } = await login.json();
  const users = await request.get(`${API}/api/admin/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const created = (await users.json()).find((u: { email: string }) => u.email === email);
  if (created) {
    await request.delete(`${API}/api/admin/users/${created.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
});
