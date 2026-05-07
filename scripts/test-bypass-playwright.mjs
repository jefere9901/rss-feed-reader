import { chromium } from "playwright";

async function main() {
  let browser;
  try { browser = await chromium.launch({ headless: false, args: ["--window-size=1400,900", "--no-sandbox"] }); }
  catch { browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--window-size=1400,900", "--no-sandbox"] }); }

  const ctx = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await ctx.newPage();

  console.log("📍 打开思源笔记...");
  await page.goto("http://localhost:6806", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(4000);

  // Wait for RSS widget to load
  for (let i = 0; i < 6; i++) {
    const loaded = await page.evaluate(() => {
      const w = document.querySelector('[class*="rss-widget"]');
      return !!(w && w.textContent && w.textContent.length > 100);
    });
    if (loaded) break;
    await page.waitForTimeout(2000);
  }

  // ============================================================
  // STEP 1: Navigate to Settings tab
  // ============================================================
  console.log("\n📋 Step 1: 切换到设置 Tab...");
  const inSettings = await page.evaluate(() => {
    for (const b of document.querySelectorAll("button")) {
      if (b.textContent.includes("设置") || b.textContent.includes("⚙")) {
        b.click();
        return true;
      }
    }
    return false;
  });
  console.log(`   设置Tab: ${inSettings ? "✅" : "❌"}`);
  await page.waitForTimeout(1000);

  // ============================================================
  // STEP 2: Find and click the 「+ 添加订阅」button
  // ============================================================
  console.log("\n📋 Step 2: 点击「+ 添加订阅」...");
  let formVisible = await page.evaluate(() => {
    if (document.querySelector("#rss-url-input")) return true;
    for (const b of document.querySelectorAll("button")) {
      if (b.textContent.includes("添加订阅")) { b.click(); return true; }
    }
    return false;
  });
  console.log(`   表单出现: ${formVisible ? "✅" : "❌"}`);
  await page.waitForTimeout(600);

  // ============================================================
  // STEP 3: Fill NYT RSS URL
  // ============================================================
  const NYT_RSS = "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml";
  console.log(`\n📋 Step 3: 填入 NYT RSS URL...`);
  console.log(`   URL: ${NYT_RSS}`);

  const input = page.locator("#rss-url-input");
  if (await input.count() > 0) {
    await input.fill(NYT_RSS);
    await page.waitForTimeout(300);
    const val = await input.inputValue();
    console.log(`   填充结果: ${val === NYT_RSS ? "✅" : "❌ " + val.slice(0, 40)}`);
  }

  // ============================================================
  // STEP 4: Enable bypass in settings
  // ============================================================
  console.log("\n📋 Step 4: 查找并开启「付费墙绕过」开关...");

  // First collapse any open "通用设置" to find bypass toggle
  let bypassToggle = await page.evaluate(() => {
    // Look for the bypass toggle
    const toggles = document.querySelectorAll('[class*="rss-toggle"]');
    return toggles.length;
  });
  console.log(`   找到 toggle 元素: ${bypassToggle} 个`);

  // Expand the 通用设置 section if collapsed
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('[class*="rss-settings-collapse-header"]')) {
      if (el.textContent.includes("通用设置")) {
        el.click();
        return;
      }
    }
  });
  await page.waitForTimeout(500);

  // Now toggle bypass ON
  let bypassActivated = await page.evaluate(() => {
    for (const row of document.querySelectorAll('[class*="rss-setting-row"]')) {
      const label = row.querySelector('[class*="rss-setting-label"]');
      if (label && label.textContent.includes("付费墙")) {
        const toggle = row.querySelector('[class*="rss-toggle"]');
        if (toggle) {
          const wasActive = toggle.classList.contains("active");
          if (!wasActive) toggle.click();
          return { found: true, wasActive };
        }
      }
    }
    return { found: false };
  });
  console.log(`   绕过开关: ${bypassActivated.found ? `✅ (之前${bypassActivated.wasActive ? "已开启" : "已关闭"}，现已开启)` : "❌ 未找到"}`);
  await page.waitForTimeout(500);

  // ============================================================
  // STEP 5: Click 「检测并添加」
  // ============================================================
  console.log("\n📋 Step 5: 点击「检测并添加」...");
  const detectBtn = page.locator("#rss-add-detect");
  if (await detectBtn.count() > 0) {
    await detectBtn.click();
    console.log("   等待检测结果 (最多15秒)...");

    // Wait for result
    await page.waitForTimeout(15000);

    const feedback = await page.evaluate(() => {
      const fb = document.querySelector('[class*="rss-detect-result"]');
      return fb ? fb.textContent.trim().slice(0, 200) : "(表单已关闭=成功)";
    });
    console.log(`   检测反馈: ${feedback}`);

    const isSuccess = feedback.includes("✅") || feedback.includes("(表单已关闭=成功)");
    console.log(`   结果: ${isSuccess ? "✅ 成功添加" : "⚠️ " + feedback}`);
  } else {
    console.log("   ❌ 未找到检测按钮");
  }

  // Screenshot
  await page.screenshot({ path: "screenshots/bypass-nyt-test.png" });
  console.log("\n📸 截图已保存: screenshots/bypass-nyt-test.png");

  // ============================================================
  // STEP 6: Switch back to Feed tab and verify
  // ============================================================
  console.log("\n📋 Step 6: 切回订阅 Tab 验证...");
  await page.evaluate(() => {
    for (const b of document.querySelectorAll("button")) {
      if (b.textContent.includes("阅") || b.textContent.includes("📰")) {
        b.click(); return;
      }
    }
  });
  await page.waitForTimeout(3000);

  // Dump full feed area for debugging
  const feedDebug = await page.evaluate(() => {
    const widget = document.querySelector('[class*="rss-widget"]');
    if (!widget) return "widget not found";
    const content = widget.querySelector('[class*="rss-content"]');
    if (!content) return "content area not found, widget: " + widget.innerHTML.slice(0, 300);
    return "content HTML: " + content.innerHTML.slice(0, 600);
  });
  console.log(`   Feed区域: ${feedDebug.slice(0, 500)}`);

  const feedNames = await page.evaluate(() => {
    const names = document.querySelectorAll('[class*="rss-feed-name"]');
    return Array.from(names).map(e => e.textContent.trim());
  });
  console.log(`   订阅列表: ${JSON.stringify(feedNames)}`);

  const nytFound = feedNames.some(n => n.toLowerCase().includes("nyt") || n.toLowerCase().includes("technology"));
  console.log(`   NYT订阅: ${nytFound ? "✅ 已出现" : "⚠️ 未找到"}`);

  // Final screenshot
  await page.screenshot({ path: "screenshots/bypass-nyt-final.png" });
  console.log("📸 最终截图: screenshots/bypass-nyt-final.png");

  console.log("\n" + "═".repeat(50));
  console.log("🏁 测试完成");
  if (nytFound) console.log("✅ NYT RSS 绕过测试通过!");
  else console.log("⚠️ 部分步骤未完成，请检查截图");

  await page.waitForTimeout(2000);
  await browser.close();
}

main().catch(e => {
  console.error("测试异常:", e.message);
  process.exit(1);
});
