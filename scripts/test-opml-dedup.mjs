import { chromium } from "playwright";

let passed = 0, failed = 0;
function ok(c, d) { if (c) { passed++; console.log(`  ✅ ${d}`); } else { failed++; console.log(`  ❌ ${d}`); } }

const OPML_PATH = "D:/demo/rss_siyuan/feeds-all.opml";

async function main() {
  console.log("\n══════════════════════════════");
  console.log("  OPML 重复导入去重验证");
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

  await page.evaluate(() => { for (const b of document.querySelectorAll("button")) { if (b.textContent.includes("设") || b.textContent.includes("⚙")) { b.click(); return; } } });
  await page.waitForTimeout(800);

  // Reset data
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('[class*="rss-settings-collapse-header"]')) {
      if (el.textContent.includes("通用设置")) { el.click(); return; }
    }
  });
  await page.waitForTimeout(500);
  page.once("dialog", d => d.accept());
  await page.evaluate(() => { for (const b of document.querySelectorAll("button")) { if (b.textContent.includes("清除")) { b.click(); return; } } });
  await page.waitForTimeout(1000);
  ok(true, "数据已重置");

  const countItems = () => page.evaluate(() => ({
    feeds: document.querySelectorAll('[class*="rss-feed-manage-item"]').length,
    folders: document.querySelectorAll('[class*="rss-folder-group-header"]').length,
  }));

  // ═══ 1st import ═══
  console.log("\n--- 第 1 次导入 ---");
  const fc1 = page.waitForEvent("filechooser");
  await page.evaluate(() => { for (const b of document.querySelectorAll("button")) { if (b.textContent.includes("导入 OPML")) { b.click(); return; } } });
  await (await fc1).setFiles(OPML_PATH);
  console.log("   等待导入 (60s)...");
  await page.waitForTimeout(60000);

  const after1 = await countItems();
  console.log(`   第1次: ${after1.feeds} 个订阅, ${after1.folders} 个文件夹`);
  ok(after1.feeds >= 28, `第1次导入 ${after1.feeds} 个订阅`);

  // ═══ 2nd import ═══
  console.log("\n--- 第 2 次导入 (应该全部跳过) ---");
  const fc2 = page.waitForEvent("filechooser");
  await page.evaluate(() => { for (const b of document.querySelectorAll("button")) { if (b.textContent.includes("导入 OPML")) { b.click(); return; } } });
  await (await fc2).setFiles(OPML_PATH);
  console.log("   等待导入 (10s)...");
  await page.waitForTimeout(10000);

  const after2 = await countItems();
  console.log(`   第2次: ${after2.feeds} 个订阅, ${after2.folders} 个文件夹`);
  ok(after2.feeds === after1.feeds, `第2次不增加: ${after1.feeds}=${after2.feeds}`);
  ok(after2.folders === after1.folders, `文件夹不重复: ${after1.folders}=${after2.folders}`);

  // ═══ 3rd import ═══
  console.log("\n--- 第 3 次导入 (仍然全部跳过) ---");
  const fc3 = page.waitForEvent("filechooser");
  await page.evaluate(() => { for (const b of document.querySelectorAll("button")) { if (b.textContent.includes("导入 OPML")) { b.click(); return; } } });
  await (await fc3).setFiles(OPML_PATH);
  await page.waitForTimeout(10000);

  const after3 = await countItems();
  console.log(`   第3次: ${after3.feeds} 个订阅, ${after3.folders} 个文件夹`);
  ok(after3.feeds === after1.feeds, `第3次不增加: ${after1.feeds}=${after3.feeds}`);

  await page.screenshot({ path: "screenshots/test-opml-dedup.png" });

  console.log("\n══════════════════════════════");
  console.log(`  通过: ${passed}  失败: ${failed}`);
  if (failed === 0) console.log("  🎉 OPML 去重验证通过!");
  console.log("══════════════════════════════\n");

  await page.waitForTimeout(500);
  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("异常:", e.message); process.exit(1); });
