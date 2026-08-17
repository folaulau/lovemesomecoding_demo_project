import { expect, test } from '@playwright/test';

/**
 * The full payment path: order created → Stripe charged → our order becomes PAID.
 *
 * WHY THIS IS NOT A BROWSER TEST.
 * Stripe's PaymentElement renders the card fields inside its own iframes and runs bot detection
 * (hCaptcha) on them. Under headless automation the card inputs simply never mount — the page gets
 * stuck on Stripe's loader frame. Retrying that would produce a slow, flaky test that fails for
 * reasons unrelated to our code.
 *
 * So the card WIDGET is verified in order-flow.spec.ts (Elements mounts, and the Pay button shows
 * the server-calculated total), and the payment INTEGRATION is verified here by driving Stripe's
 * API directly with a test payment method. Between them, everything we own is covered.
 *
 * Run with:
 *   STRIPE_SECRET_KEY=sk_test_... npx playwright test e2e/payment.spec.ts
 */

const API = 'http://localhost:8085';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

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
        form: {
          payment_method: 'pm_card_visa',
          return_url: 'http://localhost:5173/checkout',
        },
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
