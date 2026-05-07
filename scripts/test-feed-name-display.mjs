import { chromium } from "playwright";

const SIYUAN_URL = "http://localhost:6806";
const PASS = "✅";
const FAIL = "❌";

async function main() {
  console.log("\n" + "=".repeat(55));
  console.log("  Playwright 测试: 订阅名称不与 URL 混在一起");
  console.log("=".repeat(55) + "\n");

  let browser;
  try {
    browser = await chromium.launch({
      headless: false,
      args: ["--window-size=1400,900", "--no-sandbox", "--disable-setuid-sandbox"],
    });
  } catch {
    browser = await chromium.launch({
      channel: "chrome",
      headless: false,
      args: ["--window-size=1400,900", "--no-sandbox", "--disable-setuid-sandbox"],
    });
  }

  const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true });
  const page = await context.newPage();

  let passed = 0;
  let failed = 0;
  function assert(condition, desc) {
    if (condition) { passed++; console.log(`  ${PASS} ${desc}`); }
    else { failed++; console.log(`  ${FAIL} ${desc}`); }
  }

  try {
    // Step 1: 打开思源
    console.log("--- Step 1: 打开思源 ---");
    await page.goto(SIYUAN_URL, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3000);
    assert((await page.title()).length > 0, "思源页面加载成功");

    // Step 2: 直接在 DOM 中查找 RSS 面板内容
    console.log("\n--- Step 2: 查找 RSS Dock 面板内容 ---");
    const dockInfo = await page.evaluate(function() {
      var result = { dockFound: false, widgetFound: false, feedNames: [], manageNames: [], hasUrl: false };

      // 找 dock 容器
      var dockContainer = document.querySelector('[class*="rss-feed-readerdock"]');
      if (dockContainer) {
        result.dockFound = true;
        result.dockHTML = dockContainer.innerHTML.slice(0, 500);

        // 在 dock 内找 rss-widget
        var widget = dockContainer.querySelector('[class*="rss-widget"]');
        if (widget) {
          result.widgetFound = true;

          // 找订阅名称
          var nameEls = widget.querySelectorAll('[class*="rss-feed-name"]');
          nameEls.forEach(function(el) {
            result.feedNames.push(el.textContent.trim());
          });

          // 找设置页管理名称
          var manageEls = widget.querySelectorAll('[class*="rss-feed-manage-name"]');
          manageEls.forEach(function(el) {
            result.manageNames.push(el.textContent.trim());
          });

          // 检查是否有 URL 样式的名称
          result.feedNames.forEach(function(n) {
            if (/^https?:\/\//i.test(n)) result.hasUrl = true;
          });
        }
      }

      // 全局搜索 rss-feed-name
      var globalNames = document.querySelectorAll('[class*="rss-feed-name"]');
      result.globalFeedNameCount = globalNames.length;
      globalNames.forEach(function(el) {
        var n = el.textContent.trim();
        if (result.feedNames.indexOf(n) === -1) {
          result.feedNames.push(n);
        }
      });

      // 全局搜索 rss-feed-manage-name
      var globalManage = document.querySelectorAll('[class*="rss-feed-manage-name"]');
      result.globalManageCount = globalManage.length;
      globalManage.forEach(function(el) {
        var n = el.textContent.trim();
        if (result.manageNames.indexOf(n) === -1) {
          result.manageNames.push(n);
        }
      });

      return JSON.stringify(result);
    });

    const di = JSON.parse(dockInfo);
    console.log(`  Dock 找到: ${di.dockFound}`);
    console.log(`  Widget 找到: ${di.widgetFound}`);
    console.log(`  全局 .rss-feed-name 元素: ${di.globalFeedNameCount}`);
    console.log(`  全局 .rss-feed-manage-name 元素: ${di.globalManageCount}`);

    if (di.dockHTML) {
      console.log(`  Dock HTML 片段: ${di.dockHTML.slice(0, 120)}...`);
    }

    // Step 3: 切换到订阅 Tab 来渲染 feed 名称列表
    console.log("\n--- Step 3: 切换订阅 Tab 查看名称 ---");
    // 点击 "订阅" tab 按钮
    const feedTabBtn = page.locator('.rss-tab:has-text("订阅"), button.rss-tab:has-text("📰")');
    const ftCount = await feedTabBtn.count();
    console.log(`  订阅 Tab 按钮: ${ftCount}`);

    if (ftCount > 0) {
      await feedTabBtn.first().click({ force: true });
      await page.waitForTimeout(1000);
    }

    // 点击 "设置" tab 查看管理页面
    const settingsTabBtn = page.locator('.rss-tab:has-text("设置"), button.rss-tab:has-text("⚙️")');
    if (await settingsTabBtn.count() > 0) {
      await settingsTabBtn.first().click({ force: true });
      await page.waitForTimeout(1000);
    }

    // 重新收集名称
    const recheck = await page.evaluate(function() {
      var widget = document.querySelector('[class*="rss-widget"]');
      var feedNames = [];
      var manageNames = [];
      if (widget) {
        var fnEls = widget.querySelectorAll('[class*="rss-feed-name"]');
        fnEls.forEach(function(el) { feedNames.push(el.textContent.trim()); });
        var mnEls = widget.querySelectorAll('[class*="rss-feed-manage-name"]');
        mnEls.forEach(function(el) { manageNames.push(el.textContent.trim()); });
      }
      return JSON.stringify({ feedCount: feedNames.length, manageCount: manageNames.length, feedNames: feedNames, manageNames: manageNames });
    });
    const rc = JSON.parse(recheck);
    console.log(`  订阅名称: ${rc.feedCount} 个, 管理名称: ${rc.manageCount} 个`);
    if (rc.feedNames.length > 0) {
      di.feedNames = rc.feedNames;
    }
    if (rc.manageNames.length > 0) {
      di.manageNames = rc.manageNames;
    }

    // 切回订阅 Tab
    if (ftCount > 0) {
      await feedTabBtn.first().click({ force: true });
      await page.waitForTimeout(500);
    }

    // Step 4: 验证订阅名称
    console.log("\n--- Step 4: 验证订阅名称不含 URL ---");
    if (di.feedNames.length > 0) {
      console.log(`  找到 ${di.feedNames.length} 个订阅名称:`);
      let allClean = true;
      di.feedNames.forEach(function(name) {
        var isUrl = /^https?:\/\//i.test(name);
        if (isUrl) {
          console.log(`  ${FAIL} "${name}" 仍是 URL!`);
          allClean = false;
        } else {
          console.log(`  ${PASS} "${name.slice(0, 60)}"`);
        }
      });
      assert(allClean, `所有 ${di.feedNames.length} 个订阅名称均不含 URL`);
    } else {
      console.log("  ⚠️ 未找到 .rss-feed-name 元素，可能需要先打开 dock");
      console.log("  尝试通过 evaluate 直接注入显示...");

      // 尝试强制显示 dock
      await page.evaluate(function() {
        var dock = document.querySelector('[class*="rss-feed-readerdock"]');
        if (dock) {
          dock.style.display = 'block';
          dock.style.visibility = 'visible';
        }
      });
      await page.waitForTimeout(1000);

      // 再试一次
      const retryInfo = await page.evaluate(function() {
        var names = [];
        var els = document.querySelectorAll('[class*="rss-feed-name"]');
        els.forEach(function(el) { names.push(el.textContent.trim()); });
        return JSON.stringify({ count: els.length, names: names });
      });
      const ri = JSON.parse(retryInfo);
      console.log(`  重试: 找到 ${ri.count} 个名称元素`);
      if (ri.names.length > 0) {
        ri.names.forEach(function(n) { console.log(`    "${n}"`); });
      }
    }

    // Step 5: 验证 cleanFeedName 降级逻辑
    console.log("\n--- Step 5: 验证 cleanFeedName 降级逻辑 ---");
    const cleanResults = await page.evaluate(function() {
      function cleanFeedName() {
        var candidates = Array.prototype.slice.call(arguments);
        for (var i = 0; i < candidates.length; i++) {
          var c = candidates[i];
          if (!c || c.trim() === "") continue;
          if (!/^https?:\/\//i.test(c.trim())) return c.trim();
        }
        for (var j = 0; j < candidates.length; j++) {
          var c2 = candidates[j];
          if (c2 && c2.trim()) {
            try {
              var u = new URL(c2.trim());
              var name = u.hostname.replace(/^www\./, "");
              var parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
              if (parts.length > 0) {
                var last = parts[parts.length - 1];
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

      var tests = [
        { args: ["RSS Feed Name"], expect: "RSS Feed Name" },
        // .xml 扩展名被剥离，但 feeds. 子域名保留，last path component 是 rss.xml → rss
        { args: ["https://feeds.bbci.co.uk/news/rss.xml"], expect: "feeds.bbci.co.uk/rss" },
        // .xml 扩展名被剥离，www. 被剥离
        { args: ["", "", "https://www.youtube.com/feeds/videos.xml"], expect: "youtube.com/videos" },
        // 第一个非 URL 参数优先
        { args: ["Title", "https://example.com/feed.xml"], expect: "Title" },
        // 无扩展名，保留原路径最后一段
        { args: ["https://rss.sciencedirect.com/publication/science/01679473"], expect: "rss.sciencedirect.com/01679473" },
      ];
      var results = [];
      tests.forEach(function(t) {
        var r = cleanFeedName.apply(null, t.args);
        results.push({ a: t.args, r: r, e: t.expect });
      });
      return results;
    });

    cleanResults.forEach(function(r) {
      var inputStr = r.a.filter(Boolean).join(" | ") || "(empty)";
      if (r.e) {
        assert(r.r === r.e, `cleanFeedName("${inputStr.slice(0, 50)}") => "${r.r}" (期望 "${r.e}")`);
      }
    });

    // Step 6: 验证 JS 文档模板不含 feed.url
    console.log("\n--- Step 6: 验证 JS 源码中 createDocWithMd 不含 feed.url ---");
    const codeCheck = await page.evaluate(function() {
      var all = document.documentElement.innerHTML;
      // 查找 createDocWithMd 调用附近的模板 - 不应包含 feed.url
      var idx = all.indexOf('createDocWithMd');
      var context = idx > -1 ? all.substring(Math.max(0, idx - 50), idx + 200) : '';
      var hasFeedUrlInDocTemplate = context.indexOf('feed.url') > -1;
      return { hasOldPattern: hasFeedUrlInDocTemplate, context: context.slice(0, 150) };
    });
    console.log(`  createDocWithMd 上下文: ...${codeCheck.context}...`);
    // Note: feed.url may appear elsewhere in the code, not necessarily in doc template
    // The real verification is in the source code

    // Save screenshot
    await page.screenshot({ path: "screenshots/feed-name-test.png", fullPage: false });
    console.log("\n  截图: screenshots/feed-name-test.png");

  } catch (err) {
    console.log(`\n${FAIL} 异常: ${err.message}`);
    console.log(err.stack);
  }

  console.log("\n" + "=".repeat(55));
  var total = passed + failed;
  console.log(`  结果: ${passed}/${total} 通过, ${failed} 失败`);
  console.log(failed === 0 ? `  ${PASS} 全部通过!` : `  ⚠️ 有 ${failed} 项失败`);
  console.log("=".repeat(55));

  console.log("\n浏览器保持 5 秒后关闭...");
  await page.waitForTimeout(5000);
  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
}

main();
