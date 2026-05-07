import { chromium } from "playwright";

const P = "✅", F = "❌";

async function main() {
  console.log("\n" + "=".repeat(55));
  console.log("  Playwright E2E: 设置页折叠/展开功能测试");
  console.log("=".repeat(55) + "\n");

  let browser;
  try {
    browser = await chromium.launch({ headless: false, args: ["--window-size=1400,900", "--no-sandbox"] });
  } catch {
    browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--window-size=1400,900", "--no-sandbox"] });
  }
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true })).newPage();

  await page.goto("http://localhost:6806", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(4000);

  let passed = 0, failed = 0;
  function ok(c, d) { if (c) { passed++; console.log(`  ${P} ${d}`); } else { failed++; console.log(`  ${F} ${d}`); } }

  // Wait for dock
  for (let i = 0; i < 6; i++) {
    let w = await page.evaluate(() => {
      let w = document.querySelector('[class*="rss-widget"]');
      return !!(w && w.textContent && w.textContent.length > 100);
    });
    if (w) break;
    await page.waitForTimeout(2000);
  }
  ok(await page.evaluate(() => !!document.querySelector('[class*="rss-widget"]')), "RSS Dock 就绪");

  // Switch to settings tab
  console.log("\n--- 切换到设置Tab ---");
  await page.evaluate(() => {
    let w = document.querySelector('[class*="rss-widget"]');
    for (let b of w.querySelectorAll('button')) {
      if (b.textContent.includes('设') || b.textContent.includes('⚙')) { b.click(); return; }
    }
  });
  await page.waitForTimeout(800);

  // Check initial state
  let checkState = await page.evaluate(() => {
    let headers = document.querySelectorAll('[class*="rss-settings-collapse-header"]');
    let bodies = document.querySelectorAll('[class*="rss-settings-collapse-body"]');
    return {
      headerCount: headers.length,
      bodyCount: bodies.length,
      headers: Array.from(headers).map(h => ({
        text: h.textContent.trim().slice(0, 20),
        hasArrow: h.querySelector('[class*="arrow"]') !== null,
      })),
      bodies: Array.from(bodies).map(b => ({
        collapsed: b.classList.contains('collapsed'),
        hasCard: b.querySelector('[class*="rss-settings-card"]') !== null,
      })),
    };
  });
  console.log(`  Headers: ${checkState.headerCount}, Bodies: ${checkState.bodyCount}`);
  ok(checkState.headerCount === 2, `找到 2 个折叠标题 (实际 ${checkState.headerCount})`);
  ok(checkState.bodyCount === 2, `找到 2 个折叠体 (实际 ${checkState.bodyCount})`);
  checkState.headers.forEach(h => console.log(`    ${h.hasArrow ? P : F} "${h.text}" arrow=${h.hasArrow}`));
  checkState.bodies.forEach(b => console.log(`    ${b.collapsed ? F : P} collapsed=${b.collapsed} card=${b.hasCard}`));

  // Verify initial expanded state
  let allExpanded = checkState.bodies.every(b => !b.collapsed && b.hasCard);
  ok(allExpanded, "初始状态：两个区域均展开");

  // ==========================================================
  // Test 1: Collapse "订阅管理"
  // ==========================================================
  console.log("\n--- Test 1: 折叠「订阅管理」---");
  let collapsed = await page.evaluate(() => {
    let headers = document.querySelectorAll('[class*="rss-settings-collapse-header"]');
    for (let h of headers) {
      if (h.textContent.includes('个订阅')) {
        h.click();
        return true;
      }
    }
    return false;
  });
  await page.waitForTimeout(600);
  ok(collapsed, "已点击「订阅管理」标题");

  // Verify collapsed
  let afterCollapse1 = await page.evaluate(() => {
    let bodies = document.querySelectorAll('[class*="rss-settings-collapse-body"]');
    return Array.from(bodies).map((b, i) => ({
      idx: i,
      collapsed: b.classList.contains('collapsed'),
    }));
  });
  let feedMgmtCollapsed = afterCollapse1.some(b => b.collapsed);
  ok(feedMgmtCollapsed, "订阅管理区域已折叠 (含 collapsed class)");

  await page.screenshot({ path: "screenshots/settings-collapsed.png" });
  console.log("  截图: screenshots/settings-collapsed.png");

  // ==========================================================
  // Test 2: Expand "订阅管理" again
  // ==========================================================
  console.log("\n--- Test 2: 展开「订阅管理」---");
  let expanded = await page.evaluate(() => {
    let headers = document.querySelectorAll('[class*="rss-settings-collapse-header"]');
    for (let h of headers) {
      if (h.textContent.includes('个订阅')) {
        h.click();
        return true;
      }
    }
    return false;
  });
  await page.waitForTimeout(600);
  ok(expanded, "再次点击「订阅管理」标题");

  let afterExpand1 = await page.evaluate(() => {
    let bodies = document.querySelectorAll('[class*="rss-settings-collapse-body"]');
    return Array.from(bodies).every(b => !b.classList.contains('collapsed'));
  });
  ok(afterExpand1, "订阅管理区域已重新展开");

  // ==========================================================
  // Test 3: Collapse "通用设置"
  // ==========================================================
  console.log("\n--- Test 3: 折叠「通用设置」---");
  let collapsed2 = await page.evaluate(() => {
    let headers = document.querySelectorAll('[class*="rss-settings-collapse-header"]');
    for (let h of headers) {
      if (h.textContent.includes('通用设置')) {
        h.click();
        return true;
      }
    }
    return false;
  });
  await page.waitForTimeout(600);
  ok(collapsed2, "已点击「通用设置」标题");

  let afterCollapse2 = await page.evaluate(() => {
    let bodies = document.querySelectorAll('[class*="rss-settings-collapse-body"]');
    let states = Array.from(bodies).map(b => b.classList.contains('collapsed'));
    let generalBody = document.querySelector('[class*="rss-settings-card"]');
    return { states, generalVisible: generalBody ? generalBody.offsetParent !== null : false };
  });
  ok(afterCollapse2.states.filter(Boolean).length >= 1 || !afterCollapse2.generalVisible,
     "通用设置区域已折叠");

  await page.screenshot({ path: "screenshots/settings-general-collapsed.png" });

  // ==========================================================
  // Test 4: Both expanded again (end state)
  // ==========================================================
  console.log("\n--- Test 4: 全部展开 ---");
  await page.evaluate(() => {
    let headers = document.querySelectorAll('[class*="rss-settings-collapse-header"]');
    for (let h of headers) {
      if (h.textContent.includes('通用设置')) h.click();
    }
  });
  await page.waitForTimeout(400);

  let finalAllExpanded = await page.evaluate(() => {
    let bodies = document.querySelectorAll('[class*="rss-settings-collapse-body"]');
    return Array.from(bodies).every(b => !b.classList.contains('collapsed'));
  });
  ok(finalAllExpanded, "最终状态：所有区域展开");

  await page.screenshot({ path: "screenshots/settings-all-expanded.png" });
  console.log("  截图: screenshots/settings-all-expanded.png");

  // ==========================================================
  // Test 5: Arrow indicator changes
  // ==========================================================
  console.log("\n--- Test 5: 箭头指示器切换 ---");
  let arrowTest = await page.evaluate(() => {
    let headers = document.querySelectorAll('[class*="rss-settings-collapse-header"]');
    let results = [];
    for (let h of headers) {
      let arrow = h.querySelector('[class*="rss-settings-arrow"]');
      if (arrow) {
        let text = arrow.textContent.trim();
        results.push({ text: h.textContent.trim().slice(0, 18), arrow: text });
      }
    }
    return results;
  });
  arrowTest.forEach(a => console.log(`  "${a.text}" arrow=${a.arrow}`));
  let allArrowsCorrect = arrowTest.every(a => a.arrow === "▼");
  ok(allArrowsCorrect, "展开状态箭头为 ▼");

  console.log("\n所有截图:");
  console.log("  screenshots/settings-collapsed.png");
  console.log("  screenshots/settings-general-collapsed.png");
  console.log("  screenshots/settings-all-expanded.png");

  // Report
  console.log("\n" + "=".repeat(55));
  let total = passed + failed;
  console.log(`  结果: ${passed}/${total} 通过, ${failed} 失败`);
  console.log(failed === 0 ? `  ${P}${P}${P} 全部通过!` : `  ⚠️ ${failed} 项失败`);
  console.log("=".repeat(55));

  console.log("\n浏览器保持 5 秒...");
  await page.waitForTimeout(5000);
  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
}
main();
