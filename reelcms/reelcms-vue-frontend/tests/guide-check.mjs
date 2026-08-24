import { chromium } from "@playwright/test";
const FILE = "file:///Users/folaukaveinga/Github/claude_lovemesomecoding/lovemesomecoding_demo_project/reelcms/developer-guide.html";
const b = await chromium.launch();
for (const scheme of ["light", "dark"]) {
  const ctx = await b.newContext({ colorScheme: scheme, viewport: { width: 1280, height: 1000 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("console", m => m.type() === "error" && errs.push(m.text()));
  p.on("pageerror", e => errs.push(e.message));
  await p.goto(FILE, { waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
  // horizontal overflow check
  const overflow = await p.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const fg = await p.evaluate(() => getComputedStyle(document.body).color);
  console.log(`${scheme}: body bg=${bg} fg=${fg} h-overflow=${overflow} errors=${errs.length}`);
  await p.screenshot({ path: `/tmp/guide-${scheme}-top.png` });
  await p.evaluate(() => document.querySelector("#relations").scrollIntoView());
  await p.waitForTimeout(400);
  await p.screenshot({ path: `/tmp/guide-${scheme}-er.png` });
  await ctx.close();
}
await b.close();
