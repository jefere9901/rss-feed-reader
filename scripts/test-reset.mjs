import { chromium } from "playwright";

const P = "✅", F = "❌";

async function main() {
  console.log("\n" + "=".repeat(55));
  console.log("  Playwright: 重置功能测试");
  console.log("=".repeat(55) + "\n");

  let browser;
  try { browser = await chromium.launch({ headless: false, args: ["--window-size=1400,900", "--no-sandbox"] }); }
  catch { browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--window-size=1400,900", "--no-sandbox"] }); }
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true })).newPage();
  await page.goto("http://localhost:6806", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(4000);

  let passed = 0, failed = 0;
  function ok(c, d) { if (c) { passed++; console.log(`  ${P} ${d}`); } else { failed++; console.log(`  ${F} ${d}`); } }

  for (let i = 0; i < 6; i++) {
    if (await page.evaluate(() => { let w = document.querySelector('[class*="rss-widget"]'); return !!(w && w.textContent && w.textContent.length > 100); })) break;
    await page.waitForTimeout(2000);
  }

  // First add a feed so we have something to reset
  await page.evaluate(() => {
    let w = document.querySelector('[class*="rss-widget"]');
    for (let b of w.querySelectorAll('button')) { if (b.textContent.includes('设') || b.textContent.includes('⚙')) { b.click(); return; } }
  });
  await page.waitForTimeout(800);

  // Add a test feed
  await page.evaluate(() => {
    for (let b of document.querySelectorAll('button')) { if (b.textContent.includes('添加订阅')) { b.click(); return; } }
  });
  await page.waitForTimeout(500);

  const inp = page.locator("#rss-url-input");
  if (await inp.count() > 0) {
    await inp.fill("http://www.ruanyifeng.com/blog/atom.xml");
    await page.waitForTimeout(200);
    await page.locator("#rss-add-detect").click();
    console.log("  等待添加测试订阅...");
    await page.waitForTimeout(10000);
  }

  // Verify feed was added
  let feedCount = await page.evaluate(() => {
    let w = document.querySelector('[class*="rss-widget"]');
    let names = w.querySelectorAll('[class*="rss-feed-manage-name"]');
    return names.length;
  });
  console.log(`\n  当前订阅管理条目: ${feedCount}`);
  ok(feedCount > 0, "已有至少一个订阅源");

  // Scroll to the reset button in general settings
  let resetBtnFound = await page.evaluate(() => {
    let btns = document.querySelectorAll('button');
    for (let b of btns) {
      if (b.textContent.includes('清除全部')) return { found: true, className: (b.getAttribute('class') || b.className + '').slice(0, 30) };
    }
    return { found: false };
  });
  ok(resetBtnFound.found, "🔄 清除全部 按钮已渲染");
  console.log(`  按钮样式: ${resetBtnFound.className}`);

  // Check it's inside general settings
  let insideGeneral = await page.evaluate(() => {
    for (let b of document.querySelectorAll('button')) {
      if (b.textContent.includes('清除全部')) {
        let el = b;
        while (el) {
          let cls = (typeof el.className === 'string') ? el.className : (el.getAttribute('class') || '');
          if (cls.includes('rss-settings-card')) return true;
          if (cls.includes('rss-settings-section')) return true;
          el = el.parentElement;
        }
        return false;
      }
    }
  });
  ok(insideGeneral, "重置按钮位于通用设置内");

  await page.screenshot({ path: "screenshots/reset-button.png" });
  console.log("  截图: screenshots/reset-button.png");

  // Click reset
  console.log("\n  点击「清除全部」...");
  
  // Handle confirm dialog
  page.once("dialog", async (dialog) => {
    console.log(`  对话框: "${dialog.message()}"`);
    ok(dialog.message().includes("确定"), "确认对话框已弹出");
    await dialog.accept();
  });

  await page.evaluate(() => {
    for (let b of document.querySelectorAll('button')) {
      if (b.textContent.includes('清除全部')) { b.click(); return; }
    }
  });
  await page.waitForTimeout(1500);

  // Verify everything is cleared
  let afterReset = await page.evaluate(() => {
    let w = document.querySelector('[class*="rss-widget"]');
    if (!w) return { widgetGone: true };

    let feedNames = w.querySelectorAll('[class*="rss-feed-name"]');
    let manageItems = w.querySelectorAll('[class*="rss-feed-manage-item"]');
    let empty = w.querySelector('[class*="rss-empty"]');
    let text = w.textContent?.trim().slice(0, 200);

    return {
      widgetGone: false,
      feedNames: feedNames.length,
      manageItems: manageItems.length,
      hasEmpty: !!empty,
      text: text,
    };
  });

  console.log(`  重置后: feedNames=${afterReset.feedNames}, manageItems=${afterReset.manageItems}, hasEmpty=${afterReset.hasEmpty}`);
  ok(afterReset.feedNames === 0, "订阅Tab中无订阅源");
  ok(afterReset.manageItems === 0, "设置中无订阅管理条目");
  ok(afterReset.hasEmpty || afterReset.text.includes('暂无') || afterReset.text.includes('还没有'), "显示空状态或默认提示");

  await page.screenshot({ path: "screenshots/reset-done.png" });
  console.log("  截图: screenshots/reset-done.png");

  // Report
  console.log("\n" + "=".repeat(55));
  let total = passed + failed;
  console.log(`  结果: ${passed}/${total} 通过, ${failed} 失败`);
  console.log(failed === 0 ? `  ${P}${P}${P} 全部通过!` : `  ⚠️ ${failed} 项失败`);
  console.log("=".repeat(55));

  await page.waitForTimeout(3000);
  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
}
main();
