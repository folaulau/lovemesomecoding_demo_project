import { expect, test } from "@playwright/test";
import { ADMIN, API, CREATOR, assertLiveApi, firstPublishedReel, signIn } from "./helpers";

test.describe("admin studio", () => {
  test("the admin area is behind a guard and redirects back after signing in", async ({ page }) => {
    await page.goto("/admin/reels");

    // Not signed in: bounced to login with the intended destination preserved.
    await expect(page).toHaveURL(/\/admin\/login\?redirect=/);
    expect(new URL(page.url()).searchParams.get("redirect")).toBe("/admin/reels");

    await page.fill("#email", ADMIN.email);
    await page.fill("#password", ADMIN.password);
    await page.click('button:has-text("Sign in")');

    await expect(page).toHaveURL(/\/admin\/reels$/);
  });

  test("a wrong password shows an error and does not sign in", async ({ page }) => {
    await page.goto("/admin/login");
    await page.fill("#email", ADMIN.email);
    await page.fill("#password", "wrong-password");
    await page.click('button:has-text("Sign in")');

    await expect(page.getByText("Invalid email or password")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("the dashboard renders every aggregation panel with real numbers", async ({ page }) => {
    await signIn(page);
    await assertLiveApi(page);

    // Four stat cards, three charts, two tables.
    await expect(page.locator(".stat-card")).toHaveCount(4);
    await expect(page.locator("canvas")).toHaveCount(3);
    await expect(page.getByText("Views over the last 30 days")).toBeVisible();
    await expect(page.getByText("Top reels")).toBeVisible();
    await expect(page.getByText("Engagement by tag")).toBeVisible();

    // "Total views" must be a real figure, not a zero or a dash.
    const total = await page.locator(".stat-card").first().locator(".stat-value").textContent();
    expect(total.trim()).not.toBe("0");
    expect(total.trim()).not.toBe("—");
  });

  test("the headline total agrees with the daily chart", async ({ page, request }) => {
    // The inconsistency this guards against is a headline of 7.5M above a chart
    // that sums to 30k - two numbers on one screen that cannot both be true.
    await signIn(page);
    const token = await page.evaluate(() => localStorage.getItem("reelcms.token"));

    const res = await request.get(`${API}/api/admin/reports`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const report = await res.json();

    const chartSum = report.viewsOverTime.reduce((s, d) => s + d.views, 0);

    // Near-equality, not exact. The headline reads the counters and the chart
    // aggregates the events, which are two reads at two instants against a live
    // database - a view arriving between them legitimately lands in one and not
    // the other. What this guards against is the two being on different SCALES,
    // which is what happens when the seeded counters are invented rather than
    // derived: a 7.5M headline over a chart summing to 30k.
    const drift = Math.abs(report.totals.totalViews - chartSum);
    expect(drift).toBeLessThan(20);
    expect(chartSum).toBeGreaterThan(0);
  });

  test("live view counts arrive over the change-stream SSE", async ({ page, request }) => {
    await signIn(page);
    await page.getByText("Live views").waitFor();
    await expect(page.getByText("Waiting for activity…")).toBeVisible();

    // Generate views through the public API; the $inc should reach the dashboard
    // via the oplog with no polling anywhere in the chain.
    const reel = await firstPublishedReel(request);
    for (let i = 0; i < 4; i++) {
      await request.post(`${API}/api/reels/${reel.id}/views`, { data: { watchSeconds: 25 } });
      await page.waitForTimeout(400);
    }

    await expect(page.locator(".badge", { hasText: "+" }).first()).toBeVisible({ timeout: 15000 });
  });

  test("the reel list filters by status, creator and search", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/reels");
    await page.locator("table").waitFor();

    const totalText = await page.getByText(/reel\(s\)/).first().textContent();
    const total = Number(totalText.match(/\d+/)[0]);
    expect(total).toBeGreaterThan(0);

    await page.selectOption("#status", "DRAFT");
    // Wait for the filtered result rather than a fixed delay - the count is the
    // thing being asserted, so racing the request makes this test lie.
    await expect(page.locator("tbody tr .badge", { hasText: "Draft" }).first()).toBeVisible();
    const drafts = await page.locator("tbody tr").count();
    expect(drafts).toBeGreaterThan(0);
    // Every visible row must actually be a draft.
    await expect(page.locator("tbody tr .badge", { hasText: "Draft" })).toHaveCount(drafts);

    await page.selectOption("#status", "");
    await page.fill("#q", "fadeaway");
    await page.waitForTimeout(800);
    expect(await page.locator("tbody tr").count()).toBeLessThan(total);
  });

  test("only the current section is highlighted in the sidebar", async ({ page }) => {
    // Vue Router marks a link to an index child active whenever any sibling is,
    // so without an explicit exact-active class both Dashboard and Reels light up.
    await signIn(page);
    await page.goto("/admin/reels");

    await expect(page.locator(".admin-nav-link", { hasText: "Reels" })).toHaveClass(/is-current/);
    await expect(page.locator(".admin-nav-link", { hasText: "Dashboard" })).not.toHaveClass(/is-current/);
  });

  test("create → publish → appears publicly → delete", async ({ page }) => {
    await signIn(page);

    const title = `E2E reel ${Date.now()}`;
    await page.goto("/admin/reels/new");

    await page.fill("#title", title);
    // The slug follows the title until it is edited by hand.
    await expect(page.locator("#slug")).toHaveValue(/e2e-reel-\d+/);
    const slug = await page.locator("#slug").inputValue();

    await page.fill("#description", "Created by the Playwright suite.");
    await page.fill('input[placeholder="Type a tag and press Enter"]', "Playwright Test");
    await page.keyboard.press("Enter");
    // Tags are slugified on entry so two spellings cannot become two tags.
    await expect(page.locator(".tag-chip", { hasText: "playwright-test" })).toBeVisible();

    await page.click('button:has-text("Create")');
    await expect(page.getByText("Reel created.")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/reels\/[0-9a-f]{24}$/);

    // Publishing without a video must be refused - a broken card in the public
    // feed is worse than an unpublished draft.
    await page.selectOption("#status", "PUBLISHED");
    await page.click('button:has-text("Save")');
    await expect(page.getByText("Fix the highlighted fields.")).toBeVisible();
    await expect(page.getByText("Upload a video before publishing.")).toBeVisible();

    // Give it media through the API, then publish from the list.
    const token = await page.evaluate(() => localStorage.getItem("reelcms.token"));
    const id = page.url().split("/").pop();
    await page.request.put(`${API}/api/admin/reels/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        title,
        slug,
        description: "Created by the Playwright suite.",
        status: "PUBLISHED",
        tags: ["playwright-test"],
        collectionIds: [],
        video: {
          url: "/media/videos/e2e.mp4",
          posterUrl: "/media/posters/e2e.jpg",
          durationSeconds: 20,
          width: 1080,
          height: 1920,
          sizeBytes: 100,
        },
      },
    });

    // It is now on the public site.
    await page.goto(`/r/${slug}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();

    // Clean up through the UI, confirming the delete dialog on the way.
    await page.goto("/admin/reels");
    await page.fill("#q", title);
    await page.waitForTimeout(800);
    await page.locator('tbody tr button[title="Delete"]').first().click();
    await expect(page.getByText("Delete this reel?")).toBeVisible();
    await page.locator('.reel-surface button:has-text("Delete")').click();
    await expect(page.getByText(/Deleted/)).toBeVisible();

    // And gone from the public site.
    await page.goto(`/r/${slug}`);
    await expect(page.getByText("That reel does not exist")).toBeVisible();
  });

  test("a creator cannot see the Creators section", async ({ page }) => {
    await signIn(page, CREATOR);

    await expect(page.locator(".admin-nav-link", { hasText: "Reels" })).toBeVisible();
    await expect(page.locator(".admin-nav-link", { hasText: "Creators" })).toHaveCount(0);

    // ...and the route guard turns a direct visit away too.
    await page.goto("/admin/creators");
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("a creator cannot edit another creator's reel", async ({ page }) => {
    await signIn(page, CREATOR);
    await page.goto("/admin/reels");
    await page.locator("table").waitFor();

    // The creator filter is an admin-only control - /api/admin/creators is
    // restricted, and a creator has nothing to filter by anyway.
    await expect(page.locator("#creator")).toHaveCount(0);

    // Search rather than page: the default page size is 10, so another creator's
    // reels are not guaranteed to be on page one.
    await page.fill("#q", "Pitchside");
    await expect(page.locator("tbody tr").first()).toBeVisible();
    await page.waitForTimeout(600);

    const foreignRow = page.locator("tbody tr").first();
    await expect(foreignRow.locator('button[title="Delete"]')).toBeDisabled();
    await expect(foreignRow.locator('a[title="Edit"]')).toHaveClass(/disabled/);

    // ...while their own reels stay editable.
    await page.fill("#q", "Hoops Daily");
    await page.waitForTimeout(800);
    await expect(page.locator("tbody tr").first().locator('button[title="Delete"]')).toBeEnabled();
  });

  test("renaming a creator rewrites the snapshot on their reels", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/creators");
    await page.locator("table").waitFor();

    const row = page.locator("tbody tr").first();
    const originalName = (await row.locator("td").nth(1).locator("div").first().textContent()).trim();
    const reelCount = Number((await row.locator("td").nth(3).textContent()).trim());

    await row.locator('button[title="Edit"]').click();
    await expect(page.getByText("Edit creator")).toBeVisible();

    // The dialog states the fan-out cost explicitly when there are reels to rewrite.
    if (reelCount > 0) {
      await expect(page.getByText(/rewrites the denormalized creator snapshot/)).toBeVisible();
    }

    const renamed = `${originalName} X`;
    await page.fill("#dname", renamed);
    await page.click('form button:has-text("Save")');
    await expect(page.getByText(/snapshot was rewritten|Creator created/)).toBeVisible();

    // The reel list now shows the new name, proving the fan-out landed.
    await page.goto("/admin/reels");
    await page.waitForTimeout(700);
    await expect(page.locator("tbody").getByText(renamed).first()).toBeVisible();

    // Put it back.
    await page.goto("/admin/creators");
    await page.locator("tbody tr").filter({ hasText: renamed }).first().locator('button[title="Edit"]').click();
    await page.fill("#dname", originalName);
    await page.click('form button:has-text("Save")');
    await expect(page.getByText(/snapshot was rewritten/)).toBeVisible();
  });

  test("collections can be created and deleted", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/collections");

    const name = `E2E Collection ${Date.now()}`;
    await page.click('button:has-text("New collection")');
    await page.fill("#cname", name);
    await expect(page.locator("#cslug")).toHaveValue(/e2e-collection-\d+/);
    await page.fill("#cdesc", "Created by the Playwright suite.");
    await page.click('form button:has-text("Save")');

    await expect(page.getByText("Collection created.")).toBeVisible();
    await expect(page.getByText(name)).toBeVisible();

    await page.locator(".reel-surface").filter({ hasText: name }).locator('button[title="Delete"]').click();
    await expect(page.getByText("Delete this collection?")).toBeVisible();
    await page.locator('.reel-surface button:has-text("Delete")').last().click();
    await expect(page.getByText(/Deleted/)).toBeVisible();
  });

  test("signing out clears the session and re-guards the admin", async ({ page }) => {
    await signIn(page);
    await page.click('button:has-text("Sign out")');
    await expect(page).toHaveURL(/\/admin\/login/);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
