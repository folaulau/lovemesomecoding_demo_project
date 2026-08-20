import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export const API = 'http://localhost:8085';

export const ADMIN = { email: 'admin@pizza.test', password: 'admin123' };
export const CUSTOMER = { email: 'customer@pizza.test', password: 'pizza123' };

/** Fails fast with a useful message rather than 30 confusing timeouts. */
export async function requireBackend(request: { get: (url: string) => Promise<{ ok(): boolean }> }) {
  const response = await request.get(`${API}/api/products`).catch(() => null);
  if (!response?.ok()) throw new Error(`The backend is not responding at ${API}.`);
}

export function cartButton(page: Page) {
  return page.getByRole('button', { name: /Open cart/ });
}

export function drawer(page: Page) {
  return page.getByRole('dialog').filter({ hasText: 'Your order' });
}

export async function openCart(page: Page) {
  await cartButton(page).click();
  await expect(drawer(page)).toBeVisible();
  return drawer(page);
}

/** Build a product through the modal and add it to the cart. */
export async function addProduct(
  page: Page,
  name: string,
  options: { size?: 'SMALL' | 'MEDIUM' | 'LARGE'; toppings?: string[]; quantity?: string } = {},
) {
  await page
    // exact:true matters: "Pepsi" is a substring of "Diet Pepsi".
    .getByRole('heading', { name, exact: true })
    .locator('xpath=ancestor::div[contains(@class,"product-card")]')
    .getByRole('button', { name: /Build it|Add/ })
    .click();

  const dialog = page.getByRole('dialog').filter({ hasText: 'Size' });
  await expect(dialog).toBeVisible();

  if (options.size) await dialog.locator(`label[for="size-${options.size}"]`).click();
  for (const topping of options.toppings ?? []) {
    await dialog.getByRole('button', { name: new RegExp(topping) }).click();
  }
  if (options.quantity) await dialog.getByLabel('Quantity').selectOption(options.quantity);

  await dialog.getByRole('button', { name: 'Add to cart' }).click();
  await expect(dialog).toBeHidden();
}

/** Sign in through the form, as a user would. */
export async function signIn(page: Page, who: { email: string; password: string }) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(who.email);
  await page.getByLabel('Password').fill(who.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: /Open cart/ })).toBeVisible();
  // The account dropdown only exists once signed in.
  await expect(page.getByRole('button', { name: new RegExp(who.email.split('@')[0], 'i') })).toBeVisible();
}

/** A bearer token straight from the API, for tests that need to set up or clean up state. */
export async function tokenFor(
  request: { post: (url: string, opts: unknown) => Promise<{ json(): Promise<{ token: string }> }> },
  who: { email: string; password: string },
): Promise<string> {
  const response = await request.post(`${API}/api/auth/login`, { data: who });
  return (await response.json()).token;
}

/**
 * The order id the checkout page prints once step 1 has succeeded.
 *
 * <p>Reading it off the page — rather than out of the POST response — is deliberate. Playwright
 * discards a response body as soon as the page navigates, and Stripe mounting its card iframes
 * counts: `response.json()` intermittently failed with "No data found for resource with given
 * identifier". The id is on screen anyway, and the API can be asked for the rest.
 */
export async function reservedOrderId(page: Page): Promise<string> {
  const code = page.locator('.sticky-summary code');
  await expect(code).toBeVisible();
  return (await code.textContent())!.trim();
}

/** The order as the SERVER currently reports it. The only authority on what anything cost. */
export async function fetchOrder(
  request: { get: (url: string) => Promise<{ json(): Promise<Record<string, number>> }> },
  orderId: string,
) {
  const response = await request.get(`${API}/api/orders/${orderId}/payment-status`);
  return response.json();
}
