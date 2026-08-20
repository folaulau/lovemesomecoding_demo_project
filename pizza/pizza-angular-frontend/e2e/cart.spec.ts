import { expect, test } from '@playwright/test';
import { addProduct, cartButton, drawer, openCart, requireBackend } from './helpers';

/** Cart mechanics, all driven through the UI. */

test.beforeAll(async ({ request }) => requireBackend(request));

// Every test starts from an empty basket — otherwise a leftover cart id makes counts unreadable.
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('adding an item updates the navbar badge — the shared service in action', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await expect(cartButton(page)).not.toContainText('1');

  await addProduct(page, 'Pepperoni Pizza');

  // The badge lives in the navbar, nowhere near the menu page in the component tree. No input,
  // no output, no prop drilling — both read the same root singleton.
  await expect(cartButton(page)).toContainText('1');
});

test('adding an item shows a toast', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await addProduct(page, 'Pepperoni Pizza');

  await expect(page.getByText('1 × Pepperoni Pizza added to your cart')).toBeVisible();
});

test('the drawer lists the line with its size, crust and toppings', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await addProduct(page, 'Pepperoni Pizza', { size: 'LARGE', toppings: ['Extra Cheese'] });

  const cart = await openCart(page);
  await expect(cart.getByText('Pepperoni Pizza')).toBeVisible();
  await expect(cart.getByText(/Large/)).toBeVisible();
  await expect(cart.getByText('Extra Cheese')).toBeVisible();
});

test('quantity buttons change the line total', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await addProduct(page, 'Pepperoni Pizza', { size: 'MEDIUM' });

  const cart = await openCart(page);
  await cart.getByRole('button', { name: /Increase quantity/ }).click();

  await expect(cartButton(page)).toContainText('2');
  // 2 × $13.99. `.first()` because the same figure is also the subtotal — with one line in the
  // cart the line total and the subtotal are necessarily equal.
  await expect(cart.getByText('$27.98').first()).toBeVisible();
});

test('decrementing to zero removes the line', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await addProduct(page, 'Pepperoni Pizza');

  const cart = await openCart(page);
  await cart.getByRole('button', { name: /Decrease quantity/ }).click();

  await expect(cart.getByText('Your cart is empty.')).toBeVisible();
});

test('Remove empties the line', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await addProduct(page, 'Pepperoni Pizza');

  const cart = await openCart(page);
  await cart.getByRole('button', { name: 'Remove' }).click();

  await expect(cart.getByText('Your cart is empty.')).toBeVisible();
  await expect(cartButton(page)).not.toContainText('1');
});

test('two identical configurations merge into one line', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await addProduct(page, 'Pepperoni Pizza', { size: 'MEDIUM' });
  await addProduct(page, 'Pepperoni Pizza', { size: 'MEDIUM' });

  const cart = await openCart(page);
  await expect(cartButton(page)).toContainText('2');
  // One line, quantity two — not two lines.
  await expect(cart.getByRole('button', { name: 'Remove' })).toHaveCount(1);
});

test('different toppings stay separate lines', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await addProduct(page, 'Pepperoni Pizza', { size: 'MEDIUM' });
  await addProduct(page, 'Pepperoni Pizza', { size: 'MEDIUM', toppings: ['Extra Cheese'] });

  const cart = await openCart(page);
  // Charging for the wrong pizza is exactly what isSameConfiguration exists to prevent.
  await expect(cart.getByRole('button', { name: 'Remove' })).toHaveCount(2);
});

test('switching to carryout drops the delivery fee', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await addProduct(page, 'Pepperoni Pizza');

  const cart = await openCart(page);

  // The TOTALS block, not the Delivery/Carryout toggle above it — both contain the word.
  const totals = cart.locator('.border-top');
  await expect(totals.getByText('Delivery')).toBeVisible();

  await cart.getByRole('button', { name: 'Carryout' }).click();
  await expect(totals.getByText('Delivery')).toBeHidden();
});

test('the cart survives a full page reload — it lives in the backend', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await addProduct(page, 'Pepperoni Pizza', { size: 'LARGE', toppings: ['Extra Cheese'] });

  // Wait for the debounced PUT to land before reloading, or there is nothing saved to restore.
  await page.waitForResponse(
    (r) => r.url().includes('/api/carts/') && r.request().method() === 'PUT' && r.ok(),
  );

  await page.reload();

  await expect(cartButton(page)).toContainText('1');
  const cart = await openCart(page);
  await expect(cart.getByText('Pepperoni Pizza')).toBeVisible();
  await expect(cart.getByText('Extra Cheese')).toBeVisible();
  // The price came back too, rebuilt from the catalogue — the server stores ids only.
  await expect(cart.getByText(/Large/)).toBeVisible();
});

test('a stale cart id is discarded rather than breaking the page', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem('pizza.cartId', '00000000-0000-0000-0000-000000000000'),
  );

  await page.goto('/menu?type=PIZZA');
  await expect(page.locator('.product-card').first()).toBeVisible();

  // The unusable id is forgotten instead of leaving the browser pointing at a cart that 404s.
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('pizza.cartId')))
    .toBeNull();
});

test('Checkout in the drawer navigates to the checkout page', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await addProduct(page, 'Pepperoni Pizza');

  const cart = await openCart(page);
  await cart.getByRole('button', { name: 'Checkout' }).click();

  await expect(page).toHaveURL(/\/checkout/);
  await expect(drawer(page)).toBeHidden();
});

test('checkout with an empty cart offers the menu instead', async ({ page }) => {
  await page.goto('/checkout');
  await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
  await page.getByRole('link', { name: 'Browse the menu' }).click();
  await expect(page).toHaveURL(/\/menu/);
});
