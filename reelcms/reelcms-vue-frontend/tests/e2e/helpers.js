export const API = process.env.API ?? "http://localhost:8087";

export const ADMIN = { email: "admin@reelcms.test", password: "admin123" };
export const CREATOR = { email: "creator@reelcms.test", password: "creator123" };

/** Signs in through the real form and waits for the dashboard. */
export async function signIn(page, who = ADMIN) {
  await page.goto("/admin/login");
  await page.fill("#email", who.email);
  await page.fill("#password", who.password);
  await page.click('button:has-text("Sign in")');
  await page.waitForURL("**/admin");
}

/** The first published reel, straight from the API - slugs change on every reseed. */
export async function firstPublishedReel(request) {
  const res = await request.get(`${API}/api/feed?limit=1`);
  const body = await res.json();
  return body.items[0];
}

/** Fails the test if the app is running on mock data - these tests assert real behaviour. */
export async function assertLiveApi(page) {
  const badge = page.locator(".badge", { hasText: "Live API" });
  await badge.waitFor({ timeout: 5000 });
}
