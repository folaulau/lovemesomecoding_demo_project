import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // ⚠️ SERIAL, always. These are integration tests against ONE backend and ONE database — they
  // book real dates against real listings. Run them in parallel and two workers fight over the
  // same calendar, producing 409s that look like product bugs.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
