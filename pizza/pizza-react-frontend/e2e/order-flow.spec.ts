import { expect, test } from '@playwright/test';

/**
 * End-to-end walkthrough against the REAL backend.
 *
 * Requires the API on http://localhost:8085:
 *   cd pizza-springboot-backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=local
 *
 * Unlike the Phase 2 version, nothing here is mocked — these exercise the actual HTTP calls,
 * server-side pricing, and JWT auth.
 */

const API = 'http://localhost:8085';

/** Fails fast with a useful message rather than a wall of confusing UI timeouts. */
test.beforeAll(async ({ request }) => {
  const response = await request.get(`${API}/api/products`).catch(() => null);
  if (!response?.ok()) {
    throw new Error(
      `The backend is not responding at ${API}. Start it with:\n` +
        `  cd pizza-springboot-backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=local`,
    );
  }
});

test('home page renders the hero and featured pizzas from the API', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /No One OutPizzas the Hub/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Popular right now' })).toBeVisible();
  // Rendered only after the menu request resolves.
  await expect(page.getByRole('heading', { name: 'Pepperoni Pizza' })).toBeVisible();
});

test('menu lists all 14 seeded products and filters by type', async ({ page }) => {
  await page.goto('/menu');

  // 8 pizzas + 6 drinks, straight from the database.
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(14);

  await page.getByRole('link', { name: 'Pizzas' }).click();
  await expect(page).toHaveURL(/type=PIZZA/);
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(8);

  await page.getByRole('link', { name: 'Drinks' }).click();
  await expect(page).toHaveURL(/type=DRINK/);
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(6);
});

test('the API returns UUIDs, not sequential ids', async ({ request }) => {
  const products = await (await request.get(`${API}/api/products`)).json();
  expect(products.length).toBe(14);
  for (const product of products) {
    expect(product.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  }
});

test('builder updates the price live as toppings and size change', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');

  await page
    .getByRole('heading', { name: 'Pepperoni Pizza' })
    .locator('xpath=ancestor::div[contains(@class,"product-card")]')
    .getByRole('button', { name: 'Build it' })
    .click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Medium is the default: $13.99.
  await expect(dialog.getByText('$13.99', { exact: true }).first()).toBeVisible();

  // Large -> $16.99. ToggleButton renders a hidden radio plus a label; the label is clickable.
  await dialog.locator('label[for="size-LARGE"]').click();
  await expect(dialog.getByText('$16.99', { exact: true }).first()).toBeVisible();

  // Add bacon (+$1.75) -> $18.74.
  await dialog.getByRole('button', { name: /Bacon/ }).click();
  await expect(dialog.getByText('$18.74').first()).toBeVisible();

  // Stuffed crust (+$2.50) -> $21.24.
  await dialog.getByText('Stuffed Crust').click();
  await expect(dialog.getByText('$21.24').first()).toBeVisible();
});

test('adding to the cart updates the navbar badge and the drawer', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');

  await page.getByRole('button', { name: 'Build it' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Add to cart' }).click();

  // The badge lives in the navbar — a component nowhere near the menu page in the tree.
  // This is the cart Context doing its job.
  const cartButton = page.getByRole('button', { name: /Open cart/ });
  await expect(cartButton).toContainText('1');

  await cartButton.click();
  const drawer = page.getByRole('dialog').filter({ hasText: 'Your order' });
  await expect(drawer.getByText('Pepperoni Pizza')).toBeVisible();
});

test('quantity controls and removal work', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await page.getByRole('button', { name: 'Build it' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Add to cart' }).click();

  const cartButton = page.getByRole('button', { name: /Open cart/ });
  await cartButton.click();

  const drawer = page.getByRole('dialog').filter({ hasText: 'Your order' });
  await drawer.getByRole('button', { name: /Increase quantity/ }).click();
  await expect(cartButton).toContainText('2');

  await drawer.getByRole('button', { name: 'Remove' }).click();
  await expect(drawer.getByText('Your cart is empty.')).toBeVisible();
});

test('a guest can create a real order, priced by the server', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');

  // Large Pepperoni = 16.99. Delivery adds 3.99; tax is 8.5% => total 22.42.
  await page
    .getByRole('heading', { name: 'Pepperoni Pizza' })
    .locator('xpath=ancestor::div[contains(@class,"product-card")]')
    .getByRole('button', { name: 'Build it' })
    .click();
  await page.getByRole('dialog').locator('label[for="size-LARGE"]').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Add to cart' }).click();

  await page.getByRole('button', { name: /Open cart/ }).click();
  await page.getByRole('button', { name: 'Checkout' }).click();

  await expect(page).toHaveURL(/\/checkout/);
  // The guest notice proves no login was required to get here.
  await expect(page.getByText(/Checking out as a guest/)).toBeVisible();

  await page.getByLabel('Name').fill('Guest Tester');
  await page.getByLabel('Email').fill('guest@example.com');
  await page.getByLabel('Street address').fill('123 Test St');
  await page.getByLabel('City').fill('Salt Lake City');
  await page.getByLabel('State').fill('UT');
  await page.getByLabel('ZIP').fill('84101');

  await page.getByRole('button', { name: /Continue to payment/ }).click();

  // The order now exists server-side and the summary shows the SERVER's figures.
  await expect(page.getByText(/is reserved/)).toBeVisible({ timeout: 15_000 });
  // exact:true and .last() disambiguate the summary total from the 'Pay $22.42' button —
  // both legitimately show the same figure.
  await expect(page.getByText('$22.42', { exact: true }).last()).toBeVisible();
  // Stripe Elements mounts once the clientSecret arrives.
  await expect(page.getByRole('button', { name: /^Pay \$22\.42$/ })).toBeVisible({
    timeout: 20_000,
  });
});

test('the server ignores prices sent by the client', async ({ request }) => {
  const products = await (await request.get(`${API}/api/products?type=PIZZA`)).json();
  const pepperoni = products.find((p: { name: string }) => p.name === 'Pepperoni Pizza');

  const response = await request.post(`${API}/api/orders`, {
    data: {
      orderType: 'CARRYOUT',
      customerName: 'Cheapskate',
      guestEmail: 'cheap@example.com',
      subtotal: 0.01,
      total: 0.01,
      items: [
        { productId: pepperoni.id, size: 'LARGE', quantity: 1, unitPrice: 0.01, lineTotal: 0.01 },
      ],
    },
  });

  expect(response.status()).toBe(201);
  const body = await response.json();
  // Claimed 0.01; charged the real price.
  expect(body.order.subtotal).toBe(16.99);
  expect(body.order.total).toBe(18.43);
});

test('admin route is guarded, and reachable after signing in as an admin', async ({ page }) => {
  // Not signed in: bounced to the login page.
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel('Email').fill('admin@pizza.test');
  await page.getByLabel('Password').fill('admin123');
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Redirected back to where we were originally headed, and the real report loads.
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByRole('heading', { name: 'Admin', exact: true })).toBeVisible();
  await expect(page.getByText('Orders (30d)')).toBeVisible();
  await expect(page.getByText(/Menu · \d+ products/)).toBeVisible();
});

test('a non-admin cannot reach the admin dashboard', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('customer@pizza.test');
  await page.getByLabel('Password').fill('pizza123');
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Wait for the sign-in to actually complete before navigating.
  await expect(page.getByRole('button', { name: /Demo Customer/ })).toBeVisible();

  await page.goto('/admin');
  // requireAdmin sends a signed-in non-admin back to the home page.
  await expect(page).toHaveURL('http://localhost:5173/');
});

test('a signed-in customer sees their real order history', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('customer@pizza.test');
  await page.getByLabel('Password').fill('pizza123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: /Demo Customer/ })).toBeVisible();

  await page.goto('/orders');
  await expect(page.getByRole('heading', { name: 'My orders' })).toBeVisible();
  // The seed gives this account several orders.
  await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 10_000 });
});

test('bad credentials show an error from the API', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('customer@pizza.test');
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText('Invalid email or password')).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});
