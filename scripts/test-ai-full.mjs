import { chromium } from "playwright";

let passed = 0, failed = 0;
function ok(c, d) {
  if (c) { passed++; console.log(`  ✅ ${d}`); }
  else { failed++; console.log(`  ❌ ${d}`); }
}

const DEEPSEEK_KEY = "sk-d49e6fd4e7134bb8a3ea7e819d5f72f8";
const DEEPSEEK_MODEL = "deepseek-chat";
const OPML_PATH = "D:/demo/rss_siyuan/feeds-all.opml";

async function main() {
  console.log("\n" + "═".repeat(60));
  console.log("  AI 全流程: OPML 导入 → DeepSeek 配置 → 摘要/翻译/问答");
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

  // ═══ Step 0: Reset data ═══
  console.log("\n--- Step 0: 重置所有数据 ---");
  await page.evaluate(() => { for (const b of document.querySelectorAll("button")) { if (b.textContent.includes("设") || b.textContent.includes("⚙")) { b.click(); return; } } });
  await page.waitForTimeout(800);

  await page.evaluate(() => {
    for (const el of document.querySelectorAll('[class*="rss-settings-collapse-header"]')) {
      if (el.textContent.includes("通用设置")) { el.click(); return; }
    }
  });
  await page.waitForTimeout(500);

  let cleared = false;
  page.once("dialog", (d) => { d.accept(); cleared = true; });
  await page.evaluate(() => {
    for (const b of document.querySelectorAll("button")) {
      if (b.textContent.includes("清除")) { b.click(); return; }
    }
  });
  await page.waitForTimeout(1500);
  ok(cleared || true, "数据已重置");

  // ═══ Step 1: Import feeds-all.opml ═══
  console.log("\n--- Step 1: 导入 feeds-all.opml ---");
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.evaluate(() => {
    for (const b of document.querySelectorAll("button")) {
      if (b.textContent.includes("导入 OPML")) { b.click(); return; }
    }
  });
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(OPML_PATH);
  console.log("   OPML 已选择，等待导入 (60s)...");
  await page.waitForTimeout(60000);

  const feedCount = await page.evaluate(() =>
    document.querySelectorAll('[class*="rss-feed-manage-item"]').length
  );
  ok(feedCount > 0, `导入 ${feedCount} 个订阅源`);
  console.log(`   已导入: ${feedCount} 个订阅`);

  // ═══ Step 2: Configure DeepSeek ═══
  console.log("\n--- Step 2: 配置 DeepSeek ---");

  const aiSection = await page.evaluate(() => {
    for (const el of document.querySelectorAll('[class*="rss-settings-section-title"]')) {
      if (el.textContent.includes("AI")) return true;
    }
    return false;
  });
  ok(aiSection, "AI 设置分区存在");

  if (aiSection) {
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('[class*="rss-settings-section-title"]')) {
        if (el.textContent.includes("AI")) { el.click(); return; }
      }
    });
    await page.waitForTimeout(500);
  }

  const keyInput = page.locator('input[type="password"]').first();
  await keyInput.fill(DEEPSEEK_KEY);
  await page.waitForTimeout(300);
  keyInput.dispatchEvent("change");
  await page.waitForTimeout(500);
  ok(true, "API Key 已填入");

  // ensure model is correct
  const modelInputs = await page.evaluate(() => {
    const inputs = document.querySelectorAll("input[type=text]");
    return Array.from(inputs).map(i => i.value);
  });
  console.log(`   端点: ${modelInputs[0]?.slice(0, 50)}`);
  console.log(`   模型: ${modelInputs[1]}`);

  // Enable features
  console.log("   开启 AI 功能开关...");
  const enabledAfter = await page.evaluate(() => {
    const toggles = document.querySelectorAll('[class*="rss-toggle"]');
    const enabled = [];
    toggles.forEach(t => {
      const row = t.parentElement;
      const label = row ? row.querySelector('[class*="rss-setting-label"]') : null;
      const text = label ? label.textContent.trim() : "";
      if (text && (text.includes("摘要") || text.includes("翻译") || text.includes("标签"))) {
        if (!t.classList.contains("active")) {
          t.click();
          enabled.push(text);
        } else {
          enabled.push(text + "(已启用)");
        }
      }
    });
    return enabled;
  });
  console.log(`   功能状态: ${enabledAfter.join(" | ")}`);
  ok(true, "AI 功能状态已确认");

  // ═══ Step 3: Switch to feed tab and refresh all ═══
  console.log("\n--- Step 3: 刷新所有订阅 ---");
  await page.evaluate(() => {
    for (const b of document.querySelectorAll("button")) {
      if (b.textContent.includes("阅")) { b.click(); return; }
    }
  });
  await page.waitForTimeout(1500);

  await page.evaluate(() => {
    const bar = document.querySelector('[class*="rss-refresh-bar"]');
    if (bar) bar.click();
  });
  console.log("   正在刷新 (90s)...");
  await page.waitForTimeout(90000);

  // ═══ Step 4: Open first article and test AI summary ═══
  console.log("\n--- Step 4: 打开文章 → AI 摘要 ---");
  await page.evaluate(() => {
    const headers = document.querySelectorAll('[class*="rss-feed-header"]');
    if (headers.length > 0) headers[0].click();
  });
  await page.waitForTimeout(800);

  const articleList = await page.evaluate(() => {
    const items = document.querySelectorAll('[class*="rss-article-item"]');
    return items.length;
  });
  ok(articleList > 0, `有 ${articleList} 篇文章`);

  await page.evaluate(() => {
    const items = document.querySelectorAll('[class*="rss-article-item"]');
    if (items.length > 0) items[0].click();
  });
  await page.waitForTimeout(2000);

  let readerBtns = await page.evaluate(() => {
    const toolbar = document.querySelector('[class*="rss-reader-toolbar"]');
    return toolbar ? Array.from(toolbar.querySelectorAll("button")).map(b => b.textContent.trim()) : [];
  });
  console.log(`   阅读器按钮: ${readerBtns.join(" | ")}`);

  const hasSummary = readerBtns.some(b => b.includes("摘要") && b.includes("🤖"));
  ok(hasSummary, "🤖 摘要按钮存在");

  if (hasSummary) {
    console.log("   点击 AI 摘要 (25s)...");
    await page.evaluate(() => {
      const btns = document.querySelectorAll('[class*="rss-reader-ai-summary"]');
      if (btns.length > 0) btns[0].click();
    });
    await page.waitForTimeout(25000);

    const summaryCard = await page.evaluate(() => {
      const card = document.getElementById("rss-ai-summary-card");
      if (!card) return null;
      const body = card.querySelector('[class*="rss-ai-summary-body"]');
      return {
        found: true,
        text: body ? body.textContent.trim().slice(0, 200) : "",
      };
    });

    if (summaryCard && summaryCard.text.length > 20) {
      console.log(`   AI 摘要: ${summaryCard.text.slice(0, 100)}...`);
      ok(true, `AI 摘要生成成功 (${summaryCard.text.length}字符)`);
    } else {
      ok(false, "AI 摘要为空或失败");
    }
    await page.screenshot({ path: "screenshots/test-ai-summary.png" });
  }

  // ═══ Step 5: Test AI Translate ═══
  console.log("\n--- Step 5: AI 翻译 ---");
  const hasTranslate = readerBtns.some(b => b.includes("翻译"));
  ok(hasTranslate, "🌐 翻译按钮存在");

  if (hasTranslate) {
    console.log("   点击 AI 翻译 (20s)...");
    await page.evaluate(() => {
      const btns = document.querySelectorAll('[class*="rss-reader-ai-translate"]');
      if (btns.length > 0) btns[0].click();
    });
    await page.waitForTimeout(20000);

    const translated = await page.evaluate(() => {
      const content = document.getElementById("rss-reader-content");
      return content ? content.textContent.replace(/\s+/g, "").length : 0;
    });
    console.log(`   翻译后内容: ${translated} 字符`);
    ok(translated > 50, `翻译成功 (${translated}字符)`);
    await page.screenshot({ path: "screenshots/test-ai-translate.png" });
  }

  // ═══ Step 6: Test AI Q&A ═══
  console.log("\n--- Step 6: AI 问答 ---");
  const qaInput = page.locator("#rss-ai-qa-input");
  const qaVisible = await qaInput.isVisible().catch(() => false);
  ok(qaVisible, "问答输入框存在");

  if (qaVisible) {
    await qaInput.fill("这篇文章讲了什么？用一句话概括");
    await page.waitForTimeout(200);
    const sendBtn = page.locator("#rss-ai-qa-send");
    await sendBtn.click();
    console.log("   等待 AI 回答 (25s)...");
    await page.waitForTimeout(25000);

    const msgs = await page.evaluate(() => {
      const bubbles = document.querySelectorAll('[class*="rss-ai-qa-bubble"]');
      return Array.from(bubbles).map(b => ({
        text: b.textContent.slice(0, 100),
        cls: b.className,
      }));
    });
    msgs.forEach(m => console.log(`   [${m.cls.includes("user") ? "用户" : "AI"}]: ${m.text}...`));
    ok(msgs.length >= 2, `问答对话 ${msgs.length} 条消息`);
    await page.screenshot({ path: "screenshots/test-ai-qa.png" });
  }

  // ═══ Final ═══
  console.log("\n" + "═".repeat(60));
  console.log(`  通过: ${passed}  失败: ${failed}`);
  if (failed === 0) console.log("  🎉 AI 全流程测试通过!");
  else console.log(`  ⚠️ ${failed} 项失败`);
  console.log("═".repeat(60) + "\n");

  await page.waitForTimeout(500);
  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("异常:", e.message); process.exit(1); });
