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

  // Switch to settings tab
  await page.evaluate(() => {
    let w = document.querySelector('[class*="rss-widget"]');
    if (!w) return;
    for (let b of w.querySelectorAll('button')) {
      if (b.textContent.includes('设') || b.textContent.includes('⚙')) { b.click(); return; }
    }
  });
  await page.waitForTimeout(1000);

  // Dump settings section DOM
  let dom = await page.evaluate(() => {
    let w = document.querySelector('[class*="rss-widget"]');
    if (!w) return "NO WIDGET";
    
    // Get all sections
    let sections = w.querySelectorAll('[class*="rss-settings-section"]');
    let result = [];
    sections.forEach((s, si) => {
      let title = s.querySelector('[class*="rss-settings-section-title"]');
      let header = s.querySelector('[class*="rss-settings-collapse-header"]');
      let body = s.querySelector('[class*="rss-settings-collapse-body"]');
      let card = s.querySelector('[class*="rss-settings-card"]');
      let actions = s.querySelector('[class*="rss-settings-actions"]');
      let buttons = s.querySelectorAll('button');
      
      result.push({
        section: si,
        titleText: title ? title.textContent.trim() : "none",
        headerClass: header ? header.className : "none",
        bodyClass: body ? body.className : "NONE - MISSING!",
        bodyCollapsed: body ? body.classList.contains('collapsed') : false,
        cardFound: !!card,
        actionsFound: !!actions,
        buttonCount: buttons.length,
        buttonTexts: Array.from(buttons).map(b => b.textContent.trim().slice(0, 20)),
        innerHTML: s.innerHTML.slice(0, 1000),
      });
    });
    return JSON.stringify(result, null, 2);
  });
  console.log("Settings DOM:\n" + dom);

  // Also dump the raw text
  let text = await page.evaluate(() => {
    let w = document.querySelector('[class*="rss-widget"]');
    return w ? w.textContent.trim().slice(0, 500) : "NO WIDGET";
  });
  console.log("\nWidget text: " + text);

  await page.screenshot({ path: "screenshots/settings-debug.png" });
  console.log("截图: screenshots/settings-debug.png");
  await page.waitForTimeout(3000);
  await browser.close();
}
main();
