import { expect, test } from '@playwright/test';
import type { APIRequestContext, Page, Route } from '@playwright/test';

/**
 * PIZZA-42 — paying with a saved card on the checkout's payment step.
 *
 * Two groups:
 *
 *  - STUBBED: the saved-card list is faked with page.route, so the chooser's rules (preselection,
 *    expired cards, guests) can be pinned exactly without touching Stripe. The order itself is real.
 *
 *  - LIVE: cards are saved through OUR API with Stripe's test tokens (pm_card_visa and friends),
 *    attached to the demo customer at Stripe, and paid with through the UI. Skipped when the
 *    backend has no Stripe key.
 *
 * Every card a test saves is deleted again in afterEach — which also detaches it at Stripe. The
 * orders cannot be removed: the API has no delete, and cancelling them would only change which
 * count they pollute. Each run leaves its orders behind, as every checkout spec does.
 */

const API = 'http://localhost:8085';
const CUSTOMER = { email: 'customer@pizza.test', password: 'pizza123' };

type SavedCard = {
  id: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  primary: boolean;
};

test.beforeAll(async ({ request }) => {
  const response = await request.get(`${API}/api/products`).catch(() => null);
  if (!response?.ok()) throw new Error(`The backend is not responding at ${API}.`);
});

// ------------------------------------------------------------------------------------- helpers

async function apiToken(request: APIRequestContext): Promise<string> {
  const response = await request.post(`${API}/api/auth/login`, { data: CUSTOMER });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).token;
}

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(CUSTOMER.email);
  await page.getByLabel('Password').fill(CUSTOMER.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: /Demo Customer/ })).toBeVisible();
}

/**
 * Adds a pizza, chooses pickup (so no address is needed), places the order and waits for the
 * payment step. Returns the order's id, read from the "Order … is reserved" line.
 */
async function reachPaymentStep(page: Page, guest = false): Promise<string> {
  await page.goto('/menu?type=PIZZA');
  await page
    .getByRole('heading', { name: 'Pepperoni Pizza', exact: true })
    .locator('xpath=ancestor::div[contains(@class,"product-card")]')
    .getByRole('button', { name: 'Build it' })
    .click();
  await page.getByRole('dialog').locator('label[for="size-LARGE"]').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Add to cart' }).click();
  await page.getByRole('button', { name: /Open cart/ }).click();
  await page.getByRole('button', { name: 'Checkout' }).click();
  await expect(page).toHaveURL(/\/checkout/);

  await page.getByRole('button', { name: /Pick up/ }).click();
  if (guest) {
    await page.getByLabel('Name').fill('Saved Card Guest');
    await page.getByLabel('Email').fill('saved-card-guest@example.com');
  }
  await page.getByRole('button', { name: /Continue to payment/ }).click();

  const reserved = page.getByText(/is reserved/);
  await expect(reserved).toBeVisible({ timeout: 15_000 });
  return (await reserved.locator('code').textContent())!.trim();
}

/** The radio group, found by its accessible name — which only exists if the legend names it. */
function chooser(page: Page) {
  return page.getByRole('group', { name: 'Pay with' });
}

/** The .form-check row holding one card's radio, so badges can be tied to the right card. */
function cardRow(page: Page, label: RegExp) {
  return chooser(page).locator('.form-check', { has: page.getByLabel(label) });
}

function stubCardList(page: Page, cards: SavedCard[], onRequest?: () => void) {
  return page.route('**/api/me/payment-methods', (route: Route) => {
    onRequest?.();
    return route.fulfill({ json: cards });
  });
}

const NEXT_YEAR = new Date().getFullYear() + 1;

// =============================================================================== stubbed list

test.describe('the saved-card chooser (stubbed card list)', () => {
  test('the PRIMARY card is preselected and named on the Pay button', async ({ page }) => {
    // The primary is deliberately NOT first, so "first card" and "primary card" disagree.
    await stubCardList(page, [
      { id: 'c0000000-0000-4000-8000-000000000001', brand: 'mastercard', last4: '4444', expMonth: 12, expYear: NEXT_YEAR, primary: false },
      { id: 'c0000000-0000-4000-8000-000000000002', brand: 'visa', last4: '4242', expMonth: 12, expYear: NEXT_YEAR, primary: true },
    ]);
    await signIn(page);
    await reachPaymentStep(page);

    await expect(chooser(page)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel(/Visa ••4242/)).toBeChecked();
    await expect(page.getByLabel(/Mastercard ••4444/)).not.toBeChecked();
    await expect(page.getByRole('button', { name: /^Pay \$\d+\.\d{2} with Visa ••4242$/ })).toBeVisible();
  });

  test('an expired card is shown, disabled and labelled Expired — and never preselected', async ({ page }) => {
    // The expired card is the PRIMARY, so a naive "preselect the primary" would pick it.
    await stubCardList(page, [
      { id: 'c0000000-0000-4000-8000-000000000003', brand: 'visa', last4: '1111', expMonth: 1, expYear: 2020, primary: true },
      { id: 'c0000000-0000-4000-8000-000000000004', brand: 'mastercard', last4: '4444', expMonth: 12, expYear: NEXT_YEAR, primary: false },
    ]);
    await signIn(page);
    await reachPaymentStep(page);

    const expired = page.getByLabel(/Visa ••1111/);
    await expect(expired).toBeVisible({ timeout: 20_000 });
    await expect(expired).toBeDisabled();
    await expect(expired).not.toBeChecked();
    await expect(cardRow(page, /Visa ••1111/)).toContainText('Expired');
    await expect(cardRow(page, /Mastercard ••4444/)).not.toContainText('Expired');

    // The next usable card is chosen instead.
    await expect(page.getByLabel(/Mastercard ••4444/)).toBeChecked();
    await expect(page.getByRole('button', { name: /with Mastercard ••4444$/ })).toBeVisible();
  });

  test('"Use a new card" swaps in the ordinary card form', async ({ page }) => {
    await stubCardList(page, [
      { id: 'c0000000-0000-4000-8000-000000000005', brand: 'visa', last4: '4242', expMonth: 12, expYear: NEXT_YEAR, primary: true },
    ]);
    await signIn(page);
    await reachPaymentStep(page);

    await expect(chooser(page)).toBeVisible({ timeout: 20_000 });
    await page.getByLabel('Use a new card').check();

    // The plain "Pay $X" button belongs to StripePaymentForm; the saved-card one says "with …".
    await expect(page.getByRole('button', { name: /^Pay \$\d+\.\d{2}$/ })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /with Visa/ })).toHaveCount(0);
  });

  test('a guest never sees the chooser — the card list is not even requested', async ({ page }) => {
    // Even if the endpoint WOULD answer with a card, a guest must not ask for one.
    let requested = false;
    await stubCardList(
      page,
      [{ id: 'c0000000-0000-4000-8000-000000000006', brand: 'visa', last4: '4242', expMonth: 12, expYear: NEXT_YEAR, primary: true }],
      () => {
        requested = true;
      },
    );
    await reachPaymentStep(page, true);

    await expect(page.getByRole('button', { name: /^Pay \$\d+\.\d{2}$/ })).toBeVisible({ timeout: 20_000 });
    await expect(chooser(page)).toHaveCount(0);
    expect(requested).toBe(false);
  });
});

// ================================================================================= live Stripe

test.describe('paying with a saved card (live Stripe test mode)', () => {
  let token = '';
  let stripeConfigured = false;
  const created: string[] = [];

  test.beforeAll(async ({ request }) => {
    token = await apiToken(request);
    // Opening a SetupIntent is the cheapest call that needs a Stripe key; it charges nothing and
    // stores nothing on our side.
    const probe = await request.post(`${API}/api/me/payment-methods/setup-intent`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    stripeConfigured = probe.ok();
  });

  test.beforeEach(() => {
    test.skip(!stripeConfigured, 'The backend has no Stripe key (pizza.stripe.secret-key).');
  });

  test.afterEach(async ({ request }) => {
    // Deleting through our API also detaches the card at Stripe.
    while (created.length > 0) {
      const id = created.pop()!;
      const response = await request.delete(`${API}/api/me/payment-methods/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.status(), `could not delete test card ${id}`).toBe(204);
    }
  });

  /** Saves a Stripe test card through OUR API and remembers it for cleanup. */
  async function saveCard(request: APIRequestContext, stripeTestToken: string): Promise<SavedCard> {
    const response = await request.post(`${API}/api/me/payment-methods`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { stripePaymentMethodId: stripeTestToken },
    });
    expect(response.status(), await response.text()).toBe(201);
    const card: SavedCard = await response.json();
    created.push(card.id);
    return card;
  }

  async function serverView(request: APIRequestContext, orderId: string) {
    // payment-status asks Stripe and reads the order back from OUR database.
    return (await request.get(`${API}/api/orders/${orderId}/payment-status`)).json();
  }

  test('a saved card pays the order, and the order is PAID with that card', async ({ page, request }) => {
    test.setTimeout(90_000);
    await saveCard(request, 'pm_card_visa');
    await signIn(page);
    const orderId = await reachPaymentStep(page);

    // Chosen explicitly: a card left over from manual testing may be the primary.
    await page.getByLabel(/Visa ••4242/).check({ timeout: 20_000 });
    await page.getByRole('button', { name: /^Pay \$\d+\.\d{2} with Visa ••4242$/ }).click();

    await expect(page).toHaveURL(new RegExp(`/order-confirmation/${orderId}$`), { timeout: 30_000 });
    await expect(page.getByText('PAID', { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('strong', { hasText: '4242' })).toBeVisible();

    const order = await serverView(request, orderId);
    expect(order.status).toBe('PAID');
    expect(order.cardBrand).toBe('visa');
    expect(order.cardLast4).toBe('4242');
  });

  test('a declined saved card shows the decline, and another saved card pays the SAME order', async ({ page, request }) => {
    test.setTimeout(90_000);
    // Attaching succeeds; charging is declined. Stripe's test card 4000 0000 0000 0341.
    await saveCard(request, 'pm_card_chargeCustomerFail');
    await saveCard(request, 'pm_card_visa');
    await signIn(page);
    const orderId = await reachPaymentStep(page);

    await page.getByLabel(/Visa ••0341/).check({ timeout: 20_000 });
    await page.getByRole('button', { name: /with Visa ••0341$/ }).click();

    await expect(page.locator('.alert-danger')).toContainText(/declined/i, { timeout: 30_000 });
    await expect(page).toHaveURL(/\/checkout$/);
    expect((await serverView(request, orderId)).status).toBe('PENDING_PAYMENT');

    await page.getByLabel(/Visa ••4242/).check();
    await page.getByRole('button', { name: /with Visa ••4242$/ }).click();

    await expect(page).toHaveURL(new RegExp(`/order-confirmation/${orderId}$`), { timeout: 30_000 });
    const order = await serverView(request, orderId);
    expect(order.status).toBe('PAID');
    // 4242, not 0341: the SECOND card paid, on the first order.
    expect(order.cardLast4).toBe('4242');
  });

  test('a card that needs 3D Secure shows the challenge, and completing it pays the order', async ({ page, request }) => {
    test.setTimeout(90_000);
    // Stripe's test card 4000 0027 6000 3184: every payment requires authentication.
    await saveCard(request, 'pm_card_authenticationRequired');
    await signIn(page);
    const orderId = await reachPaymentStep(page);

    await page.getByLabel(/Visa ••3184/).check({ timeout: 20_000 });
    await page.getByRole('button', { name: /with Visa ••3184$/ }).click();

    // The challenge must actually appear: Stripe's test ACS page, in a nested frame.
    const challengeFrame = () => page.frames().find((f) => f.url().includes('3d_secure_2_test'));
    await expect
      .poll(() => Boolean(challengeFrame()), {
        timeout: 30_000,
        message: 'the 3D Secure challenge never appeared',
      })
      .toBe(true);

    // Then complete it. The "Complete" button is in the DOM before Stripe's test page has wired it
    // up, so an early click is silently ignored — retry until the page moves on.
    const confirmation = new RegExp(`/order-confirmation/${orderId}$`);
    await expect(async () => {
      if (!confirmation.test(page.url())) {
        await challengeFrame()
          ?.getByRole('button', { name: /complete/i })
          .first()
          .click({ timeout: 5_000 })
          .catch(() => {});
      }
      expect(page.url()).toMatch(confirmation);
    }).toPass({ timeout: 60_000, intervals: [2_000, 3_000, 5_000] });
    const order = await serverView(request, orderId);
    expect(order.status).toBe('PAID');
    expect(order.cardLast4).toBe('3184');
  });
});
