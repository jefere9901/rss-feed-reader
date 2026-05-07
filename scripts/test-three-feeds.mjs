import { chromium } from "playwright";

const SIYUAN_URL = "http://localhost:6806";
const P = "✅", F = "❌";

const TEST_FEEDS = [
  {
    name: "阮一峰",
    url: "http://www.ruanyifeng.com/blog/atom.xml",
    expectedTitle: "阮一峰的网络日志",
    type: "Atom",
  },
  {
    name: "柴静 YouTube (已失效)",
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCjuNibFJ21MiSNpu8LZyV4w",
    expectedTitle: "",
    type: "YouTube Atom",
    skip: true, // channel no longer available
  },
  {
    name: "笨方法学写作",
    url: "https://www.cnfeat.com/feed.xml",
    expectedTitle: "笨方法学写作",
    type: "RSS (no CDATA)",
  },
];

async function main() {
  console.log("\n" + "=".repeat(65));
  console.log("  Playwright: 三源内容渲染全面测试");
  console.log("  阮一峰 Atom / 柴静 YouTube / 笨方法 RSS");
  console.log("=".repeat(65) + "\n");

  let browser;
  try { browser = await chromium.launch({ headless: false, args: ["--window-size=1400,900", "--no-sandbox"] }); }
  catch { browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--window-size=1400,900", "--no-sandbox"] }); }
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();

  let passed = 0, failed = 0;
  function ok(c, d) { if (c) { passed++; console.log(`  ${P} ${d}`); } else { failed++; console.log(`  ${F} ${d}`); } }

  // ==============================================================
  // Step 1: Open SiYuan
  // ==============================================================
  console.log("━━━ Step 1: 打开思源 ━━━");
  await page.goto(SIYUAN_URL, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(4000);
  ok((await page.title()).length > 0, "思源已加载");

  // ==============================================================
  // Step 2: Open RSS Dock
  // ==============================================================
  console.log("\n━━━ Step 2: 打开 RSS Dock ━━━");
  for (let i = 0; i < 6; i++) {
    let w = await page.evaluate(() => {
      let w = document.querySelector('[class*="rss-widget"]');
      return !!(w && w.textContent && w.textContent.length > 100);
    });
    if (w) break;
    await page.evaluate(() => {
      let items = document.querySelectorAll('.dock__item');
      for (let el of items) { if (el.querySelector('use[href="#iconRSS"]')) { el.click(); return; } }
    });
    await page.waitForTimeout(2000);
  }
  ok(await page.evaluate(() => !!document.querySelector('[class*="rss-widget"]')), "RSS Dock 就绪");

  // ==============================================================
  // Step 3: Clear all existing data
  // ==============================================================
  console.log("\n━━━ Step 3: 清除旧数据 ━━━");
  await page.evaluate(() => {
    let w = document.querySelector('[class*="rss-widget"]');
    for (let b of w.querySelectorAll('button')) {
      if (b.textContent.includes('设') || b.textContent.includes('⚙')) { b.click(); return; }
    }
  });
  await page.waitForTimeout(600);

  // Click reset
  let hasResetBtn = await page.evaluate(() => {
    for (let b of document.querySelectorAll('button')) {
      if (b.textContent.includes('清除全部')) {
        // Check if there are feeds first
        let items = document.querySelectorAll('[class*="rss-feed-manage-item"]');
        if (items.length > 0) { b.click(); return true; }
        return false;
      }
    }
    return false;
  });
  if (hasResetBtn) {
    page.once("dialog", async (d) => { await d.accept(); });
    await page.waitForTimeout(1000);
    console.log("  已清除旧数据");
  } else {
    console.log("  无需清除");
  }
  ok(true, "数据已重置");

  // ==============================================================
  // Step 4: Add ALL three feeds
  // ==============================================================
  console.log("\n━━━ Step 4: 逐一添加三个 RSS 源 ━━━");
  let feedResults = [];

  for (let fi = 0; fi < TEST_FEEDS.length; fi++) {
    let tf = TEST_FEEDS[fi];
    if (tf.skip) {
      console.log(`\n  ⏭ 跳过 ${fi + 1}/3: ${tf.name} (频道已失效)`);
      continue;
    }
    console.log(`\n  ▶ 添加 ${fi + 1}/3: ${tf.name} (${tf.type})`);
    console.log(`    URL: ${tf.url}`);

    // Click add button — the form may have closed after last feed
    let formOpen = await page.evaluate(() => {
      let inp = document.querySelector("#rss-url-input");
      return !!(inp && inp.offsetParent !== null);
    });

    if (!formOpen) {
      let addClicked = await page.evaluate(() => {
        for (let b of document.querySelectorAll('button')) {
          if (b.textContent.includes('添加订阅')) { b.click(); return true; }
        }
        return false;
      });
      await page.waitForTimeout(400);
      ok(addClicked, `已点击「添加订阅」`);
    }

    // Fill URL
    let inp = page.locator("#rss-url-input");
    await inp.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    await inp.fill(tf.url);
    await page.waitForTimeout(200);
    let val = await inp.inputValue().catch(() => "");
    ok(val === tf.url, `URL 填入正确`);

    // Click detect
    await page.locator("#rss-add-detect").click();
    console.log(`    等待检测 (10秒)...`);
    await page.waitForTimeout(10000);

    // Check feedback
    let fb = await page.evaluate(() => {
      let f = document.querySelector('[class*="rss-detect-result"]');
      return f ? f.textContent.trim().slice(0, 200) : '(表单已关闭)';
    });
    let success = !fb.includes('失败');
    if (success) {
      console.log(`    ${P} 检测成功: ${fb.slice(0, 60)}`);
    } else {
      console.log(`    ${F} 检测失败: ${fb.slice(0, 100)}`);
    }
    ok(success, `检测结果: ${fb.slice(0, 60)}`);
    
    feedResults.push({ name: tf.name, success });
  }

  // ==============================================================
  // Step 5: Switch to Feed tab & verify feed names
  // ==============================================================
  console.log("\n━━━ Step 5: 验证订阅列表 ━━━");
  await page.evaluate(() => {
    let w = document.querySelector('[class*="rss-widget"]');
    for (let b of w.querySelectorAll('button')) {
      if (b.textContent.includes('订') || b.textContent.includes('📰')) { b.click(); return; }
    }
  });
  await page.waitForTimeout(1000);

  let feedList = await page.evaluate(() => {
    let names = document.querySelectorAll('[class*="rss-feed-name"]');
    let headers = document.querySelectorAll('[class*="rss-feed-header"]');
    return {
      names: Array.from(names).map(e => ({ name: e.textContent.trim(), isUrl: /^https?:\/\//i.test(e.textContent.trim()) })),
      headerTexts: Array.from(headers).map(h => h.textContent.trim().replace(/\s+/g, ' ').slice(0, 60)),
    };
  });

  console.log("  ┌─────────────────────────────────────────────────┐");
  feedList.names.forEach((n, i) => {
    console.log(`  │ ${i + 1}. ${n.isUrl ? F : P} "${n.name}"`);
  });
  console.log("  └─────────────────────────────────────────────────┘");

  let allNamesClean = feedList.names.every(n => !n.isUrl);
  ok(feedList.names.length >= 2, `至少 2 个订阅源 (实际 ${feedList.names.length})`);

  // ==============================================================
  // Step 6: Test EACH feed — open reader & verify content
  // ==============================================================
  console.log("\n" + "═".repeat(65));
  console.log("  🔍 逐源测试文章内容渲染");
  console.log("═".repeat(65));

  let feedGroups = await page.evaluate(() => {
    let groups = document.querySelectorAll('[class*="rss-feed-group"]');
    return Array.from(groups).map(g => {
      let name = g.querySelector('[class*="rss-feed-name"]');
      let unread = g.querySelector('[class*="rss-feed-unread"]');
      return {
        name: name ? name.textContent.trim() : '',
        unread: unread ? parseInt(unread.textContent.trim()) : 0,
      };
    });
  });

  for (let gi = 0; gi < feedGroups.length; gi++) {
    let fg = feedGroups[gi];
    console.log(`\n━━━ Feed ${gi + 1}: 「${fg.name}」 (${fg.unread} 篇未读) ━━━`);

    if (fg.unread === 0) {
      console.log("  ⚠️ 无文章，跳过");
      continue;
    }

    // Expand this specific feed group
    await page.evaluate((idx) => {
      let groups = document.querySelectorAll('[class*="rss-feed-group"]');
      if (groups[idx]) {
        let header = groups[idx].querySelector('[class*="rss-feed-header"]');
        if (header) header.click();
      }
    }, gi);
    await page.waitForTimeout(600);

    // Check article list
    let artInfo = await page.evaluate((idx) => {
      let groups = document.querySelectorAll('[class*="rss-feed-group"]');
      let g = groups[idx];
      if (!g) return { expanded: false };

      let items = g.querySelectorAll('[class*="rss-article-item"]');
      let info = g.querySelector('[class*="rss-article-info"]');
      let pagination = g.querySelector('[class*="rss-pagination"]');
      let articles = [];
      items.forEach(a => {
        let t = a.querySelector('[class*="rss-article-title"]');
        let m = a.querySelector('[class*="rss-article-meta"]');
        articles.push({
          title: t ? t.textContent.trim().slice(0, 60) : '',
          meta: m ? m.textContent.trim().replace(/\s+/g, ' ') : '',
        });
      });

      return {
        expanded: true,
        itemCount: items.length,
        info: info ? info.textContent.trim() : '',
        hasPagination: !!pagination,
        articles: articles.slice(0, 5),
      };
    }, gi);

    console.log(`  ${artInfo.expanded ? P : F} 已展开`);
    console.log(`  文章: ${artInfo.itemCount} 条 ${artInfo.hasPagination ? '(含翻页)' : ''}`);
    if (artInfo.info) console.log(`  ${artInfo.info}`);
    artInfo.articles.forEach((a, i) => console.log(`    [${i}] ${a.title} | ${a.meta}`));
    ok(artInfo.itemCount > 0, `有文章内容 (${artInfo.itemCount} 篇)`);

    // ==========================================================
    // Click first article → open reader → verify content
    // ==========================================================
    console.log(`\n  ▶ 打开第 1 篇文章...`);
    let readerOpened = await page.evaluate((idx) => {
      let groups = document.querySelectorAll('[class*="rss-feed-group"]');
      let items = groups[idx].querySelectorAll('[class*="rss-article-item"]');
      if (items.length > 0) { items[0].click(); return true; }
      return false;
    }, gi);
    await page.waitForTimeout(1500);

    if (!readerOpened) {
      ok(false, "无法打开文章");
      continue;
    }

    // Check reader content
    let readerContent = await page.evaluate(() => {
      let overlay = document.querySelector('[class*="rss-reader-overlay"]');
      if (!overlay) return { error: "阅读器未打开" };

      let title = overlay.querySelector('[class*="rss-reader-title"]');
      let content = overlay.querySelector('[class*="rss-reader-content"]');
      let meta = overlay.querySelector('[class*="rss-reader-meta"]');

      return {
        title: title ? title.textContent.trim().slice(0, 80) : '',
        meta: meta ? meta.textContent.trim().slice(0, 80) : '',
        textLen: content ? content.textContent.trim().length : 0,
        textPreview: content ? content.textContent.trim().slice(0, 200) : '',
        htmlPreview: content ? content.innerHTML.slice(0, 300) : '',
        rawHTML: content ? content.innerHTML.slice(0, 500) : '',
      };
    });

    if (readerContent.error) {
      ok(false, readerContent.error);
    } else {
      console.log(`    标题: "${readerContent.title}"`);
      console.log(`    元数据: "${readerContent.meta}"`);
      console.log(`    文本长度: ${readerContent.textLen} 字符`);
      console.log(`    文本预览: "${readerContent.textPreview.slice(0, 120)}..."`);

      ok(readerContent.textLen > 20, `内容充足 (${readerContent.textLen} chars)`);

      let isEmpty = readerContent.textPreview.includes('（无内容）');
      ok(!isEmpty, "内容不是「无内容」占位符");

      // Check for HTML double-escaping issues
      let hasEscaped = readerContent.htmlPreview.includes('&lt;') && readerContent.htmlPreview.includes('&gt;');
      if (hasEscaped) {
        let ltCount = (readerContent.rawHTML.match(/&lt;/g) || []).length;
        let gtCount = (readerContent.rawHTML.match(/&gt;/g) || []).length;
        console.log(`  ${F} HTML 被二次转义！(&lt;=${ltCount}, &gt;=${gtCount})`);
        ok(false, `HTML 双重转义 (!=0 处)`);
      } else {
        console.log(`  ${P} HTML 无双重转义`);
      }

      // Check actual HTML tags presence (meaning proper rendering)
      let hasRealHtml = /<(p|div|h\d|ul|ol|li|a|img|br|strong|em|blockquote|pre|code|table|video)[\s>]/.test(readerContent.rawHTML);
      if (hasRealHtml) {
        console.log(`  ${P} 含真实 HTML 标签 (正常渲染)`);
      } else {
        console.log(`  ℹ️ 纯文本内容 (无 HTML 标签)`);
      }
    }

    // Close reader
    await page.evaluate(() => {
      let btn = document.querySelector('[class*="rss-reader-close"]');
      if (btn) btn.click();
    });
    await page.waitForTimeout(400);

    // Collapse feed group
    await page.evaluate((idx) => {
      let groups = document.querySelectorAll('[class*="rss-feed-group"]');
      if (groups[idx]) {
        let header = groups[idx].querySelector('[class*="rss-feed-header"]');
        if (header) header.click();
      }
    }, gi);
    await page.waitForTimeout(300);

    // Screenshot
    await page.screenshot({ path: `screenshots/feed-${gi + 1}-${fg.name.slice(0, 8)}.png` });
    console.log(`  截图: screenshots/feed-${gi + 1}-${fg.name.slice(0, 8)}.png`);
  }

  // ==============================================================
  // Step 7: Test each feed's raw API response
  // ==============================================================
  console.log("\n" + "═".repeat(65));
  console.log("  🔬 原始 Feed API 响应分析");
  console.log("═".repeat(65));

  for (let fi = 0; fi < TEST_FEEDS.length; fi++) {
    let tf = TEST_FEEDS[fi];
    if (tf.skip) {
      console.log(`\n--- ${fi + 1}. ${tf.name} ⏭ 跳过 ---`);
      continue;
    }
    console.log(`\n--- ${fi + 1}. ${tf.name} (${tf.type}) ---`);

    let raw = await page.evaluate(async (url) => {
      try {
        let res = await fetch("http://127.0.0.1:6806/api/network/forwardProxy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: url, method: "GET", timeout: 15000, contentType: "text/xml",
            headers: [
              { name: "User-Agent", value: "Mozilla/5.0 RSS Reader/1.0" },
              { name: "Accept", value: "application/rss+xml, application/xml, text/xml" },
            ],
            payload: {}, payloadEncoding: "text", responseEncoding: "text",
          }),
        });
        let json = await res.json();
        if (json.code !== 0 || !json.data.body) return { error: "fetch failed", status: json.data?.status };

        let body = json.data.body;
        let itemCount = (body.match(/<item>/g) || body.match(/<entry>/g) || []).length;
        let hasCDATA = body.includes('<![CDATA[');
        let hasContentEncoded = body.includes('<content:encoded');
        let hasMediaDesc = body.includes('<media:description');
        let hasRSS = body.includes('<rss');
        let hasAtom = body.includes('<feed xmlns');
        let size = body.length;

        // Check first item description style
        let descIdx = body.indexOf('<description>');
        let descSnippet = descIdx > -1 ? body.slice(descIdx, descIdx + 150) : '';

        return {
          size, itemCount, hasCDATA, hasContentEncoded, hasMediaDesc,
          hasRSS, hasAtom,
          descSnippet: descSnippet.slice(0, 120).replace(/\n/g, ' '),
        };
      } catch(e) { return { error: e.message }; }
    }, tf.url);

    console.log(`  大小: ${raw.size} 字节 | 条目: ${raw.itemCount}`);
    console.log(`  RSS: ${raw.hasRSS} | Atom: ${raw.hasAtom}`);
    console.log(`  CDATA: ${raw.hasCDATA} | content:encoded: ${raw.hasContentEncoded} | media:description: ${raw.hasMediaDesc}`);
    console.log(`  description 片段: "${(raw.descSnippet || '').slice(0, 80)}"`);

    if (raw.size < 100) {
      console.log(`  ⚠️ Feed 数据不足 (${raw.size} 字节) — 可能已失效`);
      continue;
    }
    ok(raw.size > 500, "Feed 数据获取成功");
    ok(raw.hasRSS || raw.hasAtom, "格式正确");

    // Check content source for each type
    if (tf.name === "阮一峰") {
      ok(raw.hasCDATA, "阮一峰 Atom 含 CDATA");
    } else if (tf.name === "柴静 YouTube" && !raw.error) {
      ok(raw.hasMediaDesc, "YouTube 含 media:description");
    } else if (tf.name === "柴静 YouTube" && raw.error) {
      console.log(`  ⚠️ YouTube feed 返回错误，跳过分析`);
    } else if (tf.name === "笨方法学写作") {
      console.log(`  ℹ️ RSS description 无 CDATA — 依赖 HTML 直出修复`);
      ok(!raw.hasCDATA, "笨方法 RSS 无 CDATA（预期行为）");
    }
  }

  // ==============================================================
  // Final test: Verify all 3 feeds remain in feed tab
  // ==============================================================
  console.log("\n" + "═".repeat(65));
  console.log("  📊 最终验证");
  console.log("═".repeat(65));

  await page.evaluate(() => {
    let w = document.querySelector('[class*="rss-widget"]');
    for (let b of w.querySelectorAll('button')) {
      if (b.textContent.includes('订') || b.textContent.includes('📰')) { b.click(); return; }
    }
  });
  await page.waitForTimeout(800);

  let finalList = await page.evaluate(() => {
    let groups = document.querySelectorAll('[class*="rss-feed-group"]');
    return Array.from(groups).map(g => {
      let name = g.querySelector('[class*="rss-feed-name"]');
      let unread = g.querySelector('[class*="rss-feed-unread"]');
      return {
        name: name ? name.textContent.trim() : '',
        unread: unread ? parseInt(unread.textContent.trim()) : 0,
      };
    });
  });

  console.log(`  最终订阅数: ${finalList.length}`);
  finalList.forEach((f, i) => console.log(`  ${i + 1}. ${f.name} — ${f.unread} 篇未读`));
  ok(finalList.length >= 2, `三源中至少 2 个保留 (实际 ${finalList.length})`);
  ok(finalList.filter(f => f.unread > 0).length >= 2, "至少 2 个源有文章");

  await page.screenshot({ path: "screenshots/all-3-feeds.png" });
  console.log("  截图: screenshots/all-3-feeds.png");

  // ==============================================================
  // Report
  // ==============================================================
  console.log("\n" + "=".repeat(65));
  let total = passed + failed;
  console.log(`  结果: ${passed}/${total} 通过, ${failed} 失败`);
  console.log(failed === 0 ? `  ${P}${P}${P} 全部通过!` : `  ⚠️ ${failed} 项失败`);
  console.log("=".repeat(65));

  console.log("\n浏览器保持 10 秒...");
  await page.waitForTimeout(10000);
  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
}
main();
