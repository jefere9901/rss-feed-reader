import { chromium } from "playwright";

const SIYUAN_URL = "http://localhost:6806";
const TEST_RSS_URL = "http://www.ruanyifeng.com/blog/atom.xml";

async function main() {
  console.log("启动浏览器...");
  let browser;
  try {
    browser = await chromium.launch({ headless: false, args: ["--window-size=1400,900", "--no-sandbox"] });
  } catch {
    browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--window-size=1400,900", "--no-sandbox"] });
  }
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true })).newPage();

  await page.goto(SIYUAN_URL, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(4000);

  // 用户已点开 dock
  for (let retry = 0; retry < 5; retry++) {
    let ok = await page.evaluate(() => {
      let w = document.querySelector('[class*="rss-widget"]');
      return !!(w && w.textContent && w.textContent.length > 100);
    });
    if (ok) break;
    console.log(`等待 dock (${retry+1}/5)...`);
    await page.waitForTimeout(2000);
  }

  // Step 1: 截图初始状态
  console.log("\n===== 初始状态 =====");
  await dumpWidgetState(page);
  await page.screenshot({ path: "screenshots/01-initial.png" });

  // Step 2: 切到设置 Tab
  console.log("\n===== 切到设置Tab =====");
  await page.evaluate(() => {
    let w = document.querySelector('[class*="rss-widget"]');
    for (let b of w.querySelectorAll('button')) {
      if (b.textContent.includes('设') || b.textContent.includes('⚙')) { b.click(); return; }
    }
  });
  await page.waitForTimeout(800);

  // Step 3: 点「＋ 添加订阅」
  console.log("\n===== 点击添加订阅 =====");
  await page.evaluate(() => {
    for (let b of document.querySelectorAll('button')) {
      if (b.textContent.includes('添加订阅')) { b.click(); return; }
    }
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: "screenshots/02-add-form.png" });

  // Step 4: 填入 URL
  await page.locator("#rss-url-input").fill(TEST_RSS_URL);
  await page.waitForTimeout(300);
  await page.screenshot({ path: "screenshots/03-url-filled.png" });

  // Step 5: 点检测
  await page.locator("#rss-add-detect").click();
  console.log("等待检测...");
  await page.waitForTimeout(10000);

  let fb = await page.evaluate(() => {
    let f = document.querySelector('[class*="rss-detect-result"]');
    return f ? f.textContent.trim().slice(0, 300) : '(已关闭)';
  });
  console.log("反馈: " + fb);

  // Step 6: 切回订阅 Tab
  console.log("\n===== 切回订阅Tab =====");
  await page.evaluate(() => {
    let w = document.querySelector('[class*="rss-widget"]');
    for (let b of w.querySelectorAll('button')) {
      if (b.textContent.includes('订') || b.textContent.includes('📰')) { b.click(); return; }
    }
  });
  await page.waitForTimeout(1500);

  // Step 7: 截图 + dump
  await page.screenshot({ path: "screenshots/04-feed-tab-final.png" });
  await dumpWidgetState(page);
  await dumpDetailedDOM(page);

  console.log("\n所有截图:");
  console.log("  screenshots/01-initial.png");
  console.log("  screenshots/02-add-form.png");
  console.log("  screenshots/03-url-filled.png");
  console.log("  screenshots/04-feed-tab-final.png");

  await page.waitForTimeout(5000);
  await browser.close();
}

async function dumpWidgetState(page) {
  let text = await page.evaluate(() => {
    let w = document.querySelector('[class*="rss-widget"]');
    if (!w) return "NO WIDGET";
    let lines = [];
    
    // 完整文本
    lines.push("完整文本: " + w.textContent.trim().replace(/\s{2,}/g, ' ').slice(0, 500));
    
    // Feed names
    let names = w.querySelectorAll('[class*="rss-feed-name"]');
    lines.push("订阅名称: " + Array.from(names).map(e => '"' + e.textContent.trim() + '"').join(", "));
    
    // Feed headers
    let headers = w.querySelectorAll('[class*="rss-feed-header"]');
    headers.forEach((h, i) => lines.push(`Header[${i}]: ` + h.textContent.trim().replace(/\s+/g, ' ')));
    
    // Articles
    let articles = w.querySelectorAll('[class*="rss-article-item"]');
    lines.push("文章数: " + articles.length);
    articles.forEach((a, i) => {
      let t = a.querySelector('[class*="rss-article-title"]');
      let m = a.querySelector('[class*="rss-article-meta"]');
      if (t) lines.push(`  文章[${i}]: ` + t.textContent.trim());
      if (m) lines.push(`    meta: ` + m.textContent.trim().replace(/\s+/g, ' '));
    });
    
    // 检查是否有 URL 样式的文本
    let urlLike = [];
    let walker = document.createTreeWalker(w, NodeFilter.SHOW_TEXT);
    let node;
    while (node = walker.nextNode()) {
      let t = node.textContent.trim();
      if (/^https?:\/\//.test(t)) urlLike.push(t.slice(0, 80));
    }
    if (urlLike.length > 0) lines.push("⚠️ URL样式文本: " + urlLike.join(" | "));
    
    return lines.join("\n  ");
  });
  console.log(text);
}

async function dumpDetailedDOM(page) {
  let html = await page.evaluate(() => {
    let w = document.querySelector('[class*="rss-widget"]');
    if (!w) return "NO WIDGET";
    // 只取 feed 相关部分
    let feeds = w.querySelector('[class*="rss-feed-group"]');
    if (feeds) return feeds.outerHTML.slice(0, 2000);
    let content = w.querySelector('[class*="rss-content"]');
    if (content) return content.innerHTML.slice(0, 2000);
    return w.innerHTML.slice(0, 2000);
  });
  console.log("\nFeed DOM:\n" + html.replace(/></g, '>\n<').slice(0, 2000));
}

main();
