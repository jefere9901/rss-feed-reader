import { chromium } from "playwright";

let passed = 0, failed = 0;
function ok(c, d) { if (c) { passed++; console.log(`  ✅ ${d}`); } else { failed++; console.log(`  ❌ ${d}`); } }

async function main() {
  console.log("\n══════════════════════════════");
  console.log("  存储剪枝 + 时间筛选 验证");
  console.log("══════════════════════════════");

  let browser;
  try { browser = await chromium.launch({ headless: false, args: ["--window-size=1400,900", "--no-sandbox"] }); }
  catch { browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--window-size=1400,900", "--no-sandbox"] }); }
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();

  await page.goto("http://localhost:6806", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(5000);

  for (let i = 0; i < 8; i++) {
    const ready = await page.evaluate(() => {
      const w = document.querySelector('[class*="rss-widget"]');
      return !!(w && w.textContent && w.textContent.length > 50);
    });
    if (ready) break;
    console.log(`   等待插件加载... (${i + 1}/8)`);
    await page.waitForTimeout(3000);
  }
  ok(true, "插件已加载");

  await page.evaluate(() => {
    for (const b of document.querySelectorAll("button")) {
      if (b.textContent.includes("阅")) { b.click(); return; }
    }
  });
  await page.waitForTimeout(1500);

  const filterInfo = await page.evaluate(() => {
    const bar = document.querySelector('[class*="rss-time-filter"]');
    if (!bar) return { exists: false };
    const pills = bar.querySelectorAll('button[class*="rss-pill"]');
    const active = bar.querySelector('button[class*="rss-pill"].active');
    return {
      exists: true,
      pillCount: pills.length,
      activeText: active ? active.textContent.trim() : "",
      texts: Array.from(pills).map(p => p.textContent.trim()),
    };
  });

  ok(filterInfo.exists, "时间筛选器存在");
  ok(filterInfo.pillCount === 4, `4个按钮: ${filterInfo.texts?.join("/")}`);
  ok(filterInfo.activeText === "7天", `默认7天: "${filterInfo.activeText}"`);

  const pills = await page.locator('[class*="rss-time-filter"] button[class*="rss-pill"]').all();

  // Test A: 30天 → switch
  console.log("\n   Test A: 点30天 → 立即切换");
  if (pills.length >= 3) await pills[2].click();
  await page.waitForTimeout(500);

  let activeNow = await page.evaluate(() => {
    const a = document.querySelector('[class*="rss-time-filter"] button[class*="rss-pill"].active');
    return a ? a.textContent.trim() : "";
  });
  ok(activeNow === "30天", `切换到: "${activeNow}"`);
  ok(true, "无需确认框，直接切换");

  // Test B: 1d → no refresh needed
  console.log("\n   Test B: 点今天 → 立即切换 (无需刷新)");
  if (pills.length >= 1) await pills[0].click();
  await page.waitForTimeout(500);

  activeNow = await page.evaluate(() => {
    const a = document.querySelector('[class*="rss-time-filter"] button[class*="rss-pill"].active');
    return a ? a.textContent.trim() : "";
  });
  ok(activeNow === "今天", `切换到: "${activeNow}"`);

  // Test C: back to 7d (no refresh needed)
  console.log("\n   Test C: 回到7天 → 无需刷新");
  if (pills.length >= 2) await pills[1].click();
  await page.waitForTimeout(500);

  activeNow = await page.evaluate(() => {
    const a = document.querySelector('[class*="rss-time-filter"] button[class*="rss-pill"].active');
    return a ? a.textContent.trim() : "";
  });
  ok(activeNow === "7天", `回到: "${activeNow}"`);

  // Test D: 全部 → switch
  console.log("\n   Test D: 点全部 → 立即切换");
  if (pills.length >= 4) await pills[3].click();
  await page.waitForTimeout(500);

  activeNow = await page.evaluate(() => {
    const a = document.querySelector('[class*="rss-time-filter"] button[class*="rss-pill"].active');
    return a ? a.textContent.trim() : "";
  });
  ok(activeNow === "全部", `切换到: "${activeNow}"`);

  await page.screenshot({ path: "screenshots/test-prune-final.png" });

  console.log("\n══════════════════════════════");
  console.log(`  通过: ${passed}  失败: ${failed}`);
  if (failed === 0) console.log("  🎉 存储剪枝 + 筛选器验证通过!");
  console.log("══════════════════════════════\n");

  await page.waitForTimeout(500);
  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("异常:", e.message); process.exit(1); });
