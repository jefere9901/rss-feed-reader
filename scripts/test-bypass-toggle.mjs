import { chromium } from "playwright";

const P = "✅", F = "❌";

async function main() {
  console.log("\n" + "=".repeat(55));
  console.log("  Playwright E2E: 付费墙绕过开关 开启/关闭 功能测试");
  console.log("=".repeat(55) + "\n");

  let browser;
  try {
    browser = await chromium.launch({ headless: false, args: ["--window-size=1400,900", "--no-sandbox"] });
  } catch {
    browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--window-size=1400,900", "--no-sandbox"] });
  }
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true })).newPage();

  let passed = 0, failed = 0;
  function ok(c, d) {
    if (c) { passed++; console.log(`  ${P} ${d}`); }
    else { failed++; console.log(`  ${F} ${d}`); }
  }

  await page.goto("http://localhost:6806", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(4000);

  // ---- Wait for RSS dock ----
  console.log("--- 0. 等待 RSS 插件加载 ---");
  for (let i = 0; i < 6; i++) {
    const w = await page.evaluate(() => {
      const el = document.querySelector('[class*="rss-widget"]');
      return !!(el && el.textContent && el.textContent.length > 100);
    });
    if (w) break;
    await page.waitForTimeout(2000);
  }
  ok(await page.evaluate(() => !!document.querySelector('[class*="rss-widget"]')), "RSS Dock 就绪");

  // ---- Switch to settings tab ----
  console.log("\n--- 1. 切换到设置 Tab ---");
  const inSettings = await page.evaluate(() => {
    for (const b of document.querySelectorAll("button")) {
      if (b.textContent.includes("设") || b.textContent.includes("⚙")) { b.click(); return true; }
    }
    return false;
  });
  ok(inSettings, "已切换到设置Tab");
  await page.waitForTimeout(1000);

  // ---- Expand 通用设置 if collapsed ----
  console.log("\n--- 2. 确保「通用设置」已展开 ---");
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('[class*="rss-settings-collapse-header"]')) {
      if (el.textContent.includes("通用设置")) {
        el.click();
        return;
      }
    }
  });
  await page.waitForTimeout(600);

  // ---- Find bypass toggle ----
  console.log("\n--- 3. 定位「付费墙绕过」开关 ---");
  const toggleInfo = await page.evaluate(() => {
    for (const row of document.querySelectorAll('[class*="rss-setting-row"]')) {
      const label = row.querySelector('[class*="rss-setting-label"]');
      if (label && label.textContent.includes("付费墙")) {
        const toggle = row.querySelector('[class*="rss-toggle"]');
        const desc = row.querySelector('[class*="rss-setting-desc"]');
        return {
          found: true,
          labelText: label.textContent.trim(),
          descText: desc ? desc.textContent.trim() : "",
          isActive: toggle ? toggle.classList.contains("active") : null,
          title: toggle ? toggle.getAttribute("title") : null,
          hasToggle: !!toggle,
        };
      }
    }
    return { found: false };
  });

  ok(toggleInfo.found, "找到 '付费墙绕过' 设置行");
  console.log(`    标签: ${toggleInfo.labelText}`);
  console.log(`    描述: ${toggleInfo.descText}`);
  console.log(`    toggle元素: ${toggleInfo.hasToggle ? "" : ""}`);

  // ---- Test 1: default state = OFF ----
  console.log("\n--- Test A: 默认状态应为 OFF (无 active 类) ---");
  ok(toggleInfo.isActive === false, `开关默认关闭 (active=${toggleInfo.isActive})`);
  ok(toggleInfo.title === "已关闭：普通模式", `tooltip 显示"已关闭：普通模式" (实际: "${toggleInfo.title}")`);

  // ---- Test 2: Click to turn ON ----
  console.log("\n--- Test B: 点击开关 → 开启 ---");
  const clickedOn = await page.evaluate(() => {
    for (const row of document.querySelectorAll('[class*="rss-setting-row"]')) {
      const label = row.querySelector('[class*="rss-setting-label"]');
      if (label && label.textContent.includes("付费墙")) {
        const toggle = row.querySelector('[class*="rss-toggle"]');
        if (toggle) { toggle.click(); return true; }
      }
    }
    return false;
  });
  ok(clickedOn, "已点击开关");
  await page.waitForTimeout(500);

  // Verify ON state
  const afterOn = await page.evaluate(() => {
    for (const row of document.querySelectorAll('[class*="rss-setting-row"]')) {
      const label = row.querySelector('[class*="rss-setting-label"]');
      if (label && label.textContent.includes("付费墙")) {
        const toggle = row.querySelector('[class*="rss-toggle"]');
        return {
          isActive: toggle ? toggle.classList.contains("active") : null,
          title: toggle ? toggle.getAttribute("title") : null,
        };
      }
    }
    return { isActive: null };
  });
  ok(afterOn.isActive === true, `开关已开启 (active=${afterOn.isActive})`);
  ok(afterOn.title === "已启用：使用搜索引擎身份绕过付费墙", `tooltip 变为"已启用" (实际: "${afterOn.title?.slice(0, 20)}...")`);

  // Screenshot: ON state
  await page.screenshot({ path: "screenshots/bypass-toggle-on.png" });
  console.log("   📸 截图: screenshots/bypass-toggle-on.png");

  // ---- Test 3: Click to turn OFF ----
  console.log("\n--- Test C: 再次点击 → 关闭 ---");
  const clickedOff = await page.evaluate(() => {
    for (const row of document.querySelectorAll('[class*="rss-setting-row"]')) {
      const label = row.querySelector('[class*="rss-setting-label"]');
      if (label && label.textContent.includes("付费墙")) {
        const toggle = row.querySelector('[class*="rss-toggle"]');
        if (toggle) { toggle.click(); return true; }
      }
    }
    return false;
  });
  ok(clickedOff, "已点击开关");
  await page.waitForTimeout(500);

  // Verify OFF state
  const afterOff = await page.evaluate(() => {
    for (const row of document.querySelectorAll('[class*="rss-setting-row"]')) {
      const label = row.querySelector('[class*="rss-setting-label"]');
      if (label && label.textContent.includes("付费墙")) {
        const toggle = row.querySelector('[class*="rss-toggle"]');
        return {
          isActive: toggle ? toggle.classList.contains("active") : null,
          title: toggle ? toggle.getAttribute("title") : null,
        };
      }
    }
    return { isActive: null };
  });
  ok(afterOff.isActive === false, `开关已关闭 (active=${afterOff.isActive})`);
  ok(afterOff.title === "已关闭：普通模式", `tooltip 恢复"已关闭" (实际: "${afterOff.title}")`);

  // Screenshot: OFF state
  await page.screenshot({ path: "screenshots/bypass-toggle-off.png" });
  console.log("   📸 截图: screenshots/bypass-toggle-off.png");

  // ---- Test 4: Toggle ON, collapse section, re-expand → still ON? ----
  console.log("\n--- Test D: 开启 → 折叠通用设置 → 展开 → 仍为开启? ---");

  // Turn ON
  await page.evaluate(() => {
    for (const row of document.querySelectorAll('[class*="rss-setting-row"]')) {
      const label = row.querySelector('[class*="rss-setting-label"]');
      if (label && label.textContent.includes("付费墙")) {
        const toggle = row.querySelector('[class*="rss-toggle"]');
        if (toggle && !toggle.classList.contains("active")) { toggle.click(); }
        return;
      }
    }
  });
  await page.waitForTimeout(400);

  // Collapse 通用设置
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('[class*="rss-settings-collapse-header"]')) {
      if (el.textContent.includes("通用设置")) { el.click(); return; }
    }
  });
  await page.waitForTimeout(400);

  // Re-expand
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('[class*="rss-settings-collapse-header"]')) {
      if (el.textContent.includes("通用设置")) { el.click(); return; }
    }
  });
  await page.waitForTimeout(400);

  // Verify still ON
  const persistState = await page.evaluate(() => {
    for (const row of document.querySelectorAll('[class*="rss-setting-row"]')) {
      const label = row.querySelector('[class*="rss-setting-label"]');
      if (label && label.textContent.includes("付费墙")) {
        const toggle = row.querySelector('[class*="rss-toggle"]');
        return {
          isActive: toggle ? toggle.classList.contains("active") : null,
          title: toggle ? toggle.getAttribute("title") : null,
        };
      }
    }
    return { isActive: null };
  });
  ok(persistState.isActive === true, `折叠后展开仍为开启 (active=${persistState.isActive})`);
  ok(persistState.title === "已启用：使用搜索引擎身份绕过付费墙", `tooltip 仍为"已启用" (实际: "${persistState.title?.slice(0, 20)}...")`);

  // Screenshot: persist after collapse/expand
  await page.screenshot({ path: "screenshots/bypass-toggle-persist.png" });
  console.log("   📸 截图: screenshots/bypass-toggle-persist.png");

  // ---- Summary ----
  console.log("\n" + "═".repeat(55));
  console.log(`  通过: ${passed}  失败: ${failed}`);
  if (failed === 0) {
    console.log("  ALL 测试通过 ✅");
  } else {
    console.log(`  ${failed} 个测试失败 ❌`);
  }
  console.log("═".repeat(55) + "\n");

  await page.waitForTimeout(1000);
  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error("测试异常:", e.message);
  process.exit(1);
});
