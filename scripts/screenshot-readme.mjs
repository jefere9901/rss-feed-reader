import { chromium } from "playwright";

async function main() {
  console.log("截图 RSS Feed Reader（含实际订阅数据）");
  let browser;
  try {
    browser = await chromium.launch({ headless: false, args: ["--window-size=1400,900", "--no-sandbox"] });
  } catch {
    browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--window-size=1400,900", "--no-sandbox"] });
  }
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true })).newPage();

  await page.goto("http://localhost:6806", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(4000);

  // wait for dock
  let hasWidget = false;
  for (let i = 0; i < 6 && !hasWidget; i++) {
    hasWidget = await page.evaluate(() => {
      let w = document.querySelector('[class*="rss-widget"]');
      return !!(w && w.textContent && w.textContent.length > 100);
    });
    if (!hasWidget) { console.log(`等待 dock (${i + 1})...`); await page.waitForTimeout(2000); }
  }
  if (!hasWidget) { console.log("Widget not ready"); await browser.close(); return; }

  // Step 1: Switch to settings tab
  console.log("切换到设置Tab...");
  await page.evaluate(() => {
    let w = document.querySelector('[class*="rss-widget"]');
    for (let b of w.querySelectorAll('button')) {
      if (b.textContent.includes('设') || b.textContent.includes('⚙')) { b.click(); return; }
    }
  });
  await page.waitForTimeout(800);

  // Step 2: Add feed if none exist
  let feedCount = await page.evaluate(() => {
    let el = document.querySelector('[class*="rss-feed-manage-item"]');
    return el ? 1 : 0;
  });
  if (feedCount === 0) {
    console.log("添加阮一峰 RSS...");
    // Click add button
    await page.evaluate(() => {
      for (let b of document.querySelectorAll('button')) {
        if (b.textContent.includes('添加订阅')) { b.click(); return; }
      }
    });
    await page.waitForTimeout(500);
    // Fill URL
    const inp = page.locator("#rss-url-input");
    if (await inp.count() > 0) {
      await inp.fill("http://www.ruanyifeng.com/blog/atom.xml");
      await page.waitForTimeout(300);
    }
    // Click detect
    await page.locator("#rss-add-detect").click();
    console.log("等待检测完成...");
    await page.waitForTimeout(10000);
  }

  // Step 3: Switch back to feed tab
  console.log("切回订阅Tab...");
  await page.evaluate(() => {
    let w = document.querySelector('[class*="rss-widget"]');
    for (let b of w.querySelectorAll('button')) {
      if (b.textContent.includes('订') || b.textContent.includes('📰')) { b.click(); return; }
    }
  });
  await page.waitForTimeout(1500);

  // Step 4: Expand first feed group
  await page.evaluate(() => {
    let header = document.querySelector('[class*="rss-feed-header"]');
    if (header) header.click();
  });
  await page.waitForTimeout(800);

  // Step 5: Take screenshot of the rss-widget element only
  const widget = page.locator('[class*="rss-widget"]');
  if (await widget.count() > 0) {
    await widget.first().screenshot({ path: "screenshots/rss-feed-screen.png" });
    console.log("截图已保存: screenshots/rss-feed-screen.png");
  } else {
    await page.screenshot({ path: "screenshots/rss-feed-screen.png" });
  }

  // dump for verification
  let text = await page.evaluate(() => {
    let w = document.querySelector('[class*="rss-widget"]');
    return w ? w.textContent.trim().slice(0, 300).replace(/\s{2,}/g, ' ') : "NO WIDGET";
  });
  console.log("界面内容:", text);

  await browser.close();
}
main();
