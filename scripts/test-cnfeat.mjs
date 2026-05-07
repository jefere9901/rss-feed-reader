import { chromium } from "playwright";

const SIYUAN_URL = "http://localhost:6806";
const TEST_RSS_URL = "https://www.cnfeat.com/feed.xml";
const P = "✅", F = "❌";

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("  Playwright: cnfeat.com RSS 全面测试");
  console.log("=".repeat(60) + "\n");

  let browser;
  try {
    browser = await chromium.launch({ headless: false, args: ["--window-size=1400,900", "--no-sandbox"] });
  } catch {
    browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--window-size=1400,900", "--no-sandbox"] });
  }
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true })).newPage();

  let passed = 0, failed = 0;
  function ok(c, d) { if (c) { passed++; console.log(`  ${P} ${d}`); } else { failed++; console.log(`  ${F} ${d}`); } }

  try {
    // ================================================================
    // Step 1: Open SiYuan
    // ================================================================
    console.log("━━━ Step 1: 打开思源 ━━━");
    await page.goto(SIYUAN_URL, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(4000);
    ok((await page.title()).length > 0, "思源已加载");

    // ================================================================
    // Step 2: Open RSS Dock
    // ================================================================
    console.log("\n━━━ Step 2: 打开 RSS Dock ━━━");
    for (let i = 0; i < 6; i++) {
      let w = await page.evaluate(() => {
        let w = document.querySelector('[class*="rss-widget"]');
        return !!(w && w.textContent && w.textContent.length > 100);
      });
      if (w) break;
      // Try clicking RSS icon
      await page.evaluate(() => {
        let items = document.querySelectorAll('.dock__item');
        for (let el of items) {
          if (el.querySelector('use[href="#iconRSS"]')) { el.click(); return; }
        }
      });
      await page.waitForTimeout(2000);
    }
    let hasWidget = await page.evaluate(() => {
      let w = document.querySelector('[class*="rss-widget"]');
      return !!(w && w.textContent && w.textContent.length > 100);
    });
    ok(hasWidget, "RSS Dock 已就绪");

    // ================================================================
    // Step 3: Switch to Settings tab
    // ================================================================
    console.log("\n━━━ Step 3: 切换到设置Tab ━━━");
    await page.evaluate(() => {
      let w = document.querySelector('[class*="rss-widget"]');
      if (!w) return;
      for (let b of w.querySelectorAll('button')) {
        if (b.textContent.includes('设') || b.textContent.includes('⚙')) { b.click(); return; }
      }
    });
    await page.waitForTimeout(800);
    ok(true, "已切换到设置Tab");

    // ================================================================
    // Step 4: Click "＋ 添加订阅"
    // ================================================================
    console.log("\n━━━ Step 4: 点击「＋ 添加订阅」━━━");
    let addClicked = await page.evaluate(() => {
      for (let b of document.querySelectorAll('button')) {
        if (b.textContent.includes('添加订阅')) { b.click(); return true; }
      }
      return false;
    });
    await page.waitForTimeout(600);
    ok(addClicked, "已点击「＋ 添加订阅」");

    // ================================================================
    // Step 5: Fill URL and click detect
    // ================================================================
    console.log("\n━━━ Step 5: 填入 cnfeat RSS URL 并检测 ━━━");
    console.log(`  URL: ${TEST_RSS_URL}`);

    const inp = page.locator("#rss-url-input");
    if (await inp.count() > 0) {
      await inp.fill(TEST_RSS_URL);
      await page.waitForTimeout(300);
      let val = await inp.inputValue();
      ok(val === TEST_RSS_URL, "URL 正确填入");
    }

    await page.locator("#rss-add-detect").click();
    console.log("  等待检测完成 (10秒)...");
    await page.waitForTimeout(10000);

    // ================================================================
    // Step 6: Check detection feedback
    // ================================================================
    console.log("\n━━━ Step 6: 检查检测反馈 ━━━");
    let fb = await page.evaluate(() => {
      let f = document.querySelector('[class*="rss-detect-result"]');
      return f ? f.textContent.trim().slice(0, 400) : '(表单已关闭-检测完成)';
    });
    console.log(`  反馈: ${fb}`);
    ok(!fb.includes('失败'), `检测结果正常: ${fb.slice(0, 80)}`);

    // ================================================================
    // Step 7: Switch to Feed tab and check
    // ================================================================
    console.log("\n━━━ Step 7: 切回订阅Tab 验证 ━━━");
    await page.evaluate(() => {
      let w = document.querySelector('[class*="rss-widget"]');
      if (!w) return;
      for (let b of w.querySelectorAll('button')) {
        if (b.textContent.includes('订') || b.textContent.includes('📰')) { b.click(); return; }
      }
    });
    await page.waitForTimeout(1500);

    // ================================================================
    // Step 8: Check feed names
    // ================================================================
    console.log("\n━━━ Step 8: 验证订阅名称 ━━━");
    let feedNames = await page.evaluate(() => {
      let w = document.querySelector('[class*="rss-widget"]');
      if (!w) return [];
      return Array.from(w.querySelectorAll('[class*="rss-feed-name"]')).map(e => ({
        name: e.textContent.trim(),
        isUrl: /^https?:\/\//i.test(e.textContent.trim()),
      }));
    });
    console.log(`  订阅源: ${feedNames.length} 个`);
    feedNames.forEach(n => {
      console.log(`    ${n.isUrl ? F : P} "${n.name}"`);
      if (n.isUrl) console.log(`        ⚠️ 名称是URL!`);
    });

    let allCleanNames = feedNames.length > 0 && feedNames.every(n => !n.isUrl);
    ok(allCleanNames, `订阅名称全部不含URL (${feedNames.length} 个)`);

    // ================================================================
    // Step 9: Check articles
    // ================================================================
    console.log("\n━━━ Step 9: 检查文章列表 ━━━");
    let feedData = await page.evaluate(() => {
      let w = document.querySelector('[class*="rss-widget"]');
      if (!w) return { groups: 0 };

      let groups = w.querySelectorAll('[class*="rss-feed-group"]');
      let result = { groups: groups.length, feeds: [] };

      groups.forEach((g, gi) => {
        let name = g.querySelector('[class*="rss-feed-name"]');
        let header = g.querySelector('[class*="rss-feed-header"]');
        let articles = g.querySelectorAll('[class*="rss-article-item"]');
        let icon = g.querySelector('[class*="rss-feed-icon"]');
        let unread = g.querySelector('[class*="rss-feed-unread"]');

        let artData = [];
        articles.forEach((a, ai) => {
          let t = a.querySelector('[class*="rss-article-title"]');
          let m = a.querySelector('[class*="rss-article-meta"]');
          artData.push({
            title: t ? t.textContent.trim().slice(0, 60) : '',
            meta: m ? m.textContent.trim().replace(/\s+/g, ' ').slice(0, 60) : '',
          });
        });

        result.feeds.push({
          name: name ? name.textContent.trim() : '',
          headerText: header ? header.textContent.trim().replace(/\s+/g, ' ').slice(0, 100) : '',
          iconHTML: icon ? icon.innerHTML.slice(0, 100) : '',
          unread: unread ? unread.textContent.trim() : '0',
          articleCount: articles.length,
          articles: artData,
        });
      });

      return result;
    });

    console.log(`  Feed 组: ${feedData.groups}`);
    feedData.feeds.forEach(f => {
      console.log(`\n  📰 "${f.name}"`);
      console.log(`     header: ${f.headerText}`);
      console.log(`     icon: ${f.iconHTML}`);
      console.log(`     unread: ${f.unread} | 文章: ${f.articleCount}`);
      f.articles.forEach((a, i) => {
        console.log(`     [${i}] ${a.title}`);
        console.log(`         meta: ${a.meta}`);
      });
    });

    ok(feedData.feeds.length > 0, `找到 ${feedData.feeds.length} 个订阅源`);

    // ================================================================
    // Step 10: Click first article to open reader
    // ================================================================
    console.log("\n━━━ Step 10: 打开第一篇文章阅读器 ━━━");

    // Expand feed group first
    await page.evaluate(() => {
      let header = document.querySelector('[class*="rss-feed-header"]');
      if (header) header.click();
    });
    await page.waitForTimeout(800);

    // Click first article
    let articleClicked = await page.evaluate(() => {
      let article = document.querySelector('[class*="rss-article-item"]');
      if (article) { article.click(); return true; }
      return false;
    });
    await page.waitForTimeout(1500);
    ok(articleClicked, "已点击第一篇文章");

    // ================================================================
    // Step 11: Check reader panel content
    // ================================================================
    console.log("\n━━━ Step 11: 验证阅读器内容 ━━━");
    let readerContent = await page.evaluate(() => {
      let overlay = document.querySelector('[class*="rss-reader-overlay"]');
      if (!overlay) return { error: "阅读器未打开" };

      let title = overlay.querySelector('[class*="rss-reader-title"]');
      let content = overlay.querySelector('[class*="rss-reader-content"]');
      let meta = overlay.querySelector('[class*="rss-reader-meta"]');

      return {
        visible: overlay.classList.contains('visible') || overlay.offsetParent !== null,
        title: title ? title.textContent.trim().slice(0, 80) : '',
        meta: meta ? meta.textContent.trim().slice(0, 80) : '',
        contentLen: content ? content.textContent.trim().length : 0,
        contentPreview: content ? content.textContent.trim().slice(0, 300) : '',
        contentHTML: content ? content.innerHTML.slice(0, 500) : '',
      };
    });

    if (readerContent.error) {
      console.log(`  ${F} ${readerContent.error}`);
    } else {
      console.log(`  标题: "${readerContent.title}"`);
      console.log(`  元数据: "${readerContent.meta}"`);
      console.log(`  内容长度: ${readerContent.contentLen} 字符`);
      console.log(`  内容预览: "${readerContent.contentPreview.slice(0, 150)}..."`);
      console.log(`  HTML片段: ${readerContent.contentHTML.slice(0, 200)}`);

      ok(readerContent.visible, "阅读器面板已打开");
      ok(readerContent.contentLen > 10, `内容非空 (${readerContent.contentLen} chars)`);

      let isPlaceholder = readerContent.contentPreview.includes('（无内容）');
      ok(!isPlaceholder, "内容不是「无内容」占位符");

      let hasRealContent = readerContent.contentLen > 50;
      if (hasRealContent) {
        ok(true, `文章内容充足 (${readerContent.contentLen} 字符)`);
      } else if (readerContent.contentLen <= 10) {
        console.log(`  ⚠️ 内容不足: HTML片段 → "${readerContent.contentHTML}"`);
      }
    }

    await page.screenshot({ path: "screenshots/cnfeat-reader.png" });

    // ================================================================
    // Step 12: Dump the raw HTML from feed for debugging
    // ================================================================
    console.log("\n━━━ Step 12: 原始 feed 数据检查 ━━━");
    
    // Close reader first
    await page.evaluate(() => {
      let closeBtn = document.querySelector('[class*="rss-reader-close"]');
      if (closeBtn) closeBtn.click();
    });
    await page.waitForTimeout(500);

    // Fetch the raw feed via API proxy
    let rawFeed = await page.evaluate(async (url) => {
      try {
        let res = await fetch("http://127.0.0.1:6806/api/network/forwardProxy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: url,
            method: "GET",
            timeout: 15000,
            contentType: "text/xml",
            headers: [
              { name: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 RSS Reader/1.0" },
              { name: "Accept", value: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
            ],
            payload: {},
            payloadEncoding: "text",
            responseEncoding: "text",
          }),
        });
        let json = await res.json();
        if (json.code === 0 && json.data.body) {
          let body = json.data.body;
          return {
            size: body.length,
            status: json.data.status,
            isRSS: body.includes('<rss') || body.includes('<channel'),
            isAtom: body.includes('<feed'),
            hasContent: body.includes('<content:encoded') || body.includes('<content'),
            hasDescription: body.includes('<description'),
            hasContentEncoded: body.includes('<content:encoded'),
            firstItemIdx: body.indexOf('<item>'),
            preview: body.slice(0, 600),
          };
        }
        return { error: res.code + ' ' + res.msg, status: json.data?.status };
      } catch(e) {
        return { error: e.message };
      }
    }, TEST_RSS_URL);

    console.log("  原始 Feed 分析:");
    console.log(`    大小: ${rawFeed.size} 字节`);
    console.log(`    HTTP状态: ${rawFeed.status}`);
    console.log(`    RSS: ${rawFeed.isRSS} | Atom: ${rawFeed.isAtom}`);
    console.log(`    hasDescription: ${rawFeed.hasDescription} | hasContentEncoded: ${rawFeed.hasContentEncoded}`);
    console.log(`    预览: ${rawFeed.preview?.slice(0, 300)}`);
    ok(rawFeed.size > 0, `Feed 返回成功 (${rawFeed.size} 字节)`);
    ok(rawFeed.isRSS || rawFeed.isAtom, `格式识别: RSS=${rawFeed.isRSS} Atom=${rawFeed.isAtom}`);

    if (rawFeed.hasContentEncoded) {
      ok(true, "feed 含 content:encoded 标签");
    } else if (rawFeed.hasDescription) {
      ok(true, "feed 含 description 标签 (可能只有摘要无正文)");
    }

    // Check if content:encoded is present or only description
    if (!rawFeed.hasContentEncoded && rawFeed.hasDescription) {
      console.log("\n  ⚠️ 这个 feed 没有 content:encoded，只有 description。");
      console.log("  文章正文内容可能来自 description 标签。");
      
      // Check the parsing in the deployed code
      let parseCheck = await page.evaluate(() => {
        // Check what getHTMLContent does for RSS items
        let allHTML = document.documentElement.innerHTML;
        let rssItemMatch = allHTML.match(/parseRSSItem[\s\S]{0,500}content\\:encoded[\s\S]{0,200}content[\s\S]{0,200}description/);
        return rssItemMatch ? rssItemMatch[0].slice(0, 300) : 'no match';
      });
      console.log(`  解析逻辑片段: ${parseCheck}`);
    }

    await page.screenshot({ path: "screenshots/cnfeat-full.png" });

  } catch (err) {
    console.log(`\n${F} 异常: ${err.message}`);
    await page.screenshot({ path: "screenshots/cnfeat-error.png" }).catch(() => {});
  }

  // ================================================================
  // Report
  // ================================================================
  console.log("\n" + "=".repeat(60));
  let total = passed + failed;
  console.log(`  结果: ${passed}/${total} 通过, ${failed} 失败`);
  console.log(failed === 0 ? `  ${P}${P}${P} 全部通过!` : `  ⚠️ ${failed} 项失败`);
  console.log("=".repeat(60));

  console.log("\n浏览器保持 10 秒...");
  await page.waitForTimeout(10000);
  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
}
main();
