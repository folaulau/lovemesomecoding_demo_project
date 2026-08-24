/*
 * Regenerates screenshots/ and fails on any console error.
 *
 *   npm run screenshots          (dev server must be up)
 *   BASE=... API=... npm run screenshots
 *
 * Works against either data source. Slugs and ids differ between the mock fixtures
 * and the seeded database, so the sample reel is resolved from the API at runtime
 * rather than hard-coded - otherwise this script breaks every time the seed runs.
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:5176";
const API = process.env.API ?? "http://localhost:8087";
const OUT = "screenshots";
mkdirSync(OUT, { recursive: true });

const MOCK_FALLBACK = {
  slug: "fadeaway-over-two-defenders",
  id: "66c1c0000000000000000001",
  creator: "hoopsdaily",
  collection: "buzzer-beaters",
};

const SAMPLE = await fetch(`${API}/api/feed?limit=1`)
  .then((r) => r.json())
  .then((d) => ({
    slug: d.items[0].slug,
    id: d.items[0].id,
    creator: d.items[0].creator.username,
    collection: MOCK_FALLBACK.collection,
  }))
  .catch(() => MOCK_FALLBACK);

console.log(`sample reel: ${SAMPLE.slug} (${SAMPLE.id}) by @${SAMPLE.creator}\n`);

const PUBLIC_PAGES = [
  { name: "01-feed", path: "/", wait: ".reel-stage", fullPage: false },
  { name: "02-explore", path: "/explore", wait: ".reel-card" },
  { name: "03-reel", path: `/r/${SAMPLE.slug}`, wait: ".reel-stage" },
  { name: "04-creator", path: `/u/${SAMPLE.creator}`, wait: ".reel-card" },
  { name: "05-collections", path: "/c", wait: ".reel-card" },
  { name: "06-collection", path: `/c/${SAMPLE.collection}`, wait: ".reel-surface, .reel-card" },
  { name: "07-login", path: "/admin/login", wait: "form" },
];

const ADMIN_PAGES = [
  { name: "08-dashboard", path: "/admin", wait: "canvas" },
  { name: "09-reels", path: "/admin/reels", wait: "table" },
  { name: "10-reel-edit", path: `/admin/reels/${SAMPLE.id}`, wait: "#title" },
  { name: "11-collections-admin", path: "/admin/collections", wait: ".reel-surface" },
  { name: "12-creators-admin", path: "/admin/creators", wait: "table" },
];

const errors = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const page = await ctx.newPage();

page.on("console", (m) => {
  if (m.type() === "error") errors.push(`[console] ${page.url()} :: ${m.text()}`);
});
page.on("pageerror", (e) => errors.push(`[pageerror] ${page.url()} :: ${e.message}`));
page.on("response", (r) => {
  // A 500 from the API is a real failure even when the UI renders an empty state.
  if (r.status() >= 500) errors.push(`[http ${r.status()}] ${r.url()}`);
});

async function shoot({ name, path, wait, fullPage = true }) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  if (wait) {
    await page.waitForSelector(wait, { timeout: 10000 }).catch(() => {
      errors.push(`[missing] ${path} never rendered "${wait}"`);
    });
  }
  await page.waitForTimeout(700); // let charts and transitions settle
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
  console.log(`✓ ${name}`);
}

for (const p of PUBLIC_PAGES) await shoot(p);

await page.goto(`${BASE}/admin/login`, { waitUntil: "networkidle" });
await page.fill("#email", "admin@reelcms.test");
await page.fill("#password", "admin123");
await page.click('button:has-text("Sign in")');
await page.waitForURL("**/admin", { timeout: 10000 });

for (const p of ADMIN_PAGES) await shoot(p);

// Mobile pass on the feed — the layout most likely to break at 390px.
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
const mp = await mobile.newPage();
await mp.goto(`${BASE}/`, { waitUntil: "networkidle" });
await mp.waitForSelector(".reel-stage");
await mp.waitForTimeout(600);
await mp.screenshot({ path: `${OUT}/13-feed-mobile.png` });
console.log("✓ 13-feed-mobile");

await browser.close();

if (errors.length) {
  console.error("\n⚠️  Problems found:");
  errors.forEach((e) => console.error("  " + e));
  process.exit(1);
}
console.log("\nNo console errors.");
