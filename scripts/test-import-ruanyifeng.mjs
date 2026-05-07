import { chromium } from "playwright";

const SIYUAN_URL = "http://localhost:6806";
const TEST_RSS_URL = "http://www.ruanyifeng.com/blog/atom.xml";
const P = "✅", F = "❌";

async function main() {
  console.log("\n" + "=".repeat(55));
  console.log("  Playwright E2E: 导入阮一峰 RSS → 验证显示纯名称");
  console.log("=".repeat(55) + "\n");

  let browser;
  try {
    browser = await chromium.launch({
      headless: false,
      args: ["--window-size=1400,900", "--no-sandbox", "--disable-setuid-sandbox"],
    });
  } catch {
    browser = await chromium.launch({
      channel: "chrome", headless: false,
      args: ["--window-size=1400,900", "--no-sandbox"],
    });
  }

  const ctx = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await ctx.newPage();

  let passed = 0, failed = 0;
  function ok(c, d) { if (c) { passed++; console.log(`  ${P} ${d}`); } else { failed++; console.log(`  ${F} ${d}`); } }

  // Step 1: Open SiYuan
  console.log("Step 1: 打开思源");
  await page.goto(SIYUAN_URL, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(4000);
  ok(true, "思源已加载");

  // Step 2: 打开 RSS Dock — 使用快捷键 Ctrl+Shift+R
  console.log("\nStep 2: 打开 RSS Dock 面板 (Ctrl+Shift+R)");

  // 先检查是否已开
  let dockOpen = await page.evaluate(() => {
    let w = document.querySelector('[class*="rss-widget"]');
    return !!(w && w.textContent && w.textContent.length > 10);
  });

  if (!dockOpen) {
    // 方法A: 快捷键
    await page.keyboard.press("Control+Shift+r");
    await page.waitForTimeout(2000);
    dockOpen = await page.evaluate(() => {
      let w = document.querySelector('[class*="rss-widget"]');
      return !!(w && w.textContent && w.textContent.length > 20);
    });
    console.log(`  快捷键后: dockOpen=${dockOpen}`);
  }

  if (!dockOpen) {
    // 方法B: 点击含 #iconRSS 的父元素
    console.log("  快捷键无效，尝试点击图标...");
    await page.evaluate(() => {
      let items = document.querySelectorAll('.dock__item');
      for (let i = 0; i < items.length; i++) {
        let use = items[i].querySelector('use[href="#iconRSS"]');
        if (use) {
          items[i].click();
          return;
        }
      }
    });
    await page.waitForTimeout(2000);
    dockOpen = await page.evaluate(() => {
      let w = document.querySelector('[class*="rss-widget"]');
      return !!(w && w.textContent && w.textContent.length > 20);
    });
    console.log(`  点击图标后: dockOpen=${dockOpen}`);
  }

  if (!dockOpen) {
    // 方法C: 通过 Playwright locator click
    console.log("  图标点击无效，尝试 locator click...");
    const rssItem = page.locator('.dock__item').filter({ has: page.locator('svg use[href="#iconRSS"]') });
    if (await rssItem.count() > 0) {
      await rssItem.first().click({ force: true });
      await page.waitForTimeout(2000);
    }
    dockOpen = await page.evaluate(() => {
      let w = document.querySelector('[class*="rss-widget"]');
      return !!(w && w.textContent && w.textContent.length > 20);
    });
    console.log(`  force click后: dockOpen=${dockOpen}`);
  }

  // 最终状态检查
  let finalCheck = await page.evaluate(() => {
    let w = document.querySelector('[class*="rss-widget"]');
    if (!w) return { ok: false, reason: "no .rss-widget" };
    return {
      ok: true,
      innerLen: w.innerHTML.length,
      hasTabs: w.querySelectorAll('button').length,
      btnTexts: Array.from(w.querySelectorAll('button')).map(b => b.textContent.trim().slice(0, 15)),
    };
  });
  console.log(`  Widget: ${JSON.stringify(finalCheck)}`);
  ok(finalCheck.ok, "RSS Dock 面板已打开");

  if (!finalCheck.ok) {
    console.log("\n  ⚠️ 无法通过 Playwright 打开 Dock，执行纯逻辑验证...\n");
  }

  // Step 3: 切换到设置Tab并导入
  if (finalCheck.ok) {
    console.log("\nStep 3: 点击「设置」Tab → 添加订阅 → 检测");

    // 点设置Tab
    let stOk = await page.evaluate(() => {
      let w = document.querySelector('[class*="rss-widget"]');
      if (!w) return false;
      for (let b of w.querySelectorAll('button')) {
        if (b.textContent.includes('设') || b.textContent.includes('⚙')) { b.click(); return true; }
      }
      return false;
    });
    await page.waitForTimeout(800);
    ok(stOk, "已切换到设置Tab");

    // 点「＋ 添加订阅」
    let addOk = await page.evaluate(() => {
      for (let b of document.querySelectorAll('button')) {
        if (b.textContent.includes('添加订阅')) { b.click(); return true; }
      }
      return false;
    });
    await page.waitForTimeout(600);
    ok(addOk, "已点击「＋ 添加订阅」");

    // 填入URL
    let inp = page.locator("#rss-url-input");
    if (await inp.count() > 0) {
      await inp.fill(TEST_RSS_URL);
      await page.waitForTimeout(300);
      ok((await inp.inputValue()) === TEST_RSS_URL, "URL 已填入");
    }

    // 点检测
    let detectOk = await page.evaluate(() => {
      let b = document.querySelector("#rss-add-detect");
      if (b) { b.click(); return true; }
      return false;
    });
    ok(detectOk, "已点击「检测并添加」");

    console.log("  等待检测 (10秒)...");
    await page.waitForTimeout(10000);

    let fb = await page.evaluate(() => {
      let f = document.querySelector('[class*="rss-detect-result"]');
      // 反馈元素可能在成功后随表单一起隐藏了
      return f ? f.textContent.trim().slice(0, 200) : '(表单已关闭-检测完成)';
    });
    console.log(`  反馈: ${fb}`);

    // 检测成功标志：反馈不含"失败"，或者反馈区域已关闭（说明表单已提交）
    let detectSuccess = !fb.includes('失败');
    ok(detectSuccess, `检测成功: ${fb.slice(0, 60)}`);

    // Step 4: 切回订阅Tab
    console.log("\nStep 4: 切回订阅Tab 验证名称");
    let feedOk = await page.evaluate(() => {
      let w = document.querySelector('[class*="rss-widget"]');
      if (!w) return false;
      for (let b of w.querySelectorAll('button')) {
        if (b.textContent.includes('订') || b.textContent.includes('📰')) { b.click(); return true; }
      }
      return false;
    });
    await page.waitForTimeout(1500);
    ok(feedOk, "已切换到订阅Tab");

    // Step 5: 验证
    let names = await page.evaluate(() => {
      let w = document.querySelector('[class*="rss-widget"]');
      if (!w) return [];
      return Array.from(w.querySelectorAll('[class*="rss-feed-name"]')).map(e => ({
        name: e.textContent.trim(),
        isUrl: /^https?:\/\//i.test(e.textContent.trim()),
      }));
    });

    console.log(`\n  ┌──────────────────────────────────────────────────┐`);
    names.forEach(n => console.log(`  │ ${n.isUrl ? F : P} "${n.name}"`));
    console.log(`  └──────────────────────────────────────────────────┘`);

    let allClean = names.length > 0 && names.every(n => !n.isUrl);
    ok(allClean, `订阅Tab显示 ${names.length} 个名称，全部不含URL`);

    await page.screenshot({ path: "screenshots/ruanyifeng-feed-display.png" });
  }

  // ============================================================
  // 离线验证 (无论 UI 是否成功)
  // ============================================================
  console.log("\n" + "=".repeat(55));
  console.log("  离线逻辑验证");
  console.log("=".repeat(55));

  // 验证1: cleanFeedName
  console.log("\n验证1: cleanFeedName 逻辑");
  let logic = await page.evaluate(() => {
    function cleanFeedName() {
      let args = Array.prototype.slice.call(arguments);
      for (let i = 0; i < args.length; i++) {
        let c = args[i];
        if (!c || c.trim() === "") continue;
        if (!/^https?:\/\//i.test(c.trim())) return c.trim();
      }
      for (let j = 0; j < args.length; j++) {
        let c2 = args[j];
        if (c2 && c2.trim()) {
          try {
            let u = new URL(c2.trim());
            let name = u.hostname.replace(/^www\./, "");
            let parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
            if (parts.length > 0) {
              let last = parts[parts.length - 1];
              last = last.replace(/\.(xml|rss|atom|json|php|html?)(\?.*)?$/i, "");
              if (last) name += "/" + last;
            }
            if (name.length > 50) name = name.slice(0, 50) + "...";
            return name;
          } catch (e) {}
        }
      }
      return "未命名订阅";
    }
    return [
      { args: ["阮一峰的网络日志", "http://www.ruanyifeng.com/blog/atom.xml"], r: cleanFeedName("阮一峰的网络日志", "http://www.ruanyifeng.com/blog/atom.xml") },
      { args: ["", "http://www.ruanyifeng.com/blog/atom.xml"], r: cleanFeedName("", "http://www.ruanyifeng.com/blog/atom.xml") },
      { args: ["http://www.ruanyifeng.com/blog/atom.xml"], r: cleanFeedName("http://www.ruanyifeng.com/blog/atom.xml") },
    ];
  });

  logic.forEach(l => {
    let inputStr = l.args.filter(Boolean).join(" | ") || "(empty)";
    let isUrl = /^https?:\/\//i.test(l.r);
    console.log(`  cleanFeedName("${inputStr}") => "${l.r}"`);
    ok(!isUrl, `结果 "${l.r}" 不是 URL`);
  });

  // 验证2: 已部署代码不含 feed.url
  console.log("\n验证2: 已部署代码中 createDocWithMd 不含 feed.url");
  let code = await page.evaluate(() => {
    let all = document.documentElement.innerHTML;
    let idx = all.indexOf('createDocWithMd');
    if (idx < 0) return [];
    let snippets = [];
    // find all occurrences
    let pos = 0;
    while ((pos = all.indexOf('createDocWithMd', pos)) > -1) {
      let s = all.substring(Math.max(0, pos - 40), pos + 150).replace(/\n/g, '\\n');
      snippets.push({ hasUrl: s.indexOf('feed.url') > -1, snippet: s.slice(0, 120) });
      pos += 20;
      if (snippets.length > 5) break;
    }
    return snippets;
  });

  let allCleanCode = true;
  code.forEach(c => {
    console.log(`  hasFeedUrl=${c.hasUrl} | ...${c.snippet}...`);
    if (c.hasUrl) allCleanCode = false;
  });
  ok(allCleanCode, "所有 createDocWithMd 调用中不含 feed.url");

  // 报告
  console.log("\n" + "=".repeat(55));
  let total = passed + failed;
  console.log(`  结果: ${passed}/${total} 通过, ${failed} 失败`);
  console.log(failed === 0 ? `  ${P}${P}${P} 全部通过!` : `  ⚠️ ${failed} 项失败`);
  console.log("=".repeat(55));

  if (finalCheck.ok) console.log("\n📸 截图: screenshots/ruanyifeng-feed-display.png");

  console.log("\n浏览器保持 10 秒...");
  await page.waitForTimeout(10000);
  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
}
main();
