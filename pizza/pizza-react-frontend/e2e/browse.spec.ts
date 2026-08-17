import { expect, test } from '@playwright/test';

/**
 * Browsing the menu and configuring an item — everything driven through the UI.
 *
 * Requires the API on http://localhost:8085:
 *   cd pizza-springboot-backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=local
 */

/** Fails fast with a useful message rather than a wall of confusing UI timeouts. */
test.beforeAll(async ({ request }) => {
  const response = await request.get('http://localhost:8085/api/products').catch(() => null);
  if (!response?.ok()) {
    throw new Error(
      'The backend is not responding at http://localhost:8085. Start it with:\n' +
        '  cd pizza-springboot-backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=local',
    );
  }
});

test('the home page shows the hero and featured pizzas loaded from the API', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /No One OutPizzas the Hub/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Popular right now' })).toBeVisible();
  // Only rendered after the menu request resolves.
  await expect(page.getByRole('heading', { name: 'Pepperoni Pizza' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(3);
});

test('the "Order now" call to action goes to the menu', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Order now' }).click();

  await expect(page).toHaveURL(/\/menu$/);
  await expect(page.getByRole('heading', { name: 'Menu', exact: true })).toBeVisible();
});

test('"Add a drink" deep-links straight to the drinks filter', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Add a drink' }).click();

  await expect(page).toHaveURL(/\/menu\?type=DRINK/);
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(6);
});

test('the menu tabs filter the list', async ({ page }) => {
  await page.goto('/menu');
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(14);

  /*
   * Scope to .nav-tabs deliberately. react-bootstrap renders a Nav.Link as an anchor with
   * role="button", NOT role="link" — and the navbar happens to contain real links also labelled
   * "Pizzas" and "Drinks". An unscoped getByRole('link', …) silently clicks the NAVBAR instead,
   * so the tabs themselves were never being exercised.
   */
  const tabs = page.locator('.nav-tabs');

  await tabs.getByRole('button', { name: 'Pizzas' }).click();
  await expect(page).toHaveURL(/type=PIZZA/);
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(8);

  await tabs.getByRole('button', { name: 'Drinks' }).click();
  await expect(page).toHaveURL(/type=DRINK/);
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(6);

  await tabs.getByRole('button', { name: 'Everything' }).click();
  await expect(page).toHaveURL(/\/menu$/);
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(14);
});

test('the navbar links filter the menu too', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('navigation').getByRole('link', { name: 'Pizzas' }).click();
  await expect(page).toHaveURL(/\/menu\?type=PIZZA/);
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(8);

  await page.getByRole('navigation').getByRole('link', { name: 'Drinks' }).click();
  await expect(page).toHaveURL(/\/menu\?type=DRINK/);
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(6);
});

test('the filter lives in the URL, so it survives a reload', async ({ page }) => {
  // Landing directly on the filtered URL must work — that is the point of keeping it in the URL.
  await page.goto('/menu?type=PIZZA');
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(8);

  await page.reload();
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(8);
});

test('the pizza builder recalculates the price as options change', async ({ page }) => {
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

  // ToggleButton renders a hidden radio plus a label; the label is what a user clicks.
  await dialog.locator('label[for="size-LARGE"]').click();
  await expect(dialog.getByText('$16.99', { exact: true }).first()).toBeVisible();

  await dialog.getByRole('button', { name: /Bacon/ }).click();
  await expect(dialog.getByText('$18.74').first()).toBeVisible();

  await dialog.getByText('Stuffed Crust').click();
  await expect(dialog.getByText('$21.24').first()).toBeVisible();

  // Deselecting a topping must take the money back off again.
  await dialog.getByRole('button', { name: /Bacon/ }).click();
  await expect(dialog.getByText('$19.49').first()).toBeVisible();
});

test('quantity multiplies the unit price in the builder', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await page
    .getByRole('heading', { name: 'Cheese Pizza' })
    .locator('xpath=ancestor::div[contains(@class,"product-card")]')
    .getByRole('button', { name: 'Build it' })
    .click();

  const dialog = page.getByRole('dialog');
  await dialog.locator('label[for="size-SMALL"]').click();
  await dialog.getByLabel('Quantity').selectOption('3');

  // 9.99 each, 29.97 total — both shown.
  await expect(dialog.getByText('$9.99 each')).toBeVisible();
  await expect(dialog.getByText('$29.97', { exact: true })).toBeVisible();
});

test('a drink gets only the size step — no crust or toppings', async ({ page }) => {
  await page.goto('/menu?type=DRINK');
  await page
    // exact:true matters: "Pepsi" is a substring of "Diet Pepsi".
    .getByRole('heading', { name: 'Pepsi', exact: true })
    .locator('xpath=ancestor::div[contains(@class,"product-card")]')
    .getByRole('button', { name: 'Add', exact: true })
    .click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Size' })).toBeVisible();
  // The whole point: a drink has no crust and no toppings.
  await expect(dialog.getByRole('heading', { name: 'Crust' })).toBeHidden();
  await expect(dialog.getByRole('heading', { name: /Toppings/ })).toBeHidden();
});

test('cancelling the builder adds nothing to the cart', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');
  await page.getByRole('button', { name: 'Build it' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('button', { name: /Open cart/ })).not.toContainText('1');
});

test('reopening the builder resets the previous selections', async ({ page }) => {
  await page.goto('/menu?type=PIZZA');

  // Configure one pizza heavily, then close without adding.
  await page.getByRole('button', { name: 'Build it' }).first().click();
  let dialog = page.getByRole('dialog');
  await dialog.locator('label[for="size-LARGE"]').click();
  await dialog.getByRole('button', { name: /Bacon/ }).click();
  await dialog.getByRole('button', { name: 'Cancel' }).click();

  // The next pizza must start clean, not inherit bacon and LARGE.
  await page.getByRole('button', { name: 'Build it' }).nth(1).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/selected/)).toBeHidden();
  await expect(dialog.locator('#size-MEDIUM')).toBeChecked();
});
