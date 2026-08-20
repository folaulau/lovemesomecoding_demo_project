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
   * ⚠️ It also means this suite and the React one must not run at the same time: they share the
   * database, so each would see the other's fixtures.
   */
  fullyParallel: false,
  workers: 1,

  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  // Starts the Angular dev server automatically, and reuses one that is already running.
  // The BACKEND is not started here — run it yourself with:
  //   cd pizza-springboot-backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=local
  webServer: {
    command: 'npm start -- --port 4200',
    url: 'http://localhost:4200',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
