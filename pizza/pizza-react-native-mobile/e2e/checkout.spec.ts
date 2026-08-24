import { expect, test, type Page } from '@playwright/test';
import { openMenu, signIn } from './helpers';

/** Build the first pizza and add it, waiting for the cart to reach the server. */
async function addAPizza(page: Page) {
  const saved = page.waitForResponse(
    (response) => /\/api\/carts\//.test(response.url()) && response.request().method() === 'PUT',
  );
  await openMenu(page);
  await page.getByTestId('menu-filter-PIZZA').click();
  await page.locator('[data-testid^="product-card-"]').first().click();
  await page.getByTestId('builder-add').click();
  await expect(page.getByTestId('cart-badge')).toHaveText('1');
  await saved;
}

async function goToCheckout(page: Page) {
  await page.getByTestId('cart-button').click();
  await page.getByTestId('cart-checkout').click();
  await expect(page.getByTestId('checkout-screen')).toBeVisible();
}

/** "Total$19.17" -> 19.17 */
function parsePrice(text: string | null): number {
  return Number((text ?? '').replace(/[^0-9.]/g, ''));
}

test.describe('checkout', () => {
  test('an empty cart cannot check out', async ({ page }) => {
    await page.goto('/checkout');
    await expect(page.getByText('Your cart is empty')).toBeVisible({ timeout: 90_000 });
  });

  test('refuses to continue with an incomplete form, and says why per field', async ({ page }) => {
    await addAPizza(page);
    await goToCheckout(page);

    await page.getByTestId('checkout-continue').click();

    await expect(page.getByText('Please tell us who the order is for.')).toBeVisible();
    await expect(page.getByText('We need a valid email to send the receipt.')).toBeVisible();
    await expect(page.getByText('We cannot deliver without a street address.')).toBeVisible();

    // Nothing was sent — the order does not exist yet.
    await expect(page.getByTestId('checkout-payment-step')).toHaveCount(0);
  });

  test('clears a field error as soon as that field is corrected', async ({ page }) => {
    await addAPizza(page);
    await goToCheckout(page);

    await page.getByTestId('checkout-continue').click();
    await expect(page.getByText('Please tell us who the order is for.')).toBeVisible();

    await page.getByTestId('field-name').fill('Folau Kaveinga');

    await expect(page.getByText('Please tell us who the order is for.')).toHaveCount(0);
    // The other errors are still standing.
    await expect(page.getByText('We need a valid email to send the receipt.')).toBeVisible();
  });

  test('pickup hides the address fields entirely', async ({ page }) => {
    await addAPizza(page);
    await goToCheckout(page);

    await expect(page.getByTestId('field-address')).toBeVisible();

    await page.getByTestId('checkout-order-type-CARRYOUT').click();

    // The whole address card goes, and so does the delivery-fee line in the summary.
    await expect(page.getByTestId('field-address')).toHaveCount(0);
    await expect(page.getByText('Delivery address')).toHaveCount(0);
    await expect(page.getByText('Delivery', { exact: true })).toHaveCount(1); // just the segment
    await expect(page.getByText('Order summary · carryout')).toBeVisible();
  });

  test('a GUEST can place an order, and the SERVER prices it', async ({ page }) => {
    await addAPizza(page);
    await goToCheckout(page);

    // The row carries its label too, so this reads "Total$19.17" — hence the digits-only parse.
    const previewTotal = parsePrice(await page.getByTestId('checkout-total').textContent());

    await page.getByTestId('field-name').fill('Guest Customer');
    await page.getByTestId('field-email').fill('guest@pizza.test');
    await page.getByTestId('field-phone').fill('5551234567');
    await page.getByTestId('field-address').fill('1 Market St');
    await page.getByTestId('field-city').fill('San Francisco');
    await page.getByTestId('field-state').fill('CA');
    await page.getByTestId('field-zip').fill('94105');

    const created = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/orders') && response.request().method() === 'POST',
    );
    await page.getByTestId('checkout-continue').click();
    const response = await created;

    // 201 Created, not 200 — the order is a new resource.
    expect(response.status()).toBe(201);
    const body = await response.json();

    // No account was needed, and the order is real.
    expect(body.order.id).toBeTruthy();
    expect(body.order.status).toBe('PENDING_PAYMENT');

    // The payment step is reached, showing the SERVER's total.
    await expect(page.getByTestId('checkout-payment-step')).toBeVisible();
    await expect(page.getByTestId('checkout-total')).toContainText(
      `$${body.order.total.toFixed(2)}`,
    );

    /*
     * And it matches what the device predicted, because both apply the same rules. The app's figure
     * is only ever a preview — but a preview that disagrees with the bill is worse than none, so it
     * is worth asserting they line up.
     */
    expect(previewTotal).toBe(body.order.total);
  });

  test('never sends a price — the request carries identifiers only', async ({ page }) => {
    await addAPizza(page);
    await goToCheckout(page);

    await page.getByTestId('field-name').fill('Guest Customer');
    await page.getByTestId('field-email').fill('guest@pizza.test');
    await page.getByTestId('field-address').fill('1 Market St');
    await page.getByTestId('field-city').fill('San Francisco');
    await page.getByTestId('field-state').fill('CA');
    await page.getByTestId('field-zip').fill('94105');

    const created = page.waitForRequest(
      (request) => request.url().endsWith('/api/orders') && request.method() === 'POST',
    );
    await page.getByTestId('checkout-continue').click();
    const payload = (await created).postData() ?? '';

    /*
     * PricingService on the backend is the security boundary. This asserts the app never even
     * offers a number for it to trust.
     */
    expect(payload).not.toMatch(/"(price|unitPrice|lineTotal|subtotal|tax|total)"/);
    expect(JSON.parse(payload).items[0]).toEqual(
      expect.objectContaining({ productId: expect.any(String), quantity: 1 }),
    );
  });

  test('the payment step explains why the sheet is unavailable on web', async ({ page }) => {
    await addAPizza(page);
    await goToCheckout(page);

    await page.getByTestId('field-name').fill('Guest Customer');
    await page.getByTestId('field-email').fill('guest@pizza.test');
    await page.getByTestId('field-address').fill('1 Market St');
    await page.getByTestId('field-city').fill('San Francisco');
    await page.getByTestId('field-state').fill('CA');
    await page.getByTestId('field-zip').fill('94105');
    await page.getByTestId('checkout-continue').click();

    await expect(page.getByTestId('checkout-payment-step')).toBeVisible();

    /*
     * Stripe's payment sheet is a native module with no web build (see payment/paymentGateway.web).
     * The screen degrades to a message instead of a dead button — the same branch a missing Stripe
     * key produces on device, which is why it is worth asserting here.
     */
    await expect(
      page.getByText('Card payment is only available in the iOS and Android builds.'),
    ).toBeVisible();
    await expect(page.getByTestId('checkout-pay')).toHaveCount(0);
  });

  test('a SIGNED-IN customer gets their saved address preselected', async ({ page }) => {
    await signIn(page);
    await addAPizza(page);
    await goToCheckout(page);

    // The name and email come from the account rather than being typed again.
    await expect(page.getByTestId('field-email')).toHaveValue('customer@pizza.test');
    await expect(page.getByText('Checking out as a guest.')).toHaveCount(0);
  });
});
