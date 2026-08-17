import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',

  /*
   * SERIAL, ON PURPOSE.
   *
   * These are integration tests against one running backend and one MySQL database. With parallel
   * workers the admin tests create and hide products while the menu tests are counting them —
   * "expected 14, received 15". That is not flakiness to retry away; it is shared mutable state.
   *
   * The alternatives are a database per worker, or assertions loose enough not to notice
   * interference. Both are worse for a demo: the first is a lot of machinery, the second removes
   * the very precision that makes the tests worth having. The whole suite runs in about 20s.
   */
  fullyParallel: false,
  workers: 1,

  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  // Starts the Vite dev server automatically, and reuses one that is already running.
  // The BACKEND is not started here — run it yourself with:
  //   cd pizza-springboot-backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=local
  webServer: {
    command: 'npm run dev -- --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
