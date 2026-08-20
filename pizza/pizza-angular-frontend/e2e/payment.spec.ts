import { expect, test } from '@playwright/test';
import { API, addProduct, openCart } from './helpers';

/**
 * The full payment path: order created → Stripe charged → our order becomes PAID.
 *
 * <p>WHY THIS IS NOT A BROWSER TEST. Stripe's payment element renders the card fields inside its
 * own iframes and runs bot detection (hCaptcha) on them. Under headless automation the card inputs
 * simply never mount — the page gets stuck on Stripe's loader frame. Retrying that would produce a
 * slow, flaky test that fails for reasons unrelated to our code.
 *
 * <p>So the card WIDGET is verified through the UI below (the element mounts and the Pay button
 * carries the server's total), and the payment INTEGRATION is verified by driving Stripe's API
 * directly with a test payment method. Between them, everything we own is covered.
 *
 * <p>Run the integration half with:
 *   STRIPE_SECRET_KEY=sk_test_… npx playwright test e2e/payment.spec.ts
 */

const STRIPE_SECRET_KEY = process.env['STRIPE_SECRET_KEY'];

test('the card element mounts and the Pay button shows the SERVER total', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());

  await page.goto('/menu?type=PIZZA');
  await addProduct(page, 'Pepperoni Pizza', { size: 'LARGE' });

  const cart = await openCart(page);
  await cart.getByRole('button', { name: 'Carryout' }).click();
  await cart.getByRole('button', { name: 'Checkout' }).click();

  await page.getByLabel('Name').fill('Payment Tester');
  await page.getByLabel('Email').fill('payment@example.com');

  // Body read as it arrives — see the note in checkout.spec.ts.
  const created = page
    .waitForResponse((r) => r.url().endsWith('/api/orders') && r.request().method() === 'POST')
    .then((r) => r.json());

  await page.getByRole('button', { name: 'Continue to payment' }).click();
  const { order } = await created;

  // Stripe's iframe really mounted — this is the part with no @stripe/react-stripe-js to do it.
  await expect(page.frameLocator('iframe[name^="__privateStripeFrame"]').first().locator('body')).toBeAttached();

  // And the button quotes the server's figure, not the browser's preview.
  await expect(page.getByRole('button', { name: new RegExp(`Pay \\$${order.total.toFixed(2)}`) })).toBeVisible();
});

test.describe('payment integration', () => {
  test.skip(
    !STRIPE_SECRET_KEY,
    'Set STRIPE_SECRET_KEY (the same sk_test_… the backend uses) to run this.',
  );

  test('an order becomes PAID once Stripe confirms the PaymentIntent', async ({ request }) => {
    test.setTimeout(60_000);

    // ---- 1. place an order through our own API -------------------------------------------
    const products = await (await request.get(`${API}/api/products?type=PIZZA`)).json();
    const pepperoni = products.find((p: { name: string }) => p.name === 'Pepperoni Pizza');

    const createResponse = await request.post(`${API}/api/orders`, {
      data: {
        orderType: 'CARRYOUT',
        customerName: 'Payment Tester',
        guestEmail: 'payment@example.com',
        items: [{ productId: pepperoni.id, size: 'LARGE', quantity: 1 }],
      },
    });
    expect(createResponse.status()).toBe(201);

    const created = await createResponse.json();
    expect(created.order.status).toBe('PENDING_PAYMENT');
    expect(created.clientSecret).toBeTruthy();

    const orderId: string = created.order.id;
    // "pi_xxx_secret_yyy" -> "pi_xxx"
    const paymentIntentId = created.clientSecret.split('_secret_')[0];

    // ---- 2. confirm the payment with Stripe's standard test card -------------------------
    const confirm = await request.post(
      `https://api.stripe.com/v1/payment_intents/${paymentIntentId}/confirm`,
      {
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        form: { payment_method: 'pm_card_visa', return_url: 'http://localhost:4200/checkout' },
      },
    );
    expect(confirm.ok()).toBeTruthy();

    const intent = await confirm.json();
    expect(intent.status).toBe('succeeded');
    // Stripe works in cents. 18.43 -> 1843; a dollars/cents mix-up would show up right here.
    expect(intent.amount).toBe(1843);

    // ---- 3. our API must now report PAID -------------------------------------------------
    // This is exactly what the confirmation page polls. The status comes from the server
    // re-checking Stripe — the browser never asserts that it paid.
    const statusResponse = await request.get(`${API}/api/orders/${orderId}/payment-status`);
    expect(statusResponse.ok()).toBeTruthy();

    const order = await statusResponse.json();
    expect(order.status).toBe('PAID');
    expect(order.total).toBe(18.43);
  });
});
