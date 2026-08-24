import { defineConfig, devices } from "@playwright/test";

/*
 * These are TRUE end-to-end tests: they drive a real browser against the real Vue
 * app talking to the real Spring Boot API and a real MongoDB. Nothing is stubbed,
 * because the things most worth testing here (cursor paging, the change stream,
 * role enforcement) only exist once all three are running.
 *
 * Both servers must already be up:
 *   docker compose up -d
 *   cd reelcms-springboot-backend && ./mvnw spring-boot:run
 *   cd reelcms-vue-frontend && npm run dev
 */
export default defineConfig({
  testDir: "./tests/e2e",
  // Admin tests create, publish and delete reels in a shared database, so they
  // cannot safely run in parallel with each other.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.BASE ?? "http://localhost:5176",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
