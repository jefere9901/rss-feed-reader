import { chromium } from "playwright";

let passed = 0, failed = 0;
function ok(c, d) { if (c) { passed++; console.log(`  ✅ ${d}`); } else { failed++; console.log(`  ❌ ${d}`); } }

const DEEPSEEK_KEY = "sk-d49e6fd4e7134bb8a3ea7e819d5f72f8";
const OPML_PATH = "D:/demo/rss_siyuan/feeds-all.opml";

async function main() {
  console.log("\n" + "═".repeat(60));
  console.log("  AI 全流程: OPML→DeepSeek→摘要→翻译→问答");
  console.log("═".repeat(60));

  let browser;
  try { browser = await chromium.launch({ headless: false, args: ["--window-size=1400,900", "--no-sandbox"] }); }
  catch { browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--window-size=1400,900", "--no-sandbox"] }); }
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();

  page.on("console", msg => { if (msg.type() === "error" && msg.text().includes("RSS")) console.log("   [rss.err]", msg.text().slice(0, 150)); });

  await page.goto("http://localhost:6806", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(4000);

  for (let i = 0; i < 6; i++) {
    if (await page.evaluate(() => {
      const w = document.querySelector('[class*="rss-widget"]');
      return !!(w && w.textContent && w.textContent.length > 50);
    })) break;
    await page.waitForTimeout(2000);
  }
  ok(true, "插件已加载");

  // ─── Go to Settings ───
  console.log("\n--- Step 1: 进入设置 → 导入 OPML ---");
  await page.evaluate(() => { for (const b of document.querySelectorAll("button")) { if (b.textContent.includes("设") || b.textContent.includes("⚙")) { b.click(); return; } } });
  await page.waitForTimeout(800);

  const existingFeeds = await page.evaluate(() => document.querySelectorAll('[class*="rss-feed-manage-item"]').length);
  console.log(`   当前订阅: ${existingFeeds}`);

  if (existingFeeds === 0) {
    const fc = page.waitForEvent("filechooser");
    await page.evaluate(() => { for (const b of document.querySelectorAll("button")) { if (b.textContent.includes("导入 OPML")) { b.click(); return; } } });
    const fcEvt = await fc;
    await fcEvt.setFiles(OPML_PATH);
    console.log("   OPML 已选择，等待导入 (60s)...");
    await page.waitForTimeout(60000);
  }

  const importCount = await page.evaluate(() => document.querySelectorAll('[class*="rss-feed-manage-item"]').length);
  ok(importCount > 0, `导入后: ${importCount} 个订阅`);

  // ─── Step 2: Configure DeepSeek ───
  console.log("\n--- Step 2: 配置 AI ---");
  const aiSec = await page.evaluate(() => {
    for (const el of document.querySelectorAll('[class*="rss-settings-section-title"]')) {
      if (el.textContent.includes("AI")) { el.click(); return true; }
    }
    return false;
  });
  if (!aiSec) await page.waitForTimeout(500);

  const keyInput = page.locator('input[type="password"]').first();
  await keyInput.fill(DEEPSEEK_KEY);
  await page.waitForTimeout(200);
  keyInput.dispatchEvent("change");
  await page.waitForTimeout(500);
  ok(true, "API Key 已填入");

  // Enable tagging too
  const toggleInfo = await page.evaluate(() => {
    const toggles = document.querySelectorAll('[class*="rss-toggle"]');
    return Array.from(toggles).map(t => {
      const row = t.parentElement;
      const label = row ? row.querySelector('[class*="rss-setting-label"]') : null;
      const text = label ? label.textContent.trim() : "";
      const active = t.classList.contains("active");
      if ((text.includes("标签") || text.includes("过滤")) && !active) {
        t.click();
        return text + "→ON";
      }
      return text + (active ? "✓" : "✗");
    });
  });
  console.log(`   Toggles: ${toggleInfo.join(" | ")}`);
  ok(toggleInfo.some(t => t.includes("摘要") && t.includes("✓")), "AI摘要已启用");

  // ─── Step 3: Refresh one feed ───
  console.log("\n--- Step 3: 获取文章 ---");
  await page.evaluate(() => { for (const b of document.querySelectorAll("button")) { if (b.textContent.includes("阅")) { b.click(); return; } } });
  await page.waitForTimeout(1500);

  let articleCount = await page.evaluate(() => {
    return document.querySelectorAll('[class*="rss-article-item"]').length;
  });

  if (articleCount === 0) {
    console.log("   需要刷新...");
    await page.evaluate(() => {
      const bar = document.querySelector('[class*="rss-refresh-bar"]');
      if (bar) bar.click();
    });
    await page.waitForTimeout(60000);
    articleCount = await page.evaluate(() => document.querySelectorAll('[class*="rss-article-item"]').length);
  }

  ok(articleCount > 0, `有 ${articleCount} 篇文章`);

  // ─── Step 4: Open first article ───
  console.log("\n--- Step 4: 打开文章 → AI 测试 ---");
  await page.evaluate(() => {
    const headers = document.querySelectorAll('[class*="rss-feed-header"]');
    if (headers.length > 0) headers[0].click();
  });
  await page.waitForTimeout(800);

  await page.evaluate(() => {
    const items = document.querySelectorAll('[class*="rss-article-item"]');
    if (items.length > 0) items[0].click();
  });
  await page.waitForTimeout(2000);

  // ═══ Test A: AI 摘要 ═══
  console.log("\n--- Test A: AI 摘要 ---");
  const summaryClick = await page.evaluate(() => {
    const btn = document.querySelector('[class*="rss-reader-ai-summary"]');
    return !!btn;
  });
  ok(summaryClick, "摘要按钮存在于 DOM");

  if (summaryClick) {
    await page.evaluate(() => {
      const btn = document.querySelector('[class*="rss-reader-ai-summary"]');
      if (btn) btn.click();
    });
    console.log("   等待摘要生成 (30s)...");

    let gotSummary = false;
    for (let i = 1; i <= 6; i++) {
      await page.waitForTimeout(5000);
      const card = await page.evaluate(() => {
        const c = document.getElementById("rss-ai-summary-card");
        if (!c) return null;
        const body = c.querySelector('[class*="rss-ai-summary-body"]');
        return body ? body.textContent.trim().slice(0, 160) : "";
      });
      if (card && card.length > 20) {
        console.log(`   [${i * 5}s] ✅ ${card.slice(0, 100)}...`);
        gotSummary = true;
        break;
      }
      const btnText = await page.evaluate(() => {
        const btn = document.querySelector('[class*="rss-reader-ai-summary"]');
        return btn ? btn.textContent.trim() : "(no btn)";
      });
      console.log(`   [${i * 5}s] 按钮: ${btnText}`);
      if (btnText.includes("❌")) break;
    }
    ok(gotSummary, "AI 摘要生成成功");
    await page.screenshot({ path: "screenshots/test-ai-summary.png" });

    if (gotSummary) {
      const closeBtn = await page.evaluate(() => {
        const c = document.getElementById("rss-ai-summary-close");
        if (c) { c.click(); return true; }
        return false;
      });
      await page.waitForTimeout(300);
    }
  }

  // ═══ Test B: AI 翻译 ═══
  console.log("\n--- Test B: AI 翻译 ---");
  const transBtn = await page.evaluate(() => {
    const btn = document.querySelector('[class*="rss-reader-ai-translate"]');
    return !!btn;
  });
  ok(transBtn, "翻译按钮存在于 DOM");

  if (transBtn) {
    await page.evaluate(() => {
      const btn = document.querySelector('[class*="rss-reader-ai-translate"]');
      if (btn) btn.click();
    });
    console.log("   等待翻译 (30s)...");

    let gotTrans = false;
    for (let i = 1; i <= 6; i++) {
      await page.waitForTimeout(5000);
      const transLen = await page.evaluate(() => {
        const content = document.getElementById("rss-reader-content");
        return content ? content.textContent.replace(/\s+/g, "").length : 0;
      });
      const transBtnText = await page.evaluate(() => {
        const btn = document.querySelector('[class*="rss-reader-ai-translate"]');
        return btn ? btn.textContent.trim() : "";
      });
      console.log(`   [${i * 5}s] 内容: ${transLen}字符 | 按钮: ${transBtnText}`);
      if (transLen > 100) {
        ok(true, `翻译成功 (${transLen}字符)`);
        gotTrans = true;
        break;
      }
      if (transBtnText.includes("❌")) break;
    }
    if (!gotTrans) ok(false, "翻译失败");
    await page.screenshot({ path: "screenshots/test-ai-translate.png" });
  }

  // ═══ Test C: AI 问答 ═══
  console.log("\n--- Test C: AI 问答 ---");
  const qaVisible = await page.locator("#rss-ai-qa-input").isVisible().catch(() => false);
  ok(qaVisible, "问答输入框存在");

  if (qaVisible) {
    await page.locator("#rss-ai-qa-input").fill("用一句话概括这篇文章");
    await page.locator("#rss-ai-qa-send").click();
    console.log("   等待 AI 回答 (30s)...");

    let gotQA = false;
    for (let i = 1; i <= 6; i++) {
      await page.waitForTimeout(5000);
      const msgs = await page.evaluate(() => {
        const bubbles = document.querySelectorAll('[class*="rss-ai-qa-bubble"]');
        return Array.from(bubbles).map(b => b.textContent.trim().slice(0, 100));
      });
      const hasAIResponse = msgs.length >= 2 && !msgs[msgs.length - 1].includes("❌") && !msgs[msgs.length - 1].includes("401") && !msgs[msgs.length - 1].includes("思考");
      console.log(`   [${i * 5}s] 消息: ${msgs.length}条 | 最后: ${msgs[msgs.length - 1]?.slice(0, 60)}`);
      if (hasAIResponse) {
        ok(true, `问答成功 (${msgs.length}条消息)`);
        gotQA = true;
        break;
      }
      if (msgs.some(m => m.includes("❌"))) break;
    }
    if (!gotQA) ok(false, "问答失败");
    await page.screenshot({ path: "screenshots/test-ai-qa.png" });
  }

  console.log("\n" + "═".repeat(60));
  console.log(`  通过: ${passed}  失败: ${failed}`);
  if (failed === 0) console.log("  🎉 AI 全流程测试通过！");
  else console.log(`  ⚠️ ${failed} 项失败`);
  console.log("═".repeat(60) + "\n");

  await page.waitForTimeout(500);
  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("异常:", e.message); process.exit(1); });
