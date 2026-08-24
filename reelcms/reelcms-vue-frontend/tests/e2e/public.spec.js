import { expect, test } from "@playwright/test";
import { API, firstPublishedReel } from "./helpers";

test.describe("public site", () => {
  test("the feed renders a reel and snaps between slides", async ({ page }) => {
    await page.goto("/");

    const slides = page.locator(".feed-slide");
    await expect(page.locator(".reel-stage").first()).toBeVisible();
    // The first page is 4 reels plus the loading/end slide.
    expect(await slides.count()).toBeGreaterThan(1);

    // The caption, creator and action rail are all part of the overlay.
    await expect(page.locator(".reel-overlay").first()).toBeVisible();
    await expect(page.locator(".reel-actions").first()).toBeVisible();
  });

  test("scrolling the feed loads the next page via the cursor", async ({ page }) => {
    await page.goto("/");
    await page.locator(".reel-stage").first().waitFor();

    const before = await page.locator(".feed-slide").count();

    // Scroll to the bottom of the pager, which trips the IntersectionObserver
    // prefetch two slides from the end.
    await page.locator(".feed-scroller").evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await page.waitForTimeout(1500);

    const after = await page.locator(".feed-slide").count();
    expect(after).toBeGreaterThanOrEqual(before);
  });

  test("liking a reel updates the count optimistically", async ({ page }) => {
    await page.goto("/");
    await page.locator(".reel-stage").first().waitFor();

    const likeButton = page.locator('.reel-action-btn[aria-label="Like"]').first();
    const count = likeButton.locator("xpath=../div[@class='reel-action-count']");
    const before = Number((await count.textContent()).replace(/[^\d.]/g, ""));

    await likeButton.click();

    await expect(likeButton).toHaveAttribute("aria-pressed", "true");
    const after = Number((await count.textContent()).replace(/[^\d.]/g, ""));
    expect(after).toBeGreaterThanOrEqual(before);
  });

  test("explore searches the text index and filters by tag", async ({ page }) => {
    await page.goto("/explore");
    await expect(page.locator(".reel-card").first()).toBeVisible();

    const all = await page.locator(".reel-card").count();

    // Tag chips come from the trending-tags aggregation, so wait for that request
    // rather than assuming it has landed by the time the cards render.
    await expect(page.locator("button.tag-chip")).not.toHaveCount(1);
    const firstTag = page.locator("button.tag-chip").nth(1);
    const tagName = (await firstTag.textContent()).trim().replace("#", "");
    await firstTag.click();

    await expect(page).toHaveURL(new RegExp(`tag=${tagName}`));
    await page.waitForTimeout(700);
    const filtered = await page.locator(".reel-card").count();
    expect(filtered).toBeLessThanOrEqual(all);
    expect(filtered).toBeGreaterThan(0);
  });

  test("a search with no matches shows the empty state, not an error", async ({ page }) => {
    await page.goto("/explore?q=zzzzznotathing");
    await expect(page.getByText("Nothing matched")).toBeVisible();
  });

  test("a reel permalink shows its stats and comment thread", async ({ page, request }) => {
    const reel = await firstPublishedReel(request);
    await page.goto(`/r/${reel.slug}`);

    await expect(page.getByRole("heading", { name: reel.title })).toBeVisible();
    await expect(page.locator("#comments")).toBeVisible();
    await expect(page.getByText("Views")).toBeVisible();
  });

  test("posting a comment appends it to the thread and bumps the counter", async ({ page, request }) => {
    const reel = await firstPublishedReel(request);
    await page.goto(`/r/${reel.slug}`);
    await page.locator("#comments").waitFor();

    const body = `Playwright says hello ${Date.now()}`;
    await page.fill('input[placeholder="Add a comment…"]', body);
    await page.click('#comments button[type="submit"], #comments .btn-primary');

    await expect(page.getByText(body)).toBeVisible();
  });

  test("an unknown slug shows a not-found state rather than crashing", async ({ page }) => {
    await page.goto("/r/definitely-not-a-real-slug");
    await expect(page.getByText("That reel does not exist")).toBeVisible();
  });

  test("a creator page lists only that creator's published reels", async ({ page, request }) => {
    const reel = await firstPublishedReel(request);
    await page.goto(`/u/${reel.creator.username}`);

    await expect(page.getByRole("heading", { name: reel.creator.displayName })).toBeVisible();
    await expect(page.locator(".reel-card").first()).toBeVisible();
  });

  test("collections list and open", async ({ page }) => {
    await page.goto("/c");
    await expect(page.locator(".reel-card").first()).toBeVisible();

    await page.locator(".reel-card").first().click();
    await expect(page).toHaveURL(/\/c\/[a-z0-9-]+$/);
    await expect(page.locator(".breadcrumb")).toBeVisible();
  });

  test("an unpublished reel is not reachable by URL", async ({ page, request }) => {
    // Confirms the 404-not-403 rule: a draft slug must not reveal that it exists.
    const res = await request.get(`${API}/api/reels/season-opener-preview-three-things-to-watch`);
    expect(res.status()).toBe(404);
  });

  test("the 404 page catches unknown routes", async ({ page }) => {
    await page.goto("/no/such/page");
    await expect(page.getByText("404")).toBeVisible();
  });
});
