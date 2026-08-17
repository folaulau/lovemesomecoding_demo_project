import { expect, test } from '@playwright/test';

/**
 * End-to-end walkthrough of the Phase 2 UI, running against mock data.
 *
 * The point of these is to prove the pieces actually connect — cart context updating the navbar
 * badge, the builder's live pricing, guest checkout not demanding a login — rather than just
 * that the bundle compiles.
 */

test('home page renders the hero and featured pizzas', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /No One OutPizzas the Hub/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Popular right now' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Order now' })).toBeVisible();
});

test('menu lists all 14 products and filters by type', async ({ page }) => {
  await page.goto('/menu');

  // 8 pizzas + 6 drinks from the mock menu.
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(14);

  await page.getByRole('link', { name: 'Pizzas' }).click();
  await expect(page).toHaveURL(/type=PIZZA/);
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(8);

  await page.getByRole('link', { name: 'Drinks' }).click();
  await expect(page).toHaveURL(/type=DRINK/);
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(6);
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

  // Large -> $16.99.
  // ToggleButton renders a visually-hidden radio input plus a label, so the label is what a
  // real user clicks — targeting it by `for` is the stable way to hit it.
  await dialog.locator('label[for="size-LARGE"]').click();
  await expect(dialog.getByText('$16.99', { exact: true }).first()).toBeVisible();

  // Add bacon (+$1.75) -> $18.74.
  await dialog.getByRole('button', { name: /Bacon/ }).click();
  await expect(dialog.getByText('$18.74').first()).toBeVisible();

  // Stuffed crust (+$2.50) -> $21.24.
  await dialog.locator('label[for="crust-4"]').click();
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
  await expect(drawer.getByText('Subtotal')).toBeVisible();
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

test('a guest can check out without signing in', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await page.getByRole('button', { name: 'Build it' }).first().click();
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

  await page.getByRole('button', { name: /Place order/ }).click();

  await expect(page).toHaveURL(/\/order-confirmation\/\d+/);
  await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();

  // The cart is emptied once the order is placed.
  await expect(page.getByRole('button', { name: /Open cart/ })).not.toContainText('1');
});

test('admin route is guarded, and reachable after signing in as an admin', async ({ page }) => {
  // Not signed in: bounced to the login page.
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel('Email').fill('admin@pizza.test');
  await page.getByLabel('Password').fill('admin123');
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Redirected back to where we were originally headed.
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByRole('heading', { name: 'Admin', exact: true })).toBeVisible();
});

test('a non-admin cannot reach the admin dashboard', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('customer@pizza.test');
  await page.getByLabel('Password').fill('pizza123');
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Wait for the sign-in to actually complete before navigating. The mock login has a
  // deliberate delay; without this the next goto races it and arrives still logged out.
  await expect(page.getByRole('button', { name: /Demo Customer/ })).toBeVisible();

  await page.goto('/admin');
  // requireAdmin sends a signed-in non-admin back to the home page.
  await expect(page).toHaveURL('http://localhost:5173/');
});

test('bad credentials show an error', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('customer@pizza.test');
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText('Incorrect email or password.')).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});
