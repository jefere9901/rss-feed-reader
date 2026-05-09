import { chromium } from "playwright";

let passed = 0, failed = 0;
function ok(c, d) { if (c) { passed++; console.log(`  ✅ ${d}`); } else { failed++; console.log(`  ❌ ${d}`); } }

async function main() {
  console.log("\n══════════════════════════════");
  console.log("  时间筛选器验证 (1d/7d/30d/全部)");
  console.log("══════════════════════════════");

  let browser;
  try { browser = await chromium.launch({ headless: false, args: ["--window-size=1400,900", "--no-sandbox"] }); }
  catch { browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--window-size=1400,900", "--no-sandbox"] }); }
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();

  await page.goto("http://localhost:6806", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(4000);

  for (let i = 0; i < 6; i++) {
    if (await page.evaluate(() => {
      const w = document.querySelector('[class*="rss-widget"]');
      return !!(w && w.textContent && w.textContent.length > 50);
    })) break;
    await page.waitForTimeout(2000);
  }

  await page.evaluate(() => { for (const b of document.querySelectorAll("button")) { if (b.textContent.includes("阅")) { b.click(); return; } } });
  await page.waitForTimeout(1000);

  // ─── Check time filter buttons exist ───
  const filterBar = await page.evaluate(() => {
    const bar = document.querySelector('[class*="rss-time-filter"]');
    if (!bar) return null;
    const pills = bar.querySelectorAll('button[class*="rss-pill"]');
    return {
      found: true,
      pills: Array.from(pills).map(p => ({ text: p.textContent.trim(), active: p.classList.contains("active") })),
    };
  });

  ok(!!filterBar, "时间筛选器存在");
  if (filterBar) {
    ok(filterBar.pills.length === 4, `4个按钮: ${filterBar.pills.map(p => p.text).join("/")}`);
    const active = filterBar.pills.find(p => p.active);
    ok(active && active.text === "7天", `默认选中 "7天" (实际: ${active?.text})`);

    // Click "今天"
    const pills = await page.locator('[class*="rss-time-filter"] button[class*="rss-pill"]').all();
    if (pills.length >= 1) {
      await pills[0].click();
      await page.waitForTimeout(500);
    }

    const after1d = await page.evaluate(() => {
      const pills = document.querySelectorAll('[class*="rss-time-filter"] button[class*="rss-pill"]');
        const active = document.querySelector('[class*="rss-time-filter"] button[class*="rss-pill"].active');
      return { count: pills.length, activeText: active ? active.textContent.trim() : "" };
    });
    ok(after1d.activeText === "今天", `切换到 "今天"`);

    // Click "全部"
    if (pills.length >= 4) {
      await pills[3].click();
      await page.waitForTimeout(500);
    }

    const afterAll = await page.evaluate(() => {
      const active = document.querySelector('[class*="rss-time-filter"] button[class*="rss-pill"].active');
      return active ? active.textContent.trim() : "";
    });
    ok(afterAll === "全部", `切换到 "全部"`);

    // Back to default
    if (pills.length >= 2) {
      await pills[1].click();
      await page.waitForTimeout(500);
    }
  }

  await page.screenshot({ path: "screenshots/test-time-filter.png" });

  console.log("\n══════════════════════════════");
  console.log(`  通过: ${passed}  失败: ${failed}`);
  if (failed === 0) console.log("  🎉 时间筛选器验证通过!");
  console.log("══════════════════════════════\n");

  await page.waitForTimeout(500);
  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("异常:", e.message); process.exit(1); });
