import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/** The checkout flow, through the UI. */

test.beforeAll(async ({ request }) => {
  const response = await request.get('http://localhost:8085/api/products').catch(() => null);
  if (!response?.ok()) throw new Error('The backend is not responding at http://localhost:8085.');
});

async function addPizzaAndGoToCheckout(
  page: Page,
  name = 'Pepperoni Pizza',
  size: 'SMALL' | 'MEDIUM' | 'LARGE' = 'LARGE',
) {
  await page.goto('/menu?type=PIZZA');
  await page
    .getByRole('heading', { name, exact: true })
    .locator('xpath=ancestor::div[contains(@class,"product-card")]')
    .getByRole('button', { name: 'Build it' })
    .click();
  await page.getByRole('dialog').locator(`label[for="size-${size}"]`).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Add to cart' }).click();

  await page.getByRole('button', { name: /Open cart/ }).click();
  await page.getByRole('button', { name: 'Checkout' }).click();
  await expect(page).toHaveURL(/\/checkout/);
}

async function fillDeliveryDetails(page: Page) {
  await page.getByLabel('Name').fill('Guest Tester');
  await page.getByLabel('Email').fill('guest@example.com');
  await page.getByLabel('Street address').fill('123 Test St');
  await page.getByLabel('City').fill('Salt Lake City');
  await page.getByLabel('State').fill('UT');
  await page.getByLabel('ZIP').fill('84101');
}

test('checking out with an empty cart offers the menu instead', async ({ page }) => {
  await page.goto('/checkout');

  await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
  await page.getByRole('button', { name: 'Browse the menu' }).click();
  await expect(page).toHaveURL(/\/menu/);
});

test('a guest sees the optional sign-in notice', async ({ page }) => {
  await addPizzaAndGoToCheckout(page);
  await expect(page.getByText(/Checking out as a guest/)).toBeVisible();
});

test('the form refuses to submit while required fields are empty', async ({ page }) => {
  await addPizzaAndGoToCheckout(page);

  // Submit with everything blank.
  await page.getByRole('button', { name: /Continue to payment/ }).click();

  // Still on step 1 — no order was created.
  await expect(page.getByRole('button', { name: /Continue to payment/ })).toBeVisible();
  await expect(page.getByText(/is reserved/)).toBeHidden();
  await expect(page.getByText('Please tell us who the order is for.')).toBeVisible();
});

test('a malformed ZIP is rejected', async ({ page }) => {
  await addPizzaAndGoToCheckout(page);
  await fillDeliveryDetails(page);
  await page.getByLabel('ZIP').fill('abc');

  await page.getByRole('button', { name: /Continue to payment/ }).click();

  await expect(page.getByText('Five digits, please.')).toBeVisible();
  await expect(page.getByText(/is reserved/)).toBeHidden();
});

test('carryout hides the address fields entirely', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await page.getByRole('button', { name: 'Build it' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Add to cart' }).click();

  await page.getByRole('button', { name: /Open cart/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Carryout' }).click();
  await page.getByRole('button', { name: 'Checkout' }).click();

  await expect(page.getByRole('heading', { name: 'Delivery address' })).toBeHidden();
  await expect(page.getByLabel('Street address')).toBeHidden();
  await expect(page.getByText(/Order summary · carryout/)).toBeVisible();
});

test('a guest can create a real order, priced by the server', async ({ page }) => {
  // Large Pepperoni = 16.99. Delivery adds 3.99; tax is 8.5% => 22.42.
  await addPizzaAndGoToCheckout(page);
  await fillDeliveryDetails(page);

  await page.getByRole('button', { name: /Continue to payment/ }).click();

  await expect(page.getByText(/is reserved/)).toBeVisible({ timeout: 15_000 });
  // The summary now shows the SERVER's figures.
  await expect(page.getByText('$22.42', { exact: true }).last()).toBeVisible();
  // Stripe Elements mounts once the clientSecret arrives.
  await expect(page.getByRole('button', { name: /^Pay \$22\.42$/ })).toBeVisible({
    timeout: 20_000,
  });
});

test('carryout costs less than delivery — no fee on the created order', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await page
    .getByRole('heading', { name: 'Pepperoni Pizza', exact: true })
    .locator('xpath=ancestor::div[contains(@class,"product-card")]')
    .getByRole('button', { name: 'Build it' })
    .click();
  await page.getByRole('dialog').locator('label[for="size-LARGE"]').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Add to cart' }).click();

  await page.getByRole('button', { name: /Open cart/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Carryout' }).click();
  await page.getByRole('button', { name: 'Checkout' }).click();

  await page.getByLabel('Name').fill('Carryout Tester');
  await page.getByLabel('Email').fill('carryout@example.com');
  await page.getByRole('button', { name: /Continue to payment/ }).click();

  // 16.99 + 1.44 tax, no delivery fee.
  await expect(page.getByRole('button', { name: /^Pay \$18\.43$/ })).toBeVisible({
    timeout: 20_000,
  });
});

test('a signed-in customer gets their details prefilled and no guest notice', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('customer@pizza.test');
  await page.getByLabel('Password').fill('pizza123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: /Demo Customer/ })).toBeVisible();

  await addPizzaAndGoToCheckout(page);

  await expect(page.getByText(/Checking out as a guest/)).toBeHidden();
  await expect(page.getByLabel('Name')).toHaveValue('Demo Customer');
  await expect(page.getByLabel('Email')).toHaveValue('customer@pizza.test');
});

test('the summary lists every line before the order is created', async ({ page }) => {
  await page.goto('/menu');
  for (const name of ['Cheese Pizza', 'Pepsi']) {
    await page
      .getByRole('heading', { name, exact: true })
      .locator('xpath=ancestor::div[contains(@class,"product-card")]')
      .getByRole('button', { name: /Build it|Add/ })
      .click();
    await page.getByRole('dialog').getByRole('button', { name: 'Add to cart' }).click();
  }

  await page.getByRole('button', { name: /Open cart/ }).click();
  await page.getByRole('button', { name: 'Checkout' }).click();

  const summary = page.getByText('Order summary', { exact: false }).locator('xpath=ancestor::div[contains(@class,"card-body")]');
  await expect(summary.getByText(/Cheese Pizza/)).toBeVisible();
  await expect(summary.getByText(/Pepsi/)).toBeVisible();
});

test('delivery and pickup can be switched on the checkout page itself', async ({ page }) => {
  await addPizzaAndGoToCheckout(page);

  /*
   * Scope to this card. The cart drawer also has Delivery/Carryout buttons and stays in the DOM
   * while hidden, so an unscoped locator matches two elements.
   */
  const options = page
    .getByRole('heading', { name: 'How would you like it?' })
    .locator('xpath=ancestor::div[contains(@class,"card-body")]');

  // Delivery is the default, so the address block and the fee are both present.
  await expect(options.getByRole('button', { name: /^Delivery/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('heading', { name: 'Delivery address' })).toBeVisible();

  // Scope the fee too — the hidden cart drawer shows the same figure.
  const summary = page
    .getByRole('heading', { name: /Order summary/ })
    .locator('xpath=ancestor::div[contains(@class,"card-body")]');
  await expect(summary.getByText('$3.99', { exact: true })).toBeVisible();

  // Switching to pickup drops the fee and the address requirement.
  await options.getByRole('button', { name: /^Pick up/ }).click();
  await expect(options.getByRole('button', { name: /^Pick up/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('heading', { name: 'Delivery address' })).toBeHidden();
  await expect(summary.getByText('$3.99', { exact: true })).toBeHidden();
  await expect(page.getByText(/Order summary · carryout/)).toBeVisible();

  // …and back again.
  await options.getByRole('button', { name: /^Delivery/ }).click();
  await expect(page.getByRole('heading', { name: 'Delivery address' })).toBeVisible();
});

test('switching to pickup at checkout produces an order with no delivery fee', async ({ page }) => {
  await addPizzaAndGoToCheckout(page);

  await page
    .getByRole('heading', { name: 'How would you like it?' })
    .locator('xpath=ancestor::div[contains(@class,"card-body")]')
    .getByRole('button', { name: /^Pick up/ })
    .click();
  await page.getByLabel('Name').fill('Pickup Tester');
  await page.getByLabel('Email').fill('pickup@example.com');
  await page.getByRole('button', { name: /Continue to payment/ }).click();

  // 16.99 + 1.44 tax, no 3.99 fee.
  await expect(page.getByRole('button', { name: /^Pay \$18\.43$/ })).toBeVisible({
    timeout: 20_000,
  });
});
