import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

/**
 * The profile screen's address book.
 *
 * <p>⚠️ These tests CREATE data, so each one deletes what it made. A leaked address changes which
 * one is preselected at checkout, and the failure then shows up in a completely unrelated spec.
 */
/** Removes an address straight through the API, using the token the app already stored. */
async function deleteAddressViaApi(page: import('@playwright/test').Page, line1: string) {
  const token = await page.evaluate(() => localStorage.getItem('pizza.token'));
  const headers = { Authorization: `Bearer ${token}` };

  const listed = await page.request.get('http://localhost:8085/api/me/addresses', { headers });
  const addresses: { id: string; line1: string }[] = await listed.json();

  for (const address of addresses.filter((a) => a.line1 === line1)) {
    await page.request.delete(`http://localhost:8085/api/me/addresses/${address.id}`, { headers });
  }
}

const TEST_LINE1 = '99 Playwright Way';

test.describe('profile — addresses', () => {
  /*
   * Clear anything a previous run left behind BEFORE counting.
   *
   * A test that only cleans up at the end cleans up nothing when it fails, and the next run then
   * fails differently — on a strict-mode violation from two matching rows rather than on the real
   * defect. Cleaning at the start makes a failed run self-healing.
   */
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await deleteAddressViaApi(page, TEST_LINE1);
  });

  test('adds an address, then deletes it', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.getByTestId('profile-screen')).toBeVisible({ timeout: 90_000 });

    const before = await page.locator('[data-testid^="profile-address-"]').count();

    await page.getByTestId('profile-add-address').click();
    await expect(page.getByTestId('address-form-sheet')).toBeVisible();

    await page.getByTestId('address-label').fill('E2E Test');
    await page.getByTestId('address-line1').fill(TEST_LINE1);
    await page.getByTestId('address-city').fill('San Francisco');
    await page.getByTestId('address-state').fill('CA');
    await page.getByTestId('address-zip').fill('94110');
    await page.getByTestId('address-save').click();

    await expect(page.getByTestId('address-form-sheet')).toBeHidden();
    await expect(page.getByText(TEST_LINE1)).toBeVisible();
    await expect(page.locator('[data-testid^="profile-address-"]')).toHaveCount(before + 1);

    /*
     * ---- clean up, so the next run starts where this one did ----
     *
     * Through the API, not through the Delete button. `Alert.alert` — the platform confirmation
     * dialog the screen uses before a destructive action — has NO react-native-web implementation:
     * it is a silent no-op, so on web the button does nothing and nothing is deleted. The confirm
     * flow works on iOS and Android and simply cannot be driven from this target, which is exactly
     * the kind of gap worth writing down rather than working around with a fake dialog.
     */
    await deleteAddressViaApi(page, TEST_LINE1);

    await page.reload();
    await expect(page.getByTestId('profile-screen')).toBeVisible({ timeout: 90_000 });
    await expect(page.locator('[data-testid^="profile-address-"]')).toHaveCount(before);
  });

  test('the form opens blank for a new address, not seeded from the last edit', async ({
    page,
  }) => {
    await page.goto('/profile');
    await expect(page.getByTestId('profile-screen')).toBeVisible({ timeout: 90_000 });

    await page.getByTestId('profile-add-address').click();
    await expect(page.getByTestId('address-line1')).toHaveValue('');
    await page.getByTestId('address-line1').fill('typed but abandoned');
    await page.getByTestId('sheet-close').click();

    await page.getByTestId('profile-add-address').click();

    // Remounted with fresh state — see AddressFormSheet's `key`.
    await expect(page.getByTestId('address-line1')).toHaveValue('');
  });

  test('saved cards explain that only display metadata is stored', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.getByTestId('profile-screen')).toBeVisible({ timeout: 90_000 });

    await expect(page.getByText('Saved cards')).toBeVisible();
    /*
     * Card COLLECTION is Stripe's native sheet, so on web the button is disabled and says so —
     * the same branch a device with no Stripe key would show.
     */
    await expect(
      page.getByText('Card management is only available in the iOS and Android builds.'),
    ).toBeVisible();
  });
});
