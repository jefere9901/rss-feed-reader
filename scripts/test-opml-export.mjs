import { chromium } from "playwright";
import { readFileSync } from "fs";

const SIYUAN_URL = "http://localhost:6806";
const TEST_RSS_URL = "http://www.ruanyifeng.com/blog/atom.xml";
const P = "✅", F = "❌";

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("  Playwright E2E: OPML 导出功能测试");
  console.log("=".repeat(60) + "\n");

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

  try {
    // =================================================================
    // Step 1: Open SiYuan
    // =================================================================
    console.log("━━━ Step 1: 打开思源 ━━━");
    await page.goto(SIYUAN_URL, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(4000);
    ok((await page.title()).length > 0, "思源已加载");

    // =================================================================
    // Step 2: Open RSS Dock
    // =================================================================
    console.log("\n━━━ Step 2: 打开 RSS Dock ━━━");
    for (let i = 0; i < 6; i++) {
      let w = await page.evaluate(() => {
        let w = document.querySelector('[class*="rss-widget"]');
        return !!(w && w.textContent && w.textContent.length > 100);
      });
      if (w) break;
      await page.waitForTimeout(2000);
    }
    let hasWidget = await page.evaluate(() => {
      let w = document.querySelector('[class*="rss-widget"]');
      return !!(w && w.textContent && w.textContent.length > 100);
    });
    ok(hasWidget, "RSS Dock 已就绪");

    // =================================================================
    // Step 3: First ensure we have feeds to export
    // =================================================================
    console.log("\n━━━ Step 3: 确保有订阅源可导出 ━━━");

    // Check if we already have feeds
    let feedCount = await page.evaluate(() => {
      let w = document.querySelector('[class*="rss-widget"]');
      if (!w) return 0;
      let btns = w.querySelectorAll('button');
      for (let b of btns) {
        if (b.textContent.includes('订阅') && b.querySelector('[class*="badge"]')) {
          let badge = b.querySelector('[class*="badge"]');
          return badge ? parseInt(badge.textContent || '0') : 0;
        }
      }
      return 0;
    });

    // Switch to settings and check
    await page.evaluate(() => {
      let w = document.querySelector('[class*="rss-widget"]');
      for (let b of w.querySelectorAll('button')) {
        if (b.textContent.includes('设') || b.textContent.includes('⚙')) { b.click(); return; }
      }
    });
    await page.waitForTimeout(800);

    let hasFeeds = await page.evaluate(() => {
      let items = document.querySelectorAll('[class*="rss-feed-manage-item"]');
      return items.length > 0;
    });
    console.log(`  已有订阅源: ${hasFeeds}`);

    if (!hasFeeds) {
      console.log("  添加测试订阅源...");
      // Click add button
      await page.evaluate(() => {
        for (let b of document.querySelectorAll('button')) {
          if (b.textContent.includes('添加订阅')) { b.click(); return; }
        }
      });
      await page.waitForTimeout(500);

      // Fill URL
      const inp = page.locator("#rss-url-input");
      if (await inp.count() > 0) {
        await inp.fill(TEST_RSS_URL);
        await page.waitForTimeout(300);
      }

      // Click detect
      await page.locator("#rss-add-detect").click();
      console.log("  等待检测完成...");
      await page.waitForTimeout(10000);

      // Verify feed was added
      hasFeeds = await page.evaluate(() => {
        let items = document.querySelectorAll('[class*="rss-feed-manage-item"]');
        return items.length > 0;
      });
    }
    ok(hasFeeds, "至少有一个订阅源可导出");

    // =================================================================
    // Step 4: Intercept download and click Export OPML
    // =================================================================
    console.log("\n━━━ Step 4: 点击「导出 OPML」并拦截下载 ━━━");

    // Set up download interception
    let downloadPromise = page.waitForEvent("download", { timeout: 10000 });

    let exportClicked = await page.evaluate(() => {
      for (let b of document.querySelectorAll('button')) {
        if (b.textContent.includes('导出 OPML') || b.textContent.includes('📤')) {
          b.click();
          return true;
        }
      }
      return false;
    });
    ok(exportClicked, "已点击「导出 OPML」按钮");

    let download;
    try {
      download = await downloadPromise;
      ok(true, "下载事件已触发");
    } catch {
      ok(false, "下载事件未触发");
    }

    // =================================================================
    // Step 5: Verify downloaded OPML file
    // =================================================================
    console.log("\n━━━ Step 5: 验证 OPML 文件内容 ━━━");

    if (download) {
      const fileName = download.suggestedFilename();
      console.log(`  文件名: ${fileName}`);
      ok(fileName === "rss-subscriptions.opml", `文件名正确: "${fileName}"`);

      // Save and read the file
      const savePath = "screenshots/exported-test.opml";
      await download.saveAs(savePath);
      console.log(`  已保存: ${savePath}`);

      const opmlContent = readFileSync(savePath, "utf-8");
      console.log(`  文件大小: ${opmlContent.length} 字节`);

      // Verify OPML structure
      ok(opmlContent.includes('<?xml version="1.0"'), "包含 XML 声明");
      ok(opmlContent.includes('<opml version="2.0">'), "包含 opml 根元素");
      ok(opmlContent.includes('<head>'), "包含 head 元素");
      ok(opmlContent.includes('<body>'), "包含 body 元素");
      ok(opmlContent.includes('</opml>'), "包含 opml 闭合标签");

      // Verify outline elements
      ok(opmlContent.includes('<outline text="'), "包含 outline 元素");
      ok(opmlContent.includes('type="rss"'), "outline 含 type='rss' 属性");
      ok(opmlContent.includes('xmlUrl="http'), "outline 含 xmlUrl 属性");

      // Verify no raw URLs in text attributes (should use escaped values)
      let hasEscaped = opmlContent.includes("&amp;") || opmlContent.includes("&quot;");
      // This is optional — some feeds won't have & or " in their name
      console.log(`  XML 转义检测: ${hasEscaped ? "包含转义字符" : "无特殊字符无需转义"}`);

      // Verify contains the test feed
      if (hasFeeds) {
        let foundFeed = opmlContent.includes("阮一峰") || opmlContent.includes("ruanyifeng");
        if (foundFeed) {
          console.log(`  ${P} OPML 包含导入的订阅源`);
        } else {
          // Check for any feed name
          let nameMatch = opmlContent.match(/text="([^"]+)"/g);
          if (nameMatch && nameMatch.length > 0) {
            console.log(`  ${P} OPML 包含 ${nameMatch.length} 个 outline 条目`);
            nameMatch.slice(0, 5).forEach(m => console.log(`    ${m}`));
          }
        }
      }

      // Print a snippet
      console.log("\n  OPML 预览:");
      opmlContent.split("\n").slice(0, 15).forEach(l => console.log(`    ${l}`));
      if (opmlContent.split("\n").length > 15) console.log("    ...");

      // =================================================================
      // Step 6: Round-trip test — parse the exported OPML
      // =================================================================
      console.log("\n━━━ Step 6: 往返测试（解析导出的 OPML）━━━");
      const parseResult = await page.evaluate((opml) => {
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(opml, "text/xml");
          const body = doc.querySelector("body");
          if (!body) return { error: "no body element" };

          function parseOutlines(parent) {
            const outlines = [];
            const elements = parent.querySelectorAll(":scope > outline");
            elements.forEach((el) => {
              outlines.push({
                text: el.getAttribute("text") || "",
                title: el.getAttribute("title") || "",
                type: el.getAttribute("type") || "",
                xmlUrl: el.getAttribute("xmlUrl") || "",
                htmlUrl: el.getAttribute("htmlUrl") || "",
                children: parseOutlines(el),
              });
            });
            return outlines;
          }

          const outlines = parseOutlines(body);
          return { outlines: outlines, count: outlines.length };
        } catch (e) {
          return { error: e.message };
        }
      }, opmlContent);

      if (parseResult.error) {
        ok(false, `解析导出 OPML 失败: ${parseResult.error}`);
      } else {
        ok(parseResult.count > 0, `成功解析导出 OPML: ${parseResult.count} 个顶层 outline`);
        parseResult.outlines.forEach((o, i) => {
          let type = o.type || "(none)";
          let url = o.xmlUrl || "";
          console.log(`  [${i}] "${o.text}" type=${type} xmlUrl=${url.slice(0, 50)}`);
        });

        // Verify each outline has a valid xmlUrl
        let allHaveUrls = parseResult.outlines.every(o => o.xmlUrl.startsWith("http"));
        ok(allHaveUrls, "所有 outline 都有有效的 xmlUrl");
      }

      console.log("\n截图: screenshots/exported-test.opml");
    }

  } catch (err) {
    console.log(`\n${F} 测试异常: ${err.message}`);
    await page.screenshot({ path: "screenshots/fail-opml-export.png" }).catch(() => {});
  }

  // =================================================================
  // Report
  // =================================================================
  console.log("\n" + "=".repeat(60));
  let total = passed + failed;
  console.log(`  结果: ${passed}/${total} 通过, ${failed} 失败`);
  console.log(failed === 0 ? `  ${P}${P}${P} 全部通过!` : `  ⚠️ ${failed} 项失败`);
  console.log("=".repeat(60));

  console.log("\n浏览器保持 5 秒...");
  await page.waitForTimeout(5000);
  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
}
main();
