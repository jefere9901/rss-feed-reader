import { chromium } from "playwright";

async function main() {
  let browser;
  try { browser = await chromium.launch({ headless: false, args: ["--window-size=1400,900", "--no-sandbox"] }); }
  catch { browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--window-size=1400,900", "--no-sandbox"] }); }
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true })).newPage();
  await page.goto("http://localhost:6806", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(4000);

  for (let i = 0; i < 6; i++) {
    if (await page.evaluate(() => { let w = document.querySelector('[class*="rss-widget"]'); return !!(w && w.textContent && w.textContent.length > 100); })) break;
    await page.waitForTimeout(2000);
  }

  // Switch to settings
  await page.evaluate(() => {
    let w = document.querySelector('[class*="rss-widget"]');
    for (let b of w.querySelectorAll('button')) {
      if (b.textContent.includes('设') || b.textContent.includes('⚙')) { b.click(); return; }
    }
  });
  await page.waitForTimeout(800);

  // Dump buttons before clicking
  let btns = await page.evaluate(() => {
    let w = document.querySelector('[class*="rss-widget"]');
    return Array.from(w.querySelectorAll('button')).map(b => b.textContent.trim().slice(0, 25));
  });
  console.log("所有按钮: " + btns.join(" | "));

  // Click "＋ 添加订阅"
  let clicked = await page.evaluate(() => {
    for (let b of document.querySelectorAll('button')) {
      if (b.textContent.includes('添加订阅')) { b.click(); return true; }
    }
    return false;
  });
  console.log("点击添加订阅: " + clicked);
  await page.waitForTimeout(800);

  // Check if form appeared
  let formCheck = await page.evaluate(() => {
    let inp = document.querySelector("#rss-url-input");
    let form = document.querySelector('[class*="rss-add-form"]');
    return {
      urlInput: !!inp,
      inputVisible: inp ? inp.offsetParent !== null : false,
      formFound: !!form,
      formHTML: form ? form.innerHTML.slice(0, 300) : '',
    };
  });
  console.log("\n表单状态:");
  console.log("  urlInput: " + formCheck.urlInput);
  console.log("  inputVisible: " + formCheck.inputVisible);
  console.log("  formHTML: " + formCheck.formHTML.slice(0, 200));

  await page.screenshot({ path: "screenshots/add-feed-test.png" });
  console.log("截图: screenshots/add-feed-test.png");

  // Fill and submit a test
  if (formCheck.urlInput) {
    await page.locator("#rss-url-input").fill("http://www.ruanyifeng.com/blog/atom.xml");
    await page.waitForTimeout(200);
    let val = await page.locator("#rss-url-input").inputValue();
    console.log("\n填入URL: " + val);

    // Click detect
    let btn = page.locator("#rss-add-detect");
    if (await btn.count() > 0) {
      await btn.click();
      console.log("点击检测并添加...");
      await page.waitForTimeout(10000);

      let fb = await page.evaluate(() => {
        let f = document.querySelector('[class*="rss-detect-result"]');
        return f ? f.textContent.trim().slice(0, 200) : '(表单已关闭)';
      });
      console.log("检测反馈: " + fb);
    }
  }

  // Switch back to feed
  await page.evaluate(() => {
    let w = document.querySelector('[class*="rss-widget"]');
    for (let b of w.querySelectorAll('button')) {
      if (b.textContent.includes('订') || b.textContent.includes('📰')) { b.click(); return; }
    }
  });
  await page.waitForTimeout(1000);

  // Check feed list
  let feeds = await page.evaluate(() => {
    let w = document.querySelector('[class*="rss-widget"]');
    let names = w.querySelectorAll('[class*="rss-feed-name"]');
    return Array.from(names).map(e => e.textContent.trim());
  });
  console.log("\n订阅Tab名称: " + JSON.stringify(feeds));

  await page.screenshot({ path: "screenshots/add-feed-result.png" });
  console.log("截图: screenshots/add-feed-result.png");

  await page.waitForTimeout(3000);
  await browser.close();
}
main();
