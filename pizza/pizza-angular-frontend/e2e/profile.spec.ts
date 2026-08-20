import { expect, test } from '@playwright/test';
import { CUSTOMER, requireBackend, signIn } from './helpers';

/** The signed-in customer's own profile: addresses and saved cards. */

test.beforeAll(async ({ request }) => requireBackend(request));

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await signIn(page, CUSTOMER);
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
});

test('the account card shows who is signed in', async ({ page }) => {
  const account = page.locator('.card', { hasText: 'Account' }).first();
  await expect(account.getByText(CUSTOMER.email)).toBeVisible();
  await expect(account.locator('.badge')).toHaveText('CUSTOMER');
});

test('an address can be added, edited and deleted', async ({ page }) => {
  const label = `E2E ${Date.now()}`;

  await page.getByRole('button', { name: 'Add address' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Label').fill(label);
  await dialog.getByLabel('Street address').fill('9 Angular Way');
  await dialog.getByLabel('City').fill('Testville');
  await dialog.getByLabel('State').fill('CA');
  await dialog.getByLabel('ZIP').fill('90210');
  await dialog.getByRole('button', { name: 'Save address' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText('Address saved')).toBeVisible();
  const row = page.locator('.list-group-item', { hasText: label });
  await expect(row).toBeVisible();
  await expect(row).toContainText('9 Angular Way');

  // Edit
  await row.getByRole('button', { name: 'Edit' }).click();
  await dialog.getByLabel('Street address').fill('10 Signal Street');
  await dialog.getByRole('button', { name: 'Save address' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('.list-group-item', { hasText: label })).toContainText(
    '10 Signal Street',
  );

  // Delete — tests must clean up what they create, or a failure poisons every later run.
  await page
    .locator('.list-group-item', { hasText: label })
    .getByRole('button', { name: 'Delete' })
    .click();
  await expect(page.locator('.list-group-item', { hasText: label })).toHaveCount(0);
});

test('an invalid ZIP is caught before anything is sent', async ({ page }) => {
  await page.getByRole('button', { name: 'Add address' }).click();
  const dialog = page.getByRole('dialog');

  await dialog.getByLabel('Street address').fill('9 Angular Way');
  await dialog.getByLabel('City').fill('Testville');
  await dialog.getByLabel('State').fill('CA');
  await dialog.getByLabel('ZIP').fill('abc');
  await dialog.getByRole('button', { name: 'Save address' }).click();

  // The modal stays open — the form knows it is invalid without asking the server.
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
});

test('exactly one address is primary at a time', async ({ page }) => {
  const label = `E2E primary ${Date.now()}`;

  await page.getByRole('button', { name: 'Add address' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Label').fill(label);
  await dialog.getByLabel('Street address').fill('11 Primary Place');
  await dialog.getByLabel('City').fill('Testville');
  await dialog.getByLabel('State').fill('CA');
  await dialog.getByLabel('ZIP').fill('90210');
  await dialog.getByRole('button', { name: 'Save address' }).click();
  await expect(dialog).toBeHidden();

  const row = page.locator('.list-group-item', { hasText: label });
  await row.getByRole('button', { name: 'Make primary' }).click();
  await expect(page.getByText('Primary address updated')).toBeVisible();

  /*
   * Exactly one BADGE, on the row we just promoted. `.badge` and not `getByText('primary')` —
   * every other row carries a "Make primary" button, which contains the same word.
   */
  const addressList = page.locator('.card', { hasText: 'Delivery addresses' });
  await expect(addressList.locator('.badge')).toHaveCount(1);
  await expect(row).toContainText('primary');

  // Restore: promote another address back, then delete ours.
  const other = addressList
    .locator('.list-group-item')
    .filter({ hasNot: page.getByText(label) })
    .first();
  await other.getByRole('button', { name: 'Make primary' }).click();
  await expect(
    page.locator('.list-group-item', { hasText: label }).locator('.badge'),
  ).toHaveCount(0);
  await page
    .locator('.list-group-item', { hasText: label })
    .getByRole('button', { name: 'Delete' })
    .click();
  await expect(page.locator('.list-group-item', { hasText: label })).toHaveCount(0);
});

test('the page states plainly that we do not hold the card', async ({ page }) => {
  await expect(page.getByText(/Cards are stored by Stripe/)).toBeVisible();
  await expect(page.getByText(/never the card number/)).toBeVisible();
});

test('Add card opens a Stripe SetupIntent, not a charge', async ({ page }) => {
  const setup = page.waitForResponse((r) =>
    r.url().includes('/api/me/payment-methods/setup-intent'),
  );
  await page.getByRole('button', { name: 'Add card' }).click();
  const response = await setup;

  // A SetupIntent secret (seti_…), never a PaymentIntent — the point is to STORE a card.
  const { clientSecret } = await response.json();
  expect(clientSecret).toMatch(/^seti_/);

  await expect(page.getByRole('button', { name: 'Save card' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('button', { name: 'Add card' })).toBeVisible();
});

test('no card number ever reaches our API', async ({ page }) => {
  const ourRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().startsWith('http://localhost:8085')) {
      ourRequests.push(request.postData() ?? '');
    }
  });

  await page.getByRole('button', { name: 'Add card' }).click();
  await expect(page.getByRole('button', { name: 'Save card' })).toBeVisible();

  // If a `cardNumber` field ever appears anywhere in this app, something has gone badly wrong.
  expect(ourRequests.join('\n')).not.toMatch(/cardNumber|cvc|4242/i);
});
