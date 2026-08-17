import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Cart mechanics, all driven through the UI. */

test.beforeAll(async ({ request }) => {
  const response = await request.get('http://localhost:8085/api/products').catch(() => null);
  if (!response?.ok()) throw new Error('The backend is not responding at http://localhost:8085.');
});

/** Build a pizza through the modal and add it to the cart. */
async function addPizza(
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

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  if (options.size) await dialog.locator(`label[for="size-${options.size}"]`).click();
  for (const topping of options.toppings ?? []) {
    await dialog.getByRole('button', { name: new RegExp(topping) }).click();
  }
  if (options.quantity) await dialog.getByLabel('Quantity').selectOption(options.quantity);

  await dialog.getByRole('button', { name: /Add to cart/ }).click();
  await expect(dialog).toBeHidden();
}

function cartButton(page: Page) {
  return page.getByRole('button', { name: /Open cart/ });
}

function drawer(page: Page) {
  return page.getByRole('dialog').filter({ hasText: 'Your order' });
}

test('adding an item updates the navbar badge — the cart Context in action', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await expect(cartButton(page)).not.toContainText('1');

  await addPizza(page, 'Pepperoni Pizza');

  // The badge lives in the navbar, nowhere near the menu page in the component tree.
  await expect(cartButton(page)).toContainText('1');
});

test('adding an item shows a toast — the createPortal example', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await addPizza(page, 'Pepperoni Pizza');

  // Rendered into document.body via a portal, not inside the menu page's DOM.
  await expect(page.getByText(/1 × Pepperoni Pizza added to your cart/)).toBeVisible();
});

test('the drawer lists the configured item with its options and price', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await addPizza(page, 'Pepperoni Pizza', { size: 'LARGE', toppings: ['Bacon', 'Extra Cheese'] });

  await cartButton(page).click();
  const cart = drawer(page);

  await expect(cart.getByText('Pepperoni Pizza')).toBeVisible();
  await expect(cart.getByText(/Large · Original Pan/)).toBeVisible();
  await expect(cart.getByText('Bacon', { exact: true })).toBeVisible();
  await expect(cart.getByText('Extra Cheese', { exact: true })).toBeVisible();
  // 16.99 + 1.75 + 1.75
  await expect(cart.getByText('$20.49 each')).toBeVisible();
});

test('delivery adds a fee; carryout does not', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await addPizza(page, 'Cheese Pizza', { size: 'LARGE' }); // 15.49

  await cartButton(page).click();
  const cart = drawer(page);

  // Delivery is the default, so the fee row is present.
  await expect(cart.getByRole('button', { name: 'Delivery' })).toBeVisible();
  await expect(cart.getByText('$3.99', { exact: true })).toBeVisible();

  await cart.getByRole('button', { name: 'Carryout' }).click();
  // The fee row disappears entirely rather than showing $0.00.
  await expect(cart.getByText('$3.99', { exact: true })).toBeHidden();
});

test('quantity controls change the badge and the line total', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await addPizza(page, 'Cheese Pizza', { size: 'SMALL' }); // 9.99

  await cartButton(page).click();
  const cart = drawer(page);

  await cart.getByRole('button', { name: /Increase quantity/ }).click();
  await expect(cartButton(page)).toContainText('2');
  // 9.99 x 2. It appears twice — as the line total AND the subtotal — which is correct.
  await expect(cart.getByText('$19.98', { exact: true })).toHaveCount(2);

  await cart.getByRole('button', { name: /Decrease quantity/ }).click();
  await expect(cartButton(page)).toContainText('1');
});

test('decrementing to zero removes the line', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await addPizza(page, 'Cheese Pizza');

  await cartButton(page).click();
  const cart = drawer(page);

  await cart.getByRole('button', { name: /Decrease quantity/ }).click();
  await expect(cart.getByText('Your cart is empty.')).toBeVisible();
});

test('Remove empties the cart', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await addPizza(page, 'Cheese Pizza');

  await cartButton(page).click();
  await drawer(page).getByRole('button', { name: 'Remove' }).click();

  await expect(drawer(page).getByText('Your cart is empty.')).toBeVisible();
});

test('the same pizza configured identically merges into one line', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await addPizza(page, 'Pepperoni Pizza', { size: 'LARGE' });
  await addPizza(page, 'Pepperoni Pizza', { size: 'LARGE' });

  await expect(cartButton(page)).toContainText('2');

  await cartButton(page).click();
  // One line, quantity 2 — not two lines.
  await expect(drawer(page).getByText('Pepperoni Pizza')).toHaveCount(1);
});

test('the same pizza with different toppings stays two separate lines', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await addPizza(page, 'Pepperoni Pizza', { size: 'LARGE' });
  await addPizza(page, 'Pepperoni Pizza', { size: 'LARGE', toppings: ['Bacon'] });

  await expect(cartButton(page)).toContainText('2');

  await cartButton(page).click();
  // Two distinct configurations must not be merged — the customer would be charged wrongly.
  await expect(drawer(page).getByText('Pepperoni Pizza')).toHaveCount(2);
  await expect(drawer(page).getByText('Bacon', { exact: true })).toBeVisible();
});

test('a pizza and a drink can share a cart, and the totals add up', async ({ page }) => {
  await page.goto('/menu');
  await addPizza(page, 'Cheese Pizza', { size: 'LARGE' }); // 15.49
  await addPizza(page, 'Pepsi', { size: 'LARGE' }); //  2.99

  await expect(cartButton(page)).toContainText('2');

  await cartButton(page).click();
  const cart = drawer(page);
  // 18.48 subtotal, 8.5% tax = 1.57, delivery 3.99 -> 24.04
  await expect(cart.getByText('$18.48', { exact: true }).first()).toBeVisible();
  await expect(cart.getByText('$1.57', { exact: true })).toBeVisible();
  await expect(cart.getByText('$24.04', { exact: true })).toBeVisible();
});

test('the drawer closes and reopens with its contents intact', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await addPizza(page, 'Pepperoni Pizza');

  await cartButton(page).click();
  await expect(drawer(page)).toBeVisible();

  await drawer(page).getByRole('button', { name: 'Close' }).click();
  await expect(drawer(page)).toBeHidden();

  await cartButton(page).click();
  await expect(drawer(page).getByText('Pepperoni Pizza')).toBeVisible();
});

test('the cart survives a page refresh — it is saved in the backend', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await addPizza(page, 'Pepperoni Pizza', { size: 'LARGE', toppings: ['Bacon'] });
  await expect(cartButton(page)).toContainText('1');

  // Wait for the debounced PUT to land before reloading, otherwise we would be testing a race.
  await page.waitForResponse(
    (r) => r.url().includes('/api/carts/') && r.request().method() === 'PUT' && r.ok(),
  );

  await page.reload();

  // Rehydrated from the API, not from React state — which the reload destroyed.
  await expect(cartButton(page)).toContainText('1');
  await cartButton(page).click();
  const cart = drawer(page);
  await expect(cart.getByText('Pepperoni Pizza')).toBeVisible();
  await expect(cart.getByText(/Large/)).toBeVisible();
  await expect(cart.getByText('Bacon', { exact: true })).toBeVisible();
  // 16.99 + 1.75
  await expect(cart.getByText('$18.74 each')).toBeVisible();
});

test('the delivery/carryout choice is saved too', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await addPizza(page, 'Cheese Pizza', { size: 'LARGE' });

  await cartButton(page).click();
  await drawer(page).getByRole('button', { name: 'Carryout' }).click();
  await page.waitForResponse(
    (r) => r.url().includes('/api/carts/') && r.request().method() === 'PUT' && r.ok(),
  );

  await page.reload();
  await cartButton(page).click();

  // Carryout means no delivery fee, and the choice itself persisted.
  await expect(drawer(page).getByText('$3.99', { exact: true })).toBeHidden();
});

test('quantity changes are saved', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await addPizza(page, 'Cheese Pizza', { size: 'SMALL' });

  await cartButton(page).click();
  await drawer(page).getByRole('button', { name: /Increase quantity/ }).click();
  await drawer(page).getByRole('button', { name: /Increase quantity/ }).click();
  await page.waitForResponse(
    (r) => r.url().includes('/api/carts/') && r.request().method() === 'PUT' && r.ok(),
  );

  await page.reload();
  await expect(cartButton(page)).toContainText('3');
});

test('emptying the cart is saved, so a refresh does not resurrect it', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await addPizza(page, 'Cheese Pizza');
  await page.waitForResponse(
    (r) => r.url().includes('/api/carts/') && r.request().method() === 'PUT' && r.ok(),
  );

  await cartButton(page).click();
  await drawer(page).getByRole('button', { name: 'Remove' }).click();
  await page.waitForResponse(
    (r) => r.url().includes('/api/carts/') && r.request().method() === 'PUT' && r.ok(),
  );

  await page.reload();
  await expect(cartButton(page)).not.toContainText('1');
});

test('a second tab sees the same saved cart', async ({ page, context }) => {
  await page.goto('/menu?type=PIZZA');
  await addPizza(page, 'Supreme Pizza', { size: 'MEDIUM' });
  await page.waitForResponse(
    (r) => r.url().includes('/api/carts/') && r.request().method() === 'PUT' && r.ok(),
  );

  // A new tab in the same browser context shares localStorage, so it finds the same cart UUID
  // and loads the same basket from the API.
  const second = await context.newPage();
  await second.goto('/menu');
  await expect(second.getByRole('button', { name: /Open cart/ })).toContainText('1');
  await second.getByRole('button', { name: /Open cart/ }).click();
  await expect(
    second.getByRole('dialog').filter({ hasText: 'Your order' }).getByText('Supreme Pizza'),
  ).toBeVisible();
  await second.close();
});

test('a stale cart id is discarded rather than breaking the page', async ({ page }) => {
  // Point the browser at a cart that does not exist.
  await page.goto('/menu');
  await page.evaluate(() =>
    localStorage.setItem('pizza.cartId', '00000000-0000-4000-8000-000000000000'),
  );

  // Wait for the failed lookup itself, not just for the page to look idle — otherwise we would
  // read localStorage before the catch block has had a chance to clear it.
  const staleLookup = page.waitForResponse(
    (r) => r.url().includes('/api/carts/00000000-0000-4000-8000-000000000000'),
  );
  await page.reload();
  const response = await staleLookup;
  expect(response.status()).toBe(404);

  // The app recovers: empty cart, no error screen, and the bad id is forgotten.
  await expect(page.getByRole('button', { name: /Open cart/ })).not.toContainText('1');
  await expect(page.getByRole('heading', { name: 'Menu', exact: true })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('pizza.cartId')))
    .toBeNull();
});
