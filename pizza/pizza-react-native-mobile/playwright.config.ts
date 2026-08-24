import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright, driving the app through its WEB target.
 *
 * <p>This is the one honest way to exercise these screens in CI without a simulator: Expo builds
 * the same components through react-native-web, and `testID` becomes `data-testid` in the DOM, so
 * the selectors below name the same elements a Detox or Maestro run on device would.
 *
 * <p>What it CANNOT cover is anything native: the Stripe payment sheet, the keychain, `AppState`.
 * Those are covered by the Jest suite (against mocks) and, ultimately, by running on a device.
 *
 * <p>⚠️ Serial, one worker. Like the two web frontends' suites, this is integration testing against
 * ONE backend and ONE database — parallel workers would see each other's fixtures. And never run
 * this at the same time as the React or Angular suite, for the same reason.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],

  use: {
    baseURL: process.env['MOBILE_WEB_URL'] ?? 'http://localhost:8082',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'mobile-web',
      use: {
        ...devices['Desktop Chrome'],
        // A phone-sized viewport, because that is the layout the app is designed for.
        viewport: { width: 414, height: 896 },
      },
    },
  ],
});
