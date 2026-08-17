import { test } from '@playwright/test';

/** Captures the admin screens for review. Not assertions — see admin.spec.ts for those. */
test('capture the admin screens', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 1000 });

  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@pizza.test');
  await page.getByLabel('Password').fill('admin123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/admin/);

  // Charts animate in; let them settle before capturing.
  await page.getByText('Revenue per day').waitFor();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshots/07-admin-reports.png', fullPage: true });

  await page.getByRole('link', { name: 'Products' }).click();
  await page.getByRole('heading', { name: /Products ·/ }).waitFor();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'screenshots/08-admin-products.png', fullPage: true });

  await page.getByRole('button', { name: 'Add product' }).click();
  await page.getByRole('dialog').waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/09-admin-product-form.png' });
  await page.getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('link', { name: 'Orders' }).click();
  await page.getByRole('heading', { name: 'Orders' }).waitFor();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'screenshots/10-admin-orders.png', fullPage: true });
});
