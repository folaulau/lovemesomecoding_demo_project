import { defineConfig, devices } from '@playwright/test'

/**
 * ⚠️ `workers: 1` and `fullyParallel: false`, and neither is negotiable here.
 *
 * Every spec runs against ONE database and ONE API. In parallel, two specs see each other's
 * projects and quotes — a lead feed picks up a job another test just posted, a count assertion
 * fails, and the failure looks like a bug in the app rather than in the test setup. The suite is
 * small enough that running serially costs seconds.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  // Retries hide flakiness rather than fixing it, and this suite talks to a local stack with no
  // network variance. A flaky test here means something is genuinely wrong.
  retries: 0,
  reporter: [['list']],
  // Runs once after the whole suite, pass or fail — see e2e/global-teardown.ts for why the tests
  // cannot tidy up through the app itself.
  globalTeardown: './e2e/global-teardown.ts',
  timeout: 30_000,

  use: {
    baseURL: 'http://localhost:5177',
    // Only on failure — a passing run should not leave megabytes of traces behind.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
