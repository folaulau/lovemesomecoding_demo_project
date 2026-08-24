import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test.describe('authentication', () => {
  test('the orders tab prompts for sign-in rather than redirecting away', async ({ page }) => {
    await page.goto('/orders');
    await expect(page.getByText('Sign in to see this')).toBeVisible({ timeout: 90_000 });
    // Still on /orders — the tab the customer tapped stays selected.
    await expect(page).toHaveURL(/\/orders/);
  });

  test('the profile tab does the same', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.getByText('Sign in to see this')).toBeVisible({ timeout: 90_000 });
  });

  test('signs in the demo customer', async ({ page }) => {
    await signIn(page);

    await page.goto('/profile');
    await expect(page.getByTestId('profile-screen')).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText(/customer@pizza\.test/)).toBeVisible();
  });

  test('rejects a wrong password with a vague message, and stays signed out', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-screen').waitFor({ timeout: 90_000 });

    await page.getByTestId('login-email').fill('customer@pizza.test');
    await page.getByTestId('login-password').fill('definitely-wrong');
    await page.getByTestId('login-submit').click();

    await expect(page.getByText('Something went wrong')).toBeVisible();
    /*
     * Deliberately vague. A message distinguishing "no such account" from "wrong password" is an
     * account-enumeration oracle — the API is careful about this, and so is the UI.
     */
    await expect(page.getByText(/no such (account|user)/i)).toHaveCount(0);

    await page.goto('/orders');
    await expect(page.getByText('Sign in to see this')).toBeVisible();
  });

  test('the session survives a reload — the token is stored, not held in memory', async ({
    page,
  }) => {
    await signIn(page);
    await page.goto('/profile');
    await expect(page.getByTestId('profile-screen')).toBeVisible({ timeout: 90_000 });

    await page.reload();

    await expect(page.getByTestId('profile-screen')).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText('Sign in to see this')).toHaveCount(0);
  });

  test('signing out clears the session', async ({ page }) => {
    await signIn(page);
    await page.goto('/profile');
    await expect(page.getByTestId('profile-screen')).toBeVisible({ timeout: 90_000 });

    await page.getByTestId('profile-sign-out').click();

    await page.goto('/profile');
    await expect(page.getByText('Sign in to see this')).toBeVisible();
  });

  test('signed-in customers see their order history', async ({ page }) => {
    await signIn(page);
    await page.goto('/orders');

    await expect(page.getByTestId('orders-screen')).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText('My orders')).toBeVisible();
  });
});

test.describe('registration', () => {
  test('reaches the register screen from sign-in', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-screen').waitFor({ timeout: 90_000 });

    await page.getByText('Create an account').click();

    await expect(page.getByTestId('register-screen')).toBeVisible();
    // Worth stating in the UI, because the API enforces it and no request body can change it.
    await expect(page.getByText('New accounts are always customers.')).toBeVisible();
  });
});
