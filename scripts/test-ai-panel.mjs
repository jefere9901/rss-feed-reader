import { chromium } from "playwright";

let passed = 0, failed = 0;
function ok(c, d) { if (c) { passed++; console.log(`  ✅ ${d}`); } else { failed++; console.log(`  ❌ ${d}`); } }

async function main() {
  console.log("\n" + "═".repeat(60));
  console.log("  AI 功能面板验证");
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

  console.log("\n--- 进入设置 ---");
  await page.evaluate(() => { for (const b of document.querySelectorAll("button")) { if (b.textContent.includes("设") || b.textContent.includes("⚙")) { b.click(); return; } } });
  await page.waitForTimeout(800);

  const aiSection = await page.evaluate(() => {
    const sections = document.querySelectorAll('[class*="rss-settings-section-title"]');
    for (const s of sections) {
      if (s.textContent.includes("AI")) return { found: true, text: s.textContent.trim() };
    }
    return { found: false };
  });
  ok(aiSection.found, `AI 设置分区存在: "${aiSection.text}"`);

  if (aiSection.found) {
    await page.evaluate(() => {
      const titles = document.querySelectorAll('[class*="rss-settings-section-title"]');
      for (const t of titles) {
        if (t.textContent.includes("AI") && t.classList.contains("rss-settings-collapse-header")) {
          t.click();
        }
      }
    });
    await page.waitForTimeout(500);
  }

  const aiContent = await page.evaluate(() => {
    const labels = document.querySelectorAll('[class*="rss-setting-label"]');
    const found = Array.from(labels).map(l => l.textContent.trim());
    return { labels: found.slice(-12), total: found.length };
  });
  console.log(`   AI 设置项: ${aiContent.labels.join(", ")}`);
  ok(aiContent.labels.some(l => l.includes("API")), "API 提供商配置存在");
  ok(aiContent.labels.some(l => l.includes("摘要")), "AI 摘要开关存在");
  ok(aiContent.labels.some(l => l.includes("翻译")), "AI 翻译开关存在");
  ok(aiContent.labels.some(l => l.includes("标签")), "AI 标签开关存在");
  ok(aiContent.labels.some(l => l.includes("日报")), "AI 日报开关存在");
  ok(aiContent.labels.some(l => l.includes("问答")), "AI 问答开关存在");
  ok(aiContent.labels.some(l => l.includes("过滤")), "AI 过滤开关存在");

  const btns = await page.evaluate(() => {
    const allBtns = document.querySelectorAll("button");
    return Array.from(allBtns).map(b => b.textContent.trim());
  });
  ok(btns.some(b => b.includes("测试连接")), "测试连接按钮存在");

  await page.screenshot({ path: "screenshots/test-ai-panel.png" });
  console.log("\n  📸 截图: screenshots/test-ai-panel.png");

  // Test reader with AI buttons
  console.log("\n--- 检查阅读器 AI 按钮 ---");
  // Add a feed first if needed
  const feedCount = await page.evaluate(() => document.querySelectorAll('[class*="rss-feed-manage-item"]').length);
  if (feedCount === 0) {
    await page.evaluate(() => { for (const b of document.querySelectorAll("button")) { if (b.textContent.includes("添加")) { b.click(); return; } } });
    await page.waitForTimeout(600);
    await page.locator("#rss-url-input").fill("http://www.ruanyifeng.com/blog/atom.xml");
    await page.locator("#rss-add-detect").click();
    await page.waitForTimeout(20000);
  }

  await page.evaluate(() => { for (const b of document.querySelectorAll("button")) { if (b.textContent.includes("阅")) { b.click(); return; } } });
  await page.waitForTimeout(1500);

  await page.evaluate(() => {
    const headers = document.querySelectorAll('[class*="rss-feed-header"]');
    if (headers.length > 0) headers[headers.length - 1].click();
  });
  await page.waitForTimeout(800);

  await page.evaluate(() => {
    const items = document.querySelectorAll('[class*="rss-article-item"]');
    if (items.length > 0) items[0].click();
  });
  await page.waitForTimeout(1500);

  const readerBtns = await page.evaluate(() => {
    const toolbar = document.querySelector('[class*="rss-reader-toolbar"]');
    if (!toolbar) return [];
    return Array.from(toolbar.querySelectorAll("button")).map(b => b.textContent.trim());
  });
  console.log(`   阅读器按钮: ${readerBtns.join(" | ")}`);
  ok(readerBtns.some(b => b.includes("摘要") && b.includes("🤖")), "AI 摘要按钮正确显示含 emoji");
  ok(readerBtns.some(b => b.includes("翻译") && b.includes("🌐")), "AI 翻译按钮正确显示含 emoji");

  await page.screenshot({ path: "screenshots/test-ai-reader.png" });

  console.log("\n" + "═".repeat(60));
  console.log(`  通过: ${passed}  失败: ${failed}`);
  if (failed === 0) console.log("  🎉 AI 功能面板验证通过!");
  else console.log(`  ⚠️ ${failed} 项失败`);
  console.log("═".repeat(60) + "\n");

  await page.waitForTimeout(500);
  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("异常:", e.message); process.exit(1); });
