import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * The customer profile: saved addresses and saved cards, plus the checkout address chooser.
 *
 * Each test cleans up the addresses it creates so the seeded "Home" / "Work" pair survives.
 */

const API = 'http://localhost:8085';

/**
 * Rows inside the ADDRESSES card specifically.
 *
 * Two things to note. react-bootstrap renders ListGroup.Item as a <div class="list-group-item">
 * here, not an <li>, so getByRole('listitem') matches nothing. And the payment-methods card uses
 * the same list markup — including its own "primary" badge — so anything unscoped counts both.
 */
function addressesCard(page: Page) {
  return page
    .getByRole('heading', { name: 'Delivery addresses' })
    .locator('xpath=ancestor::div[contains(@class,"card-body")]');
}

function addressRow(page: Page) {
  return addressesCard(page).locator('.list-group-item');
}

test.beforeAll(async ({ request }) => {
  const response = await request.get(`${API}/api/products`).catch(() => null);
  if (!response?.ok()) throw new Error('The backend is not responding at http://localhost:8085.');
});

async function signIn(page: Page, destination = '/profile') {
  await page.goto(destination);
  await page.getByLabel('Email').fill('customer@pizza.test');
  await page.getByLabel('Password').fill('pizza123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(new RegExp(destination.replace('/', '\\/')));
}

/** Remove any address this suite created, and make sure Home is primary again. */
test.afterEach(async ({ request }) => {
  const token = await request
    .post(`${API}/api/auth/login`, {
      data: { email: 'customer@pizza.test', password: 'pizza123' },
    })
    .then((r) => r.json())
    .then((body: { token: string }) => body.token);
  const headers = { Authorization: `Bearer ${token}` };

  const addresses: Array<{ id: string; label: string | null; primary: boolean }> = await request
    .get(`${API}/api/me/addresses`, { headers })
    .then((r) => r.json());

  for (const address of addresses.filter((a) => (a.label ?? '').startsWith('E2E'))) {
    await request.delete(`${API}/api/me/addresses/${address.id}`, { headers });
  }

  const home = addresses.find((a) => a.label === 'Home');
  if (home && !home.primary) {
    await request.patch(`${API}/api/me/addresses/${home.id}/primary`, { headers });
  }
});

test('the profile page shows the account and its saved addresses', async ({ page }) => {
  await signIn(page);

  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  await expect(page.getByText('customer@pizza.test').first()).toBeVisible();

  // Not exact matching: the label sits in the same element as the "primary" badge, so the
  // element's text is "Home primary", never exactly "Home".
  await expect(addressRow(page).filter({ hasText: 'Home' })).toBeVisible();
  await expect(addressRow(page).filter({ hasText: 'Work' })).toBeVisible();
  await expect(page.getByText('123 Main St, Salt Lake City, UT 84101')).toBeVisible();
});

test('the profile is reachable from the account menu', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('customer@pizza.test');
  await page.getByLabel('Password').fill('pizza123');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await page.getByRole('button', { name: /Demo Customer/ }).click();
  await page.getByRole('link', { name: 'Profile' }).click();

  await expect(page).toHaveURL(/\/profile/);
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
});

test('/profile requires signing in', async ({ page }) => {
  await page.goto('/profile');
  await expect(page).toHaveURL(/\/login/);
});

test('exactly one address is primary, and it can be changed', async ({ page }) => {
  await signIn(page);

  // Home is primary out of the seed.
  const homeRow = addressRow(page).filter({ hasText: 'Home' });
  await expect(homeRow.getByText('primary')).toBeVisible();

  const workRow = addressRow(page).filter({ hasText: 'Work' });
  await workRow.getByRole('button', { name: 'Make primary' }).click();

  // The badge moves — it never ends up on both.
  await expect(
    addressRow(page).filter({ hasText: 'Work' }).getByText('primary'),
  ).toBeVisible();
  // exact:true matters — "primary" is also a substring of the "Make primary" button. Scoped to
  // the addresses card, because a saved card carries its own (legitimate) primary badge.
  await expect(addressesCard(page).getByText('primary', { exact: true })).toHaveCount(1);
});

test('an address can be added, edited and deleted', async ({ page }) => {
  const label = `E2E Addr ${Date.now()}`;
  await signIn(page);

  await page.getByRole('button', { name: 'Add address' }).click();
  await page.getByLabel('Label').fill(label);
  await page.getByLabel('Street address').fill('99 Test Loop');
  await page.getByLabel('City').fill('Provo');
  await page.getByLabel('State').fill('UT');
  await page.getByLabel('ZIP').fill('84601');
  await page.getByRole('button', { name: 'Save address' }).click();

  await expect(page.getByText(label)).toBeVisible();
  await expect(page.getByText('99 Test Loop, Provo, UT 84601')).toBeVisible();

  // Edit it.
  const row = addressRow(page).filter({ hasText: label });
  await row.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Street address').fill('101 Edited Way');
  await page.getByRole('button', { name: 'Save address' }).click();
  await expect(page.getByText('101 Edited Way, Provo, UT 84601')).toBeVisible();

  // Delete it.
  await addressRow(page)
    .filter({ hasText: label })
    .getByRole('button', { name: 'Delete' })
    .click();
  await expect(page.getByText(label)).toBeHidden();
});

test('a bad ZIP is rejected when saving an address', async ({ page }) => {
  await signIn(page);

  await page.getByRole('button', { name: 'Add address' }).click();
  await page.getByLabel('Label').fill('E2E Bad Zip');
  await page.getByLabel('Street address').fill('1 Nowhere');
  await page.getByLabel('City').fill('Provo');
  await page.getByLabel('State').fill('UT');
  await page.getByLabel('ZIP').fill('abc');
  await page.getByRole('button', { name: 'Save address' }).click();

  // The modal stays open so the mistake can be fixed.
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('the payment methods section never claims to hold the card', async ({ page }) => {
  await signIn(page);

  await expect(page.getByRole('heading', { name: 'Payment methods' })).toBeVisible();
  await expect(page.getByText(/Cards are stored by Stripe/)).toBeVisible();
  await expect(page.getByText(/never the card number/)).toBeVisible();
});

test('adding a card opens Stripe, not a card form of our own', async ({ page }) => {
  await signIn(page);

  await page.getByRole('button', { name: 'Add card' }).click();

  // A Stripe-hosted iframe appears; there is no card input in OUR DOM.
  await expect(page.locator('iframe[name^="__privateStripeFrame"]').first()).toBeAttached({
    timeout: 20_000,
  });
  await expect(page.getByRole('button', { name: 'Save card' })).toBeVisible();
  expect(await page.locator('input[name="cardnumber"], input#cardNumber').count()).toBe(0);
});

// ---------------------------------------------------------------- checkout

test('checkout preselects the primary address', async ({ page }) => {
  await signIn(page, '/profile');

  await page.goto('/menu?type=PIZZA');
  await page.getByRole('button', { name: 'Build it' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Add to cart' }).click();
  await page.getByRole('button', { name: /Open cart/ }).click();
  await page.getByRole('button', { name: 'Checkout' }).click();

  // Home is the seeded primary, so it is the one checked.
  const home = page.getByRole('radio', { name: /Home/ });
  await expect(home).toBeChecked();
  // The typed address fields stay out of the way while a saved one is selected.
  await expect(page.getByLabel('Street address')).toBeHidden();
});

test('a different saved address can be chosen at checkout', async ({ page }) => {
  await signIn(page, '/profile');

  await page.goto('/menu?type=PIZZA');
  await page.getByRole('button', { name: 'Build it' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Add to cart' }).click();
  await page.getByRole('button', { name: /Open cart/ }).click();
  await page.getByRole('button', { name: 'Checkout' }).click();

  await page.getByRole('radio', { name: /Work/ }).check();
  await expect(page.getByRole('radio', { name: /Work/ })).toBeChecked();

  await page.getByRole('button', { name: /Continue to payment/ }).click();
  await expect(page.getByText(/is reserved/)).toBeVisible({ timeout: 20_000 });
});

test('"Use a different address" reveals the manual fields again', async ({ page }) => {
  await signIn(page, '/profile');

  await page.goto('/menu?type=PIZZA');
  await page.getByRole('button', { name: 'Build it' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Add to cart' }).click();
  await page.getByRole('button', { name: /Open cart/ }).click();
  await page.getByRole('button', { name: 'Checkout' }).click();

  await page.getByRole('radio', { name: 'Use a different address' }).check();
  await expect(page.getByLabel('Street address')).toBeVisible();
});

test('a guest sees no address chooser at all', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await page.getByRole('button', { name: 'Build it' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Add to cart' }).click();
  await page.getByRole('button', { name: /Open cart/ }).click();
  await page.getByRole('button', { name: 'Checkout' }).click();

  // Nothing saved to choose from — just the plain form.
  await expect(page.getByRole('radio', { name: /Home/ })).toBeHidden();
  await expect(page.getByLabel('Street address')).toBeVisible();
});
