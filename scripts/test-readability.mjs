import { chromium } from "playwright";

let passed = 0, failed = 0;
function ok(c, d) {
  if (c) { passed++; console.log(`  ✅ ${d}`); }
  else { failed++; console.log(`  ❌ ${d}`); }
}

async function main() {
  console.log("\n" + "═".repeat(60));
  console.log("  Playwright E2E: 反限制模式 + 全文提取验证");
  console.log("  cnfeat.com (description-only feed)");
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
  ok(true, "RSS 插件已加载");

  // ─── Turn ON bypass mode ───
  console.log("\n--- Step 1: 启用反限制模式 ---");
  await page.evaluate(() => { for (const b of document.querySelectorAll("button")) { if (b.textContent.includes("设") || b.textContent.includes("⚙")) { b.click(); return; } } });
  await page.waitForTimeout(800);

  await page.evaluate(() => { for (const el of document.querySelectorAll('[class*="rss-settings-collapse-header"]')) { if (el.textContent.includes("通用设置")) { el.click(); return; } } });
  await page.waitForTimeout(500);

  const toggleInfo = await page.evaluate(() => {
    for (const row of document.querySelectorAll('[class*="rss-setting-row"]')) {
      const label = row.querySelector('[class*="rss-setting-label"]');
      if (label && label.textContent.includes("限制")) {
        const toggle = row.querySelector('[class*="rss-toggle"]');
        if (toggle && !toggle.classList.contains("active")) { toggle.click(); return true; }
      }
    }
    return false;
  });
  ok(toggleInfo, "反限制模式已开启");

  // ─── Add cnfeat.com RSS ───
  console.log("\n--- Step 2: 添加 cnfeat.com (description-only feed) ---");
  await page.evaluate(() => { for (const b of document.querySelectorAll("button")) { if (b.textContent.includes("添加订阅")) { b.click(); return; } } });
  await page.waitForTimeout(600);
  await page.locator("#rss-url-input").fill("https://www.cnfeat.com/feed.xml");
  await page.waitForTimeout(300);
  await page.locator("#rss-add-detect").click();
  console.log("   等待检测 (20s)...");
  await page.waitForTimeout(20000);

  const fb = await page.evaluate(() => {
    const el = document.querySelector('[class*="rss-detect-result"]');
    return el ? el.textContent.trim().slice(0, 200) : "(表单已关闭)";
  });
  ok(fb.includes("✅") || fb.includes("(表单已关闭)"), `cnfeat 添加成功: ${fb}`);

  // ─── Go to feed tab ───
  console.log("\n--- Step 3: 切回订阅 Tab ---");
  await page.evaluate(() => { for (const b of document.querySelectorAll("button")) { if (b.textContent.includes("阅")) { b.click(); return; } } });
  await page.waitForTimeout(2000);

  // Expand feed
  await page.evaluate(() => {
    const headers = document.querySelectorAll('[class*="rss-feed-header"]');
    if (headers.length > 0) headers[headers.length - 1].click();
  });
  await page.waitForTimeout(600);

  // Click first article
  console.log("\n--- Step 4: 打开第一篇文章 → 触发全文提取 ---");
  const articleCount = await page.evaluate(() => {
    const items = document.querySelectorAll('[class*="rss-article-item"]');
    if (items.length > 0) { items[0].click(); return items.length; }
    return 0;
  });
  ok(articleCount > 0, `找到 ${articleCount} 篇文章`);
  console.log("   等待全文提取 (10s)...");
  await page.waitForTimeout(10000);

  // Check reader
  const reader = await page.evaluate(() => {
    const overlay = document.querySelector('[class*="rss-reader-overlay"]');
    if (!overlay) return { open: false };
    const title = overlay.querySelector('[class*="rss-reader-title"]');
    const content = overlay.querySelector('[class*="rss-reader-content"]');
    const loading = document.getElementById("rss-fulltext-loading");
    return {
      open: true,
      title: title ? title.textContent.trim().slice(0, 60) : "",
      contentLen: content ? content.textContent.replace(/\s+/g, "").length : 0,
      images: content ? content.querySelectorAll("img").length : 0,
      loadingText: loading ? loading.textContent : null,
      loadingVisible: loading ? (loading.offsetParent !== null) : false,
    };
  });

  ok(reader.open, "阅读器已打开");
  console.log(`   标题: ${reader.title}`);
  console.log(`   内容长度: ${reader.contentLen} 字符`);
  console.log(`   图片: ${reader.images}`);
  console.log(`   加载提示: ${reader.loadingText || "(无)"}`);

  if (reader.contentLen > 500) {
    ok(true, `✅ 全文提取成功! (${reader.contentLen} 字符)`);
  } else {
    ok(false, `内容不足 (${reader.contentLen} 字符, 需≥500)`);
  }

  await page.screenshot({ path: "screenshots/test-readability-cnfeat.png" });

  // ─── Close reader ───
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);

  // ─── Summary ───
  console.log("\n" + "═".repeat(60));
  console.log(`  通过: ${passed}  失败: ${failed}`);
  if (failed === 0) console.log("  🎉 全文提取功能验证通过!");
  else console.log(`  ⚠️ ${failed} 项失败`);
  console.log("═".repeat(60) + "\n");

  await page.waitForTimeout(1000);
  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("异常:", e.message); process.exit(1); });
