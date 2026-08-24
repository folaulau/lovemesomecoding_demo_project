import { expect, test } from '@playwright/test';
import { openMenu } from './helpers';

/** Build a pizza and put it in the cart. Returns the price the builder quoted. */
async function buildAndAdd(page: import('@playwright/test').Page) {
  await openMenu(page);
  await page.getByTestId('menu-filter-PIZZA').click();
  await page.locator('[data-testid^="product-card-"]').first().click();

  await expect(page.getByTestId('pizza-builder-sheet')).toBeVisible();
  const quoted = await page.getByTestId('builder-total').textContent();

  await page.getByTestId('builder-add').click();
  await expect(page.getByTestId('pizza-builder-sheet')).toBeHidden();

  return quoted;
}

test.describe('the pizza builder', () => {
  test('opens, prices live as options are chosen, and adds to the cart', async ({ page }) => {
    await openMenu(page);
    await page.getByTestId('menu-filter-PIZZA').click();
    await page.locator('[data-testid^="product-card-"]').first().click();

    await expect(page.getByTestId('pizza-builder-sheet')).toBeVisible();

    const medium = await page.getByTestId('builder-total').textContent();

    // A large costs more than a medium.
    await page.getByTestId('size-LARGE').click();
    const large = await page.getByTestId('builder-total').textContent();
    expect(parsePrice(large)).toBeGreaterThan(parsePrice(medium));

    // A topping costs more again.
    await page.locator('[data-testid^="topping-"]').first().click();
    const topped = await page.getByTestId('builder-total').textContent();
    expect(parsePrice(topped)).toBeGreaterThan(parsePrice(large));

    await page.getByTestId('builder-add').click();
    await expect(page.getByTestId('cart-badge')).toHaveText('1');
  });

  test('starts clean when it is reopened — no leftover size or toppings', async ({ page }) => {
    await openMenu(page);
    await page.getByTestId('menu-filter-PIZZA').click();

    const card = page.locator('[data-testid^="product-card-"]').first();

    await card.click();
    const fresh = parsePrice(await page.getByTestId('builder-total').textContent());

    await page.getByTestId('size-LARGE').click();
    await page.locator('[data-testid^="topping-"]').first().click();
    const customised = parsePrice(await page.getByTestId('builder-total').textContent());
    expect(customised).toBeGreaterThan(fresh);

    await page.getByTestId('sheet-close').click();
    await expect(page.getByTestId('pizza-builder-sheet')).toBeHidden();

    await card.click();

    /*
     * The price is back to the default medium with no toppings — which is the observable proof
     * that the sheet remounted with fresh state (see PizzaBuilderSheet's `key`).
     *
     * The obvious assertion would be `aria-checked` on the MEDIUM segment. It does not work:
     * react-native-web does not map React Native's `accessibilityState` onto `aria-checked`, so
     * the attribute is simply absent in the DOM. The state IS set — a screen reader on iOS or
     * Android reads it correctly, and the Jest suite asserts the prop directly — it just is not
     * observable through the web target. Asserting on the price avoids the gap entirely.
     */
    await expect(page.getByTestId('builder-total')).toHaveText(formatPrice(fresh));
  });
});

test.describe('the cart', () => {
  test('holds the line, and the quantity stepper changes the total', async ({ page }) => {
    await buildAndAdd(page);

    await page.getByTestId('cart-button').click();
    await expect(page.getByTestId('cart-sheet')).toBeVisible();

    const oneTotal = parsePrice(await page.getByTestId('cart-total').textContent());

    await page
      .getByLabel(/^Increase quantity of /)
      .first()
      .click();

    await expect(page.getByTestId('cart-badge')).toHaveText('2');
    const twoTotal = parsePrice(await page.getByTestId('cart-total').textContent());
    expect(twoTotal).toBeGreaterThan(oneTotal);
  });

  test('pickup removes the delivery fee', async ({ page }) => {
    await buildAndAdd(page);
    await page.getByTestId('cart-button').click();

    await expect(page.getByText('Delivery', { exact: true }).first()).toBeVisible();
    const delivery = parsePrice(await page.getByTestId('cart-total').textContent());

    await page.getByTestId('cart-order-type-CARRYOUT').click();

    const pickup = parsePrice(await page.getByTestId('cart-total').textContent());
    // $3.99 lighter, minus the tax difference — the point is simply that it costs less.
    expect(pickup).toBeLessThan(delivery);
  });

  test('removing the last line empties the cart', async ({ page }) => {
    await buildAndAdd(page);
    await page.getByTestId('cart-button').click();

    await page.locator('[data-testid^="cart-remove-"]').first().click();

    await expect(page.getByText('Your cart is empty')).toBeVisible();
    await expect(page.getByTestId('cart-badge')).toHaveCount(0);
  });

  test('SURVIVES A RELOAD — the cart lives in the backend, not the browser', async ({ page }) => {
    /*
     * Wait for the WRITE, not just for the badge.
     *
     * The cart is persisted on a 300 ms debounce, so the badge shows "1" a third of a second before
     * the server knows anything about it. Reloading in that window loses the line — and the test
     * would then be reporting a race of its own making rather than a defect. On a real phone the
     * same window is covered by the provider's AppState flush.
     */
    const saved = page.waitForResponse(
      (response) => /\/api\/carts\//.test(response.url()) && response.request().method() === 'PUT',
    );
    await buildAndAdd(page);
    await expect(page.getByTestId('cart-badge')).toHaveText('1');
    await saved;

    await page.reload();
    await page.getByTestId('menu-screen').waitFor({ timeout: 90_000 });

    await expect(page.getByTestId('cart-badge')).toHaveText('1');
  });
});

/** "$17.24" -> 17.24 */
function parsePrice(text: string | null): number {
  return Number((text ?? '').replace(/[^0-9.]/g, ''));
}

/** 17.24 -> "$17.24" */
function formatPrice(value: number): string {
  return `$${value.toFixed(2)}`;
}
