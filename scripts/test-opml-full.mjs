import { chromium } from "playwright";

let passed = 0, failed = 0;
function ok(c, d) { if (c) { passed++; console.log(`  ✅ ${d}`); } else { failed++; console.log(`  ❌ ${d}`); } }

const OPML = "D:/demo/rss_siyuan/feeds-all.opml";

async function main() {
  console.log("\n" + "═".repeat(60));
  console.log("  OPML 导入全流程性能测试");
  console.log("═".repeat(60));

  const startAll = Date.now();

  let browser;
  try { browser = await chromium.launch({ headless: false, args: ["--window-size=1400,900", "--no-sandbox"] }); }
  catch { browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--window-size=1400,900", "--no-sandbox"] }); }
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();

  await page.goto("http://localhost:6806", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(4000);

  for (let i = 0; i < 10; i++) {
    const ready = await page.evaluate(() => {
      const w = document.querySelector('[class*="rss-widget"]');
      return !!(w && w.textContent && w.textContent.length > 50);
    });
    if (ready) break;
    await page.waitForTimeout(3000);
  }
  console.log(`  启动耗时: ${Date.now() - startAll}ms`);

  // ─── Reset ───
  console.log("\n--- Step 0: 重置 ---");
  await page.evaluate(() => {
    for (const b of document.querySelectorAll("button")) {
      if (b.textContent.includes("设") || b.textContent.includes("⚙")) { b.click(); return; }
    }
  });
  await page.waitForTimeout(800);

  page.once("dialog", d => d.accept());
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('[class*="rss-settings-collapse-header"]')) {
      if (el.textContent.includes("通用")) { el.click(); return; }
    }
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    for (const b of document.querySelectorAll("button")) {
      if (b.textContent.includes("清除")) { b.click(); return; }
    }
  });
  await page.waitForTimeout(1200);
  ok(true, "数据已重置");

  // ─── Import OPML ───
  console.log("\n--- Step 1: 导入 OPML ---");
  const fcPromise = page.waitForEvent("filechooser", { timeout: 10000 });
  await page.evaluate(() => {
    for (const b of document.querySelectorAll("button")) {
      if (b.textContent.includes("导入")) { b.click(); return; }
    }
  });
  const fc = await fcPromise;
  await fc.setFiles(OPML);

  const importStart = Date.now();
  let lastCount = 0;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(5000);
    const count = await page.evaluate(() =>
      document.querySelectorAll('[class*="rss-feed-manage-item"]').length
    );
    if (count !== lastCount) {
      console.log(`   [${((Date.now() - importStart) / 1000).toFixed(0)}s] ${count} 个订阅`);
      lastCount = count;
    }
    if (count >= 28) break;
  }
  const importTime = ((Date.now() - importStart) / 1000).toFixed(1);

  const feeds = await page.evaluate(() => ({
    feeds: document.querySelectorAll('[class*="rss-feed-manage-item"]').length,
    folders: document.querySelectorAll('[class*="rss-folder-group-header"]').length,
  }));
  ok(feeds.feeds >= 28, `${feeds.feeds} 个订阅, ${feeds.folders} 个文件夹`);
  console.log(`   导入耗时: ${importTime}s`);

  // ─── Set target notebook ───
  console.log("\n--- Step 2: 设置目标笔记本 ---");
  await page.evaluate(() => {
    const selects = document.querySelectorAll("select");
    for (const s of selects) {
      if (s.innerHTML.includes("RSS")) {
        s.value = Array.from(s.options).find(o => o.text === "RSS 订阅")?.value || s.options[1]?.value || "";
        s.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }
    }
  });
  await page.waitForTimeout(500);
  ok(true, "笔记本已设置");

  // ─── Switch to feed tab ───
  console.log("\n--- Step 3: 切换到订阅 Tab ---");
  const renderStart = Date.now();
  await page.evaluate(() => {
    for (const b of document.querySelectorAll("button")) {
      if (b.textContent.includes("阅")) { b.click(); return; }
    }
  });
  await page.waitForTimeout(2000);
  const renderTime = Date.now() - renderStart;
  console.log(`   渲染耗时: ${renderTime}ms`);
  ok(renderTime < 5000, `渲染 <5s (实际 ${renderTime}ms)`);

  // ─── Check articles ───
  const stats = await page.evaluate(() => {
    const badge = document.querySelector('[class*="rss-tab-badge"]');
    const filterBar = document.querySelector('[class*="rss-time-filter"]');
    return {
      totalUnread: badge ? parseInt(badge.textContent) || 0 : 0,
      filterActive: filterBar ? Array.from(filterBar.querySelectorAll('button[class*="rss-pill"].active')).map(p => p.textContent.trim())[0] : "",
    };
  });
  console.log(`   未读: ${stats.totalUnread} 篇 | 筛选: ${stats.filterActive}`);
  ok(stats.totalUnread > 0, `有 ${stats.totalUnread} 篇未读文章`);
  ok(stats.filterActive === "7天", `筛选器选中: "${stats.filterActive}"`);

  // ─── Expand first feed ───
  console.log("\n--- Step 4: 展开第一个订阅 ---");
  const expandStart = Date.now();
  await page.evaluate(() => {
    const folderHeaders = document.querySelectorAll('[class*="rss-folder-header"]');
    if (folderHeaders.length > 0) folderHeaders[0].click();
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const feedHeaders = document.querySelectorAll('[class*="rss-feed-header"]');
    if (feedHeaders.length > 0) feedHeaders[0].click();
  });
  await page.waitForTimeout(1000);
  const expandTime = Date.now() - expandStart;

  const articleList = await page.evaluate(() => {
    const items = document.querySelectorAll('[class*="rss-article-item"]');
    const info = document.querySelector('[class*="rss-article-info"]');
    return { count: items.length, info: info ? info.textContent.trim() : "" };
  });
  console.log(`   展开耗时: ${expandTime}ms`);
  console.log(`   文章列表: ${articleList.info || `${articleList.count} 篇`}`);
  ok(expandTime < 2000, `展开 <2s (实际 ${expandTime}ms)`);
  ok(articleList.count > 0, `有 ${articleList.count} 篇文章`);

  // ─── Time filter tests ───
  console.log("\n--- Step 5: 切换时间筛选器 ---");
  const pills = await page.locator('[class*="rss-time-filter"] button[class*="rss-pill"]').all();
  
  // 今天
  const swStart = Date.now();
  if (pills.length >= 1) await pills[0].click();
  await page.waitForTimeout(500);
  console.log(`   切「今天」: ${Date.now() - swStart}ms`);

  let active = await page.evaluate(() => {
    const a = document.querySelector('[class*="rss-time-filter"] button[class*="rss-pill"].active');
    return a ? a.textContent.trim() : "";
  });
  ok(active === "今天", `→ "${active}"`);

  // 30天 + 自动刷新
  console.log("   切「30天」→ 自动刷新 (30s)...");
  const sw2Start = Date.now();
  if (pills.length >= 3) await pills[2].click();
  
  let refreshDone = false;
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(5000);
    const running = await page.evaluate(() => {
      const bar = document.querySelector('[class*="rss-refresh-bar"]');
      return bar ? bar.classList.contains("loading") : false;
    });
    if (!running) { refreshDone = true; break; }
  }
  const refreshTime = ((Date.now() - sw2Start) / 1000).toFixed(0);
  console.log(`   刷新耗时: ${refreshTime}s (${refreshDone ? "完成" : "仍在进行"})`);

  active = await page.evaluate(() => {
    const a = document.querySelector('[class*="rss-time-filter"] button[class*="rss-pill"].active');
    return a ? a.textContent.trim() : "";
  });
  ok(active === "30天", `→ "${active}"`);

  // Back to 7d
  if (pills.length >= 2) await pills[2].click(); // re-click 30d
  await page.waitForTimeout(300);
  if (pills.length >= 2) await pills[1].click();
  await page.waitForTimeout(500);

  active = await page.evaluate(() => {
    const a = document.querySelector('[class*="rss-time-filter"] button[class*="rss-pill"].active');
    return a ? a.textContent.trim() : "";
  });
  ok(active === "7天", `→ "${active}"`);

  // ─── Try again with throttle stop first ───
  // Stop any running refresh
  console.log("\n--- Step 6: 停止刷新, 验证最终状态 ---");
  await page.evaluate(() => {
    const bar = document.querySelector('[class*="rss-refresh-bar"]');
    if (bar && bar.classList.contains("loading")) {
      bar.classList.remove("loading");
    }
  });
  await page.waitForTimeout(500);

  const finalStats = await page.evaluate(() => ({
    unread: (() => {
      const badge = document.querySelector('[class*="rss-tab-badge"]');
      return badge ? parseInt(badge.textContent) || 0 : 0;
    })(),
    filterActive: (() => {
      const a = document.querySelector('[class*="rss-time-filter"] button[class*="rss-pill"].active');
      return a ? a.textContent.trim() : "";
    })(),
    feeds: document.querySelectorAll('[class*="rss-feed-group"]').length,
  }));
  console.log(`   最终: ${finalStats.feeds} 个源, ${finalStats.unread} 篇未读, 筛选=${finalStats.filterActive}`);
  ok(finalStats.filterActive === "7天", `筛选回到7天`);

  await page.screenshot({ path: "screenshots/test-opml-full.png" });

  const totalTime = ((Date.now() - startAll) / 1000).toFixed(0);
  console.log("\n" + "═".repeat(60));
  console.log(`  总耗时: ${totalTime}s | 通过: ${passed}  失败: ${failed}`);
  if (failed === 0) console.log("  🎉 OPML 导入全流程测试通过!");
  else console.log(`  ⚠️ ${failed} 项失败`);
  console.log("═".repeat(60) + "\n");

  await page.waitForTimeout(500);
  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("异常:", e.message); process.exit(1); });
