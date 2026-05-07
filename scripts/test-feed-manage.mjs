import { chromium } from "playwright";

let passed = 0, failed = 0;
function ok(c, d) {
  if (c) { passed++; console.log(`  ✅ ${d}`); }
  else { failed++; console.log(`  ❌ ${d}`); }
}

async function main() {
  console.log("\n" + "═".repeat(60));
  console.log("  订阅管理: 点击改名 / 双击改链接 / 状态红绿点");
  console.log("═".repeat(60));

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
      return !!(w && w.textContent && w.textContent.length > 100);
    })) break;
    await page.waitForTimeout(2000);
  }

  // ─── Switch to settings ───
  console.log("\n--- 切换到设置 Tab ---");
  await page.evaluate(() => { for (const b of document.querySelectorAll("button")) { if (b.textContent.includes("设") || b.textContent.includes("⚙")) { b.click(); return; } } });
  await page.waitForTimeout(800);

  // ─── Check feed manage items ───
  console.log("\n--- Step 1: 检查订阅管理列表 ---");
  const items = await page.evaluate(() => {
    const rows = document.querySelectorAll('[class*="rss-feed-manage-item"]');
    return Array.from(rows).map(r => {
      const name = r.querySelector('[class*="rss-feed-manage-name"]');
      const url = r.querySelector('[class*="rss-feed-manage-url"]');
      const status = r.querySelector('[class*="rss-feed-manage-status"]');
      return {
        name: name ? name.textContent.trim().slice(0, 35) : "",
        url: url ? url.textContent.trim().slice(0, 50) : "",
        hasUrl: !!url,
        statusText: status ? status.textContent.trim() : "",
        nameTitle: name ? name.title : "",
      };
    });
  });

  ok(items.length > 0, `有 ${items.length} 个订阅`);
  const hasUrl = items.some(i => i.hasUrl);
  ok(hasUrl, "订阅 URL 已显示");

  const hasGreen = items.some(i => i.statusText === "🟢");
  const hasRed = items.some(i => i.statusText === "🔴");
  console.log(`   绿点: ${hasGreen}, 红点: ${hasRed}`);
  ok(hasGreen || hasRed, "状态点已显示");

  const sample = items[0];
  console.log(`   首条: ${sample.name} | ${sample.url?.slice(0, 40)} | ${sample.statusText}`);
  ok(sample.nameTitle.includes("单击"), `tooltip 显示操作提示`);

  // ─── Step 2: Test rename by clicking name ───
  console.log("\n--- Step 2: 点击名称触发改名 ---");
  const dialogPromise = new Promise<boolean>((resolve) => {
    page.once("dialog", async (d) => {
      const msg = d.message();
      console.log(`   对话框: ${msg}`);
      ok(msg.includes("修改订阅名称"), "弹出改名对话框");
      await d.dismiss();
      resolve(true);
    });
    setTimeout(() => resolve(false), 5000);
  });

  await page.evaluate(() => {
    const name = document.querySelector('[class*="rss-feed-manage-name"]');
    if (name) name.click();
  });
  const renamed = await dialogPromise;
  ok(renamed, "改名对话框已触发");

  // ─── Step 3: Test URL edit by double-clicking name ───
  console.log("\n--- Step 3: 双击名称触发改链接 ---");
  const urlDialogPromise = new Promise<boolean>((resolve) => {
    page.once("dialog", async (d) => {
      const msg = d.message();
      console.log(`   对话框: ${msg}`);
      ok(msg.includes("修改订阅链接"), "弹出改链接对话框");
      await d.dismiss();
      resolve(true);
    });
    setTimeout(() => resolve(false), 5000);
  });

  await page.evaluate(() => {
    const name = document.querySelector('[class*="rss-feed-manage-name"]');
    if (name) {
      name.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    }
  });
  const urlEdited = await urlDialogPromise;
  ok(urlEdited, "改链接对话框已触发");

  await page.screenshot({ path: "screenshots/test-feed-manage.png" });

  console.log("\n" + "═".repeat(60));
  console.log(`  通过: ${passed}  失败: ${failed}`);
  if (failed === 0) console.log("  🎉 全部通过!");
  else console.log(`  ⚠️ ${failed} 项失败`);
  console.log("═".repeat(60) + "\n");

  await page.waitForTimeout(500);
  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("异常:", e.message); process.exit(1); });
