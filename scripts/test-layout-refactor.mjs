import { chromium } from "playwright";

const P = "✅", F = "❌";

async function main() {
  console.log("\n" + "=".repeat(55));
  console.log("  Playwright: 布局重构验证");
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
    await page.waitForTimeout(2000);
  }

  // Switch to settings
  await page.evaluate(() => {
    let w = document.querySelector('[class*="rss-widget"]');
    for (let b of w.querySelectorAll('button')) {
      if (b.textContent.includes('设') || b.textContent.includes('⚙')) { b.click(); return; }
    }
  });
  await page.waitForTimeout(800);

  // ================================================================
  // Test 1: Verify action buttons are OUTSIDE the collapse body
  // ================================================================
  console.log("--- Test 1: 操作按钮不在订阅管理折叠体内 ---");
  let layout = await page.evaluate(() => {
    // Find collapse body
    let body = document.querySelector('[class*="rss-settings-collapse-body"]');
    // Find action buttons
    let importBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('导入 OPML'));
    
    if (!importBtn) return { error: "import button not found" };
    
    // Check if the button is inside a collapse body
    let insideBody = false;
    let el = importBtn;
    while (el && el.id !== 'root') {
      if (el === body) { insideBody = true; break; }
      el = el.parentElement;
    }
    
    // Check if actions bar is between two section headers (subscription mgmt and general)
    let sections = document.querySelectorAll('[class*="rss-settings-section"]');
    let actionsBar = document.querySelector('[class*="rss-settings-actions"]');
    
    // The actions bar should be a direct child of rss-widget (or content area), NOT inside a section
    let insideSection = false;
    let ae = actionsBar;
    while (ae) {
      if (ae.classList && ae.classList.contains('rss-settings-section')) { insideSection = true; break; }
      ae = ae.parentElement;
    }
    
    return {
      insideBody,
      insideSection,
      sectionCount: sections.length,
      actionsBarFound: !!actionsBar,
      actionsParentClass: actionsBar ? actionsBar.parentElement?.className?.slice(0, 40) : '',
    };
  });
  console.log("  insideBody: " + layout.insideBody + " | insideSection: " + layout.insideSection);
  ok(!layout.insideBody, "操作按钮不在折叠体内");
  ok(layout.actionsBarFound, "操作按钮栏已渲染");

  // ================================================================
  // Test 2: Verify layout order (订阅管理 → 操作按钮 → 通用设置)
  // ================================================================
  console.log("\n--- Test 2: 验证布局顺序 ---");
  let order = await page.evaluate(() => {
    let el = document.querySelector('[class*="rss-widget"]'); // or content area
    if (!el) return [];
    let items = [];
    for (let child of el.children) {
      let cls = child.className?.slice(0, 60) || '';
      let text = child.textContent?.trim().slice(0, 30) || '';
      items.push({ cls, text });
    }
    // find in the whole widget
    let all = [];
    function walk(node, depth) {
      if (depth > 9) return;
      for (let c of node.children) {
        let cls = (typeof c.className === 'string') ? c.className : (c.getAttribute('class') || '');
        if (cls.match(/settings-section|settings-actions|collapse-header/)) {
          all.push({ cls: cls.slice(0, 55), text: (c.textContent || '').trim().slice(0, 40) });
        }
        walk(c, depth + 1);
      }
    }
    walk(document.querySelector('[class*="rss-widget"]'), 0);
    return all;
  });
  order.forEach(o => console.log(`  ${o.cls} → "${o.text}"`));

  // Check order: feed-title → actions → general-title
  let feedIdx = order.findIndex(o => o.cls.includes('collapse-header') && o.text.includes('个订阅'));
  let actionsIdx = order.findIndex(o => o.cls.includes('settings-actions'));
  let generalIdx = order.findIndex(o => o.cls.includes('collapse-header') && o.text.includes('通用设置'));
  console.log(`  索引: feedTitle=${feedIdx}, actions=${actionsIdx}, generalTitle=${generalIdx}`);
  ok(feedIdx >= 0, "订阅管理标题存在");
  ok(actionsIdx >= 0, "操作按钮栏存在");
  ok(generalIdx >= 0, "通用设置标题存在");
  ok(actionsIdx > feedIdx, "操作按钮位于订阅管理下方");
  ok(generalIdx > actionsIdx, "通用设置位于操作按钮下方");

  // ================================================================
  // Test 3: Verify folder groups are individually collapsible
  // ================================================================
  console.log("\n--- Test 3: 文件夹独立折叠 ---");
  let folderInfo = await page.evaluate(() => {
    let headers = document.querySelectorAll('[class*="rss-folder-group-header"]');
    let children = document.querySelectorAll('[class*="rss-folder-group-children"]');
    return {
      headerCount: headers.length,
      childrenCount: children.length,
      headers: Array.from(headers).map(h => ({
        text: h.textContent.trim().slice(0, 30),
        hasArrow: !!h.querySelector('[class*="folder-group-arrow"]'),
      })),
      children: Array.from(children).map((c, i) => ({
        idx: i,
        collapsed: c.classList.contains('collapsed'),
        feedCount: c.querySelectorAll('[class*="rss-feed-manage-item"]').length,
      })),
    };
  });
  console.log(`  文件夹: ${folderInfo.headerCount} 个`);
  folderInfo.headers.forEach(h => console.log(`    ${h.hasArrow ? P : F} "${h.text}"`));
  folderInfo.children.forEach(c => console.log(`    children[${c.idx}]: collapsed=${c.collapsed} feeds=${c.feedCount}`));

  if (folderInfo.headerCount > 0) {
    ok(folderInfo.headerCount === folderInfo.children.length, "文件夹头与子节点数量匹配");

    // Test collapsing a folder
    console.log("\n  点击第一个文件夹折叠...");
    let collapsed = await page.evaluate(() => {
      let h = document.querySelector('[class*="rss-folder-group-header"]');
      if (!h) return false;
      h.click();
      return true;
    });
    await page.waitForTimeout(600);
    ok(collapsed, "已点击文件夹标题");

    let afterCollapse = await page.evaluate(() => {
      let children = document.querySelectorAll('[class*="rss-folder-group-children"]');
      return Array.from(children).map(c => c.classList.contains('collapsed'));
    });
    ok(afterCollapse.some(c => c), "文件夹子节点已折叠");

    // Expand again
    await page.evaluate(() => {
      let h = document.querySelector('[class*="rss-folder-group-header"]');
      if (h) h.click();
    });
    await page.waitForTimeout(600);
    let afterExpand = await page.evaluate(() => {
      let children = document.querySelectorAll('[class*="rss-folder-group-children"]');
      return Array.from(children).every(c => !c.classList.contains('collapsed'));
    });
    ok(afterExpand, "文件夹已重新展开");
  }

  // ================================================================
  // Test 4: Add feed flow still works
  // ================================================================
  console.log("\n--- Test 4: 添加订阅流程验证 ---");
  let addClicked = await page.evaluate(() => {
    for (let b of document.querySelectorAll('button')) {
      if (b.textContent.includes('添加订阅')) { b.click(); return true; }
    }
    return false;
  });
  await page.waitForTimeout(500);
  ok(addClicked, "已点击「＋ 添加订阅」");

  let inpVisible = await page.evaluate(() => {
    let inp = document.querySelector("#rss-url-input");
    return !!(inp && inp.offsetParent !== null);
  });
  ok(inpVisible, "URL 输入框已展开");

  // Fill URL and detect
  await page.locator("#rss-url-input").fill("http://www.ruanyifeng.com/blog/atom.xml");
  await page.locator("#rss-add-detect").click();
  console.log("  等待检测完成...");
  await page.waitForTimeout(10000);

  // Switch back to feed and verify
  await page.evaluate(() => {
    let w = document.querySelector('[class*="rss-widget"]');
    for (let b of w.querySelectorAll('button')) {
      if (b.textContent.includes('订') || b.textContent.includes('📰')) { b.click(); return; }
    }
  });
  await page.waitForTimeout(1000);

  let feeds = await page.evaluate(() => {
    let names = document.querySelectorAll('[class*="rss-feed-name"]');
    return Array.from(names).map(e => e.textContent.trim());
  });
  ok(feeds.length > 0, `订阅Tab显示 ${feeds.length} 个订阅: ${JSON.stringify(feeds)}`);

  // Screenshot
  await page.screenshot({ path: "screenshots/layout-refactor.png" });
  console.log("  截图: screenshots/layout-refactor.png");

  // Report
  console.log("\n" + "=".repeat(55));
  let total = passed + failed;
  console.log(`  结果: ${passed}/${total} 通过, ${failed} 失败`);
  console.log(failed === 0 ? `  ${P}${P}${P} 全部通过!` : `  ⚠️ ${failed} 项失败`);
  console.log("=".repeat(55));

  await page.waitForTimeout(5000);
  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
}
main();
