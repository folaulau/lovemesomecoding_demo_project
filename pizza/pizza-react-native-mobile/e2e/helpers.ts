import type { Page } from '@playwright/test';

/**
 * Waits for the app to be interactive.
 *
 * <p>Expo's web build compiles on demand, so the FIRST page load of a run can take a while. It also
 * shows a splash until the auth provider has finished reading storage, which means "the HTML has
 * loaded" is not the same as "the app is ready".
 */
export async function openApp(page: Page, path = '/') {
  await page.goto(path);
  await page.getByTestId('home-screen').or(page.getByTestId('menu-screen')).first().waitFor({
    timeout: 90_000,
  });
}

/** Navigates to the menu tab and waits for the catalogue to render. */
export async function openMenu(page: Page) {
  await page.goto('/menu');
  await page.getByTestId('menu-screen').waitFor({ timeout: 90_000 });
  // The first card only exists once the API has answered.
  await page.locator('[data-testid^="product-card-"]').first().waitFor();
}

/**
 * Signs in with the demo customer, and does not return until the session actually exists.
 *
 * <p>Waiting for the login RESPONSE matters. `click()` resolves the moment the tap is dispatched,
 * and a `page.goto` straight afterwards is a full page load that throws away the in-flight request
 * — the app then comes back signed out and the failure looks like a broken login rather than a
 * test that did not wait.
 */
export async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByTestId('login-screen').waitFor({ timeout: 90_000 });
  await page.getByTestId('login-email').fill('customer@pizza.test');
  await page.getByTestId('login-password').fill('pizza123');

  const loggedIn = page.waitForResponse(
    (response) => response.url().endsWith('/api/auth/login') && response.status() === 200,
  );
  await page.getByTestId('login-submit').click();
  await loggedIn;

  // The screen navigates away once the token is stored.
  await page.getByTestId('login-screen').waitFor({ state: 'detached' });
}
