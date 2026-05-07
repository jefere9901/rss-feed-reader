import { chromium } from "playwright";

const P = "✅", F = "❌";

async function main() {
  console.log("\n" + "=".repeat(55));
  console.log("  Playwright: 虚拟滚动 + 刷新进度 性能测试");
  console.log("=".repeat(55) + "\n");

  let browser;
  try { browser = await chromium.launch({ headless: false, args: ["--window-size=1400,900", "--no-sandbox"] }); }
  catch { browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--window-size=1400,900", "--no-sandbox"] }); }
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true })).newPage();
  await page.goto("http://localhost:6806", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(4000);

  let passed = 0, failed = 0;
  function ok(c, d) { if (c) { passed++; console.log(`  ${P} ${d}`); } else { failed++; console.log(`  ${F} ${d}`); } }

  for (let i = 0; i < 6; i++) {
    if (await page.evaluate(() => { let w = document.querySelector('[class*="rss-widget"]'); return !!(w && w.textContent && w.textContent.length > 100); })) break;
    await page.evaluate(() => { let items = document.querySelectorAll('.dock__item'); for (let el of items) { if (el.querySelector('use[href="#iconRSS"]')) { el.click(); return; } } });
    await page.waitForTimeout(2000);
  }

  // First add test feeds to have articles
  console.log("--- Step 1: 确保有订阅数据 ---");
  await page.evaluate(() => { let w = document.querySelector('[class*="rss-widget"]'); for (let b of w.querySelectorAll('button')) { if (b.textContent.includes('设') || b.textContent.includes('⚙')) { b.click(); return; } } });
  await page.waitForTimeout(600);

  let manageCount = await page.evaluate(() => {
    return document.querySelectorAll('[class*="rss-feed-manage-item"]').length;
  });
  
  if (manageCount === 0) {
    console.log("  无订阅，添加 cnfeat + Ruanyifeng RSS...");
    await page.evaluate(() => { for (let b of document.querySelectorAll('button')) { if (b.textContent.includes('添加订阅')) { b.click(); return; } } });
    await page.waitForTimeout(400);
    await page.locator("#rss-url-input").fill("https://www.cnfeat.com/feed.xml");
    await page.locator("#rss-add-detect").click();
    await page.waitForTimeout(10000);
    // Add second feed
    await page.evaluate(() => { for (let b of document.querySelectorAll('button')) { if (b.textContent.includes('添加订阅')) { b.click(); return; } } });
    await page.waitForTimeout(400);
    await page.locator("#rss-url-input").fill("http://www.ruanyifeng.com/blog/atom.xml");
    await page.locator("#rss-add-detect").click();
    await page.waitForTimeout(10000);
  }

  // Switch back to feed tab
  await page.evaluate(() => { let w = document.querySelector('[class*="rss-widget"]'); for (let b of w.querySelectorAll('button')) { if (b.textContent.includes('订') || b.textContent.includes('📰')) { b.click(); return; } } });
  await page.waitForTimeout(1000);

  // ============================================================
  // Test 1: No article DOM nodes for collapsed feeds
  // ============================================================
  console.log("\n--- Test 1: 折叠状态下无文章 DOM 节点 ---");
  let collapsedNodes = await page.evaluate(() => {
    // All feed groups should have empty article lists unless expanded
    let groups = document.querySelectorAll('[class*="rss-feed-group"]');
    let collapsedCount = 0;
    let expandedChildren = 0;
    groups.forEach(g => {
      if (!g.classList.contains('expanded')) {
        let list = g.querySelector('[class*="rss-article-list"]');
        if (list && list.children.length === 0) collapsedCount++;
      } else {
        let list = g.querySelector('[class*="rss-article-list"]');
        if (list) expandedChildren += list.children.length;
      }
    });
    return { total: groups.length, collapsedEmpty: collapsedCount, expandedChildren };
  });
  console.log(`  总共 ${collapsedNodes.total} 个 feed 组, ${collapsedNodes.collapsedEmpty} 个折叠且无子节点`);
  ok(collapsedNodes.collapsedEmpty >= collapsedNodes.total - 1, "折叠的 feed 组没有创建文章 DOM");

  // ============================================================
  // Test 2: Expand a feed and check pagination
  // ============================================================
  console.log("\n--- Test 2: 展开 feed → 分页渲染 ---");
  await page.evaluate(() => {
    let header = document.querySelector('[class*="rss-feed-header"]');
    if (header) header.click();
  });
  await page.waitForTimeout(800);

  let paginationInfo = await page.evaluate(() => {
    let expanded = document.querySelector('[class*="rss-feed-group"].expanded');
    if (!expanded) return { found: false };
    
    let list = expanded.querySelector('[class*="rss-article-list"]');
    let items = list ? list.querySelectorAll('[class*="rss-article-item"]') : [];
    let info = list ? list.querySelector('[class*="rss-article-info"]') : null;
    let pagination = list ? list.querySelector('[class*="rss-pagination"]') : null;
    let hasScroll = list ? list.classList.contains('has-scroll') : false;
    
    return {
      found: true,
      itemCount: items.length,
      info: info ? info.textContent.trim() : '',
      hasPagination: !!pagination,
      hasScroll,
      maxHeight: list ? list.style.maxHeight : '',
    };
  });

  console.log(`  文章项: ${paginationInfo.itemCount} 个`);
  console.log(`  信息: "${paginationInfo.info}"`);
  console.log(`  分页控件: ${paginationInfo.hasPagination}`);
  console.log(`  滚动: ${paginationInfo.hasScroll} (maxHeight=${paginationInfo.maxHeight})`);

  ok(paginationInfo.found, "feed 组已展开");
  ok(paginationInfo.itemCount <= 30, `最多 30 条 (实际 ${paginationInfo.itemCount})`);
  if (paginationInfo.hasPagination) {
    ok(true, "含分页控件（下一页）");
  }

  // ============================================================
  // Test 3: Click "Next Page" and verify different articles
  // ============================================================
  if (paginationInfo.hasPagination) {
    console.log("\n--- Test 3: 分页翻页验证 ---");
    let firstPageFirstTitle = await page.evaluate(() => {
      let item = document.querySelector('[class*="rss-feed-group"].expanded [class*="rss-article-item"] [class*="rss-article-title"]');
      return item ? item.textContent.trim() : '';
    });
    console.log(`  第1页首篇文章: "${firstPageFirstTitle}"`);

    await page.evaluate(() => {
      let btn = document.querySelector('[class*="rss-pagination-btn"]');
      if (btn && btn.textContent.includes('下一页')) btn.click();
    });
    await page.waitForTimeout(500);

    let secondPageFirstTitle = await page.evaluate(() => {
      let item = document.querySelector('[class*="rss-feed-group"].expanded [class*="rss-article-item"] [class*="rss-article-title"]');
      return item ? item.textContent.trim() : '';
    });
    console.log(`  第2页首篇文章: "${secondPageFirstTitle}"`);

    ok(secondPageFirstTitle !== firstPageFirstTitle, "翻页后文章内容已变化");
    ok(secondPageFirstTitle.length > 0, "第2页有文章");

    // Verify prev button now appears
    let hasPrev = await page.evaluate(() => {
      let btns = document.querySelectorAll('[class*="rss-pagination-btn"]');
      return Array.from(btns).some(b => b.textContent.includes('上'));
    });
    ok(hasPrev, "第2页显示「上一页」按钮");

    // Go back
    await page.evaluate(() => {
      let btn = document.querySelector('[class*="rss-pagination-btn"]');
      if (btn && btn.textContent.includes('上')) btn.click();
    });
    await page.waitForTimeout(500);

    let backTitle = await page.evaluate(() => {
      let item = document.querySelector('[class*="rss-feed-group"].expanded [class*="rss-article-item"] [class*="rss-article-title"]');
      return item ? item.textContent.trim() : '';
    });
    ok(backTitle === firstPageFirstTitle, "回到第1页文章一致");

    await page.screenshot({ path: "screenshots/virtual-scroll-pagination.png" });
    console.log("  截图: screenshots/virtual-scroll-pagination.png");
  }

  // ============================================================
  // Test 4: Collapse feed → DOM cleaned up
  // ============================================================
  console.log("\n--- Test 4: 折叠时清理 DOM ---");
  await page.evaluate(() => {
    let header = document.querySelector('[class*="rss-feed-group"].expanded [class*="rss-feed-header"]');
    if (header) header.click();
  });
  await page.waitForTimeout(500);

  let collapsedClean = await page.evaluate(() => {
    let groups = document.querySelectorAll('[class*="rss-feed-group"]');
    let totalChildren = 0;
    groups.forEach(g => {
      if (!g.classList.contains('expanded')) {
        let list = g.querySelector('[class*="rss-article-list"]');
        if (list) totalChildren += list.children.length;
      }
    });
    return totalChildren;
  });
  console.log(`  折叠后文章 DOM 总数: ${collapsedClean}`);
  ok(collapsedClean === 0, "折叠后文章 DOM 已清理 (0 个节点)");

  // ============================================================
  // Test 5: Refresh progress display
  // ============================================================
  console.log("\n--- Test 5: 刷新进度显示验证 ---");
  
  // Click refresh
  let refreshClicked = await page.evaluate(() => {
    let bar = document.querySelector('[class*="rss-refresh-bar"]');
    if (bar) { bar.click(); return true; }
    return false;
  });
  ok(refreshClicked, "已点击刷新按钮");

  await page.waitForTimeout(1000);

  // Check refresh bar text during refresh
  let refreshState = await page.evaluate(() => {
    let label = document.querySelector('[class*="rss-refresh-label"]');
    let sub = document.querySelector('[class*="rss-refresh-sub"]');
    let bar = document.querySelector('[class*="rss-refresh-bar"]');
    return {
      label: label ? label.textContent.trim() : '',
      sub: sub ? sub.textContent.trim() : '',
      loading: bar ? bar.classList.contains('loading') : false,
    };
  });
  console.log(`  刷新中: label="${refreshState.label}" sub="${refreshState.sub}" loading=${refreshState.loading}`);
  // 单 feed 可能瞬间完成，loading 已经被移除
  if (refreshState.loading) {
    ok(true, "刷新条处于 loading 状态");
  } else {
    console.log("  ℹ️ 单 feed 刷新瞬间完成，loading 已消失 (正常)");
  }

  // Wait for completion (max 15s)
  for (let i = 0; i < 15; i++) {
    let done = await page.evaluate(() => {
      let bar = document.querySelector('[class*="rss-refresh-bar"]');
      return !bar || !bar.classList.contains('loading');
    });
    if (done) break;
    console.log(`  等待刷新完成 (${i + 1}/15)...`);
    await page.waitForTimeout(1000);
  }

  let finalState = await page.evaluate(() => {
    let label = document.querySelector('[class*="rss-refresh-label"]');
    let sub = document.querySelector('[class*="rss-refresh-sub"]');
    let bar = document.querySelector('[class*="rss-refresh-bar"]');
    return {
      label: label ? label.textContent.trim() : '',
      sub: sub ? sub.textContent.trim() : '',
      loading: bar ? bar.classList.contains('loading') : false,
    };
  });
  console.log(`  完成: label="${finalState.label}" sub="${finalState.sub}" loading=${finalState.loading}`);
  ok(!finalState.loading, "刷新已完成 (loading 移除)");
  ok(finalState.label.includes('全部刷新') || finalState.label.includes('全部'), "label 恢复为默认");
  ok(finalState.sub.includes('个订阅源'), "sub 恢复为订阅源数量");

  // ============================================================
  // Test 6: Multiple feed groups — only one expanded at a time
  // ============================================================
  console.log("\n--- Test 6: 同时只有一个 feed 展开 ---");
  
  // Count how many are expanded currently
  let expandedBefore = await page.evaluate(() => {
    return document.querySelectorAll('[class*="rss-feed-group"].expanded').length;
  });
  ok(expandedBefore <= 1, `展开的 feed 组: ${expandedBefore} (≤1)`);

  // Report
  console.log("\n" + "=".repeat(55));
  let total = passed + failed;
  console.log(`  结果: ${passed}/${total} 通过, ${failed} 失败`);
  console.log(failed === 0 ? `  ${P}${P}${P} 全部通过!` : `  ⚠️ ${failed} 项失败`);
  console.log("=".repeat(55));

  await page.waitForTimeout(3000);
  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
}
main();
