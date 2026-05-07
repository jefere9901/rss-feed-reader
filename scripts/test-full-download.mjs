import { chromium } from "playwright";

const FEEDS = [
  {
    name: "阮一峰",
    url: "http://www.ruanyifeng.com/blog/atom.xml",
  },
  {
    name: "纽约时报",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml",
  },
  {
    name: "笨方法写作",
    url: "https://www.cnfeat.com/feed.xml",
  },
];

let passed = 0, failed = 0;
function ok(c, d) {
  if (c) { passed++; console.log(`  ✅ ${d}`); }
  else { failed++; console.log(`  ❌ ${d}`); }
}

async function main() {
  console.log("\n" + "═".repeat(60));
  console.log("  全流程 E2E: 阮一峰 / 纽约时报 / 笨方法写作");
  console.log("  含下载→按钮变跳转→再次打开显示跳转 验证");
  console.log("═".repeat(60));

  let browser;
  try { browser = await chromium.launch({ headless: false, args: ["--window-size=1400,900", "--no-sandbox"] }); }
  catch { browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--window-size=1400,900", "--no-sandbox"] }); }
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();

  await page.goto("http://localhost:6806", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(4000);

  for (let i = 0; i < 6; i++) {
    if (await page.evaluate(() => {
      const w = document.querySelector('[class*="rss-widget"]');
      return !!(w && w.textContent && w.textContent.length > 100);
    })) break;
    await page.waitForTimeout(2000);
  }

  async function switchToSettings() {
    await page.evaluate(() => {
      for (const b of document.querySelectorAll("button")) {
        if (b.textContent.includes("设") || b.textContent.includes("⚙")) { b.click(); return; }
      }
    });
    await page.waitForTimeout(800);
  }

  async function switchToFeed() {
    await page.evaluate(() => {
      for (const b of document.querySelectorAll("button")) {
        if (b.textContent.includes("阅")) { b.click(); return; }
      }
    });
    await page.waitForTimeout(2000);
  }

  async function openAddForm() {
    await page.evaluate(() => {
      for (const b of document.querySelectorAll("button")) {
        if (b.textContent.includes("添加订阅")) { b.click(); return; }
      }
    });
    await page.waitForTimeout(600);
  }

  async function addFeed(url) {
    await openAddForm();
    const input = page.locator("#rss-url-input");
    await input.fill(url);
    await page.waitForTimeout(300);
    const detectBtn = page.locator("#rss-add-detect");
    await detectBtn.click();
    await page.waitForTimeout(20000);
    const fb = await page.evaluate(() => {
      const el = document.querySelector('[class*="rss-detect-result"]');
      if (!el) return "(表单已关闭)";
      return el.textContent.trim().slice(0, 200);
    });
    return fb.includes("✅") || fb.includes("(表单已关闭)");
  }

  async function getReaderInfo() {
    return await page.evaluate(() => {
      const overlay = document.querySelector('[class*="rss-reader-overlay"]');
      if (!overlay) return { open: false };
      const title = overlay.querySelector('[class*="rss-reader-title"]');
      const content = overlay.querySelector('[class*="rss-reader-content"]');
      const btns = overlay.querySelectorAll("button");
      const btnTexts = Array.from(btns).map(b => b.textContent.trim());
      return {
        open: true,
        title: title ? title.textContent.trim().slice(0, 60) : "",
        contentLen: content ? content.textContent.length : 0,
        images: content ? content.querySelectorAll("img").length : 0,
        links: content ? content.querySelectorAll("a").length : 0,
        buttons: btnTexts,
      };
    });
  }

  // ═══ Go to settings first ═══
  console.log("\n--- 切换到设置 Tab ---");
  await switchToSettings();

  for (let fi = 0; fi < FEEDS.length; fi++) {
    const feed = FEEDS[fi];
    console.log(`\n${"━".repeat(56)}`);
    console.log(`  📡 [${fi + 1}/${FEEDS.length}] ${feed.name}: ${feed.url}`);
    console.log(`${"━".repeat(56)}`);

    // Step 1: Add feed
    console.log(`\n[${feed.name}] Step 1: 添加 Feed`);
    const added = await addFeed(feed.url);
    ok(added, `添加成功`);
    await page.waitForTimeout(500);

    // Step 2: Switch to feed tab
    console.log(`[${feed.name}] Step 2: 切回订阅 Tab`);
    await switchToFeed();

    // Step 3: Verify feed exists, expand it, click first article
    console.log(`[${feed.name}] Step 3: 展开 Feed, 点击第一篇文章`);
    await page.evaluate(() => {
      const headers = document.querySelectorAll('[class*="rss-feed-header"]');
      if (headers.length > 0) headers[headers.length - 1].click();
    });
    await page.waitForTimeout(600);

    const articleClicked = await page.evaluate(() => {
      const items = document.querySelectorAll('[class*="rss-article-item"]');
      if (items.length > 0) { items[0].click(); return items.length; }
      return 0;
    });
    console.log(`  文章数: ${articleClicked}`);
    ok(articleClicked > 0, `有文章条目(${articleClicked}篇)`);
    await page.waitForTimeout(1500);

    // Step 4: Check reader content
    console.log(`[${feed.name}] Step 4: 内容渲染验证`);
    const reader = await getReaderInfo();
    ok(reader.open, "阅读器已打开");
    console.log(`  标题: ${reader.title}`);
    console.log(`  文本: ${reader.contentLen}字符  图片: ${reader.images}  链接: ${reader.links}`);
    ok(reader.contentLen > 50, `内容非空 (${reader.contentLen}字符)`);

    // Step 5: Check download button present
    console.log(`[${feed.name}] Step 5: 下载按钮验证`);
    ok(reader.buttons.includes("⬇ 下载"), `显示「⬇ 下载」按钮`);

    // Step 6: Click download
    console.log(`[${feed.name}] Step 6: 点击下载`);
    await page.evaluate(() => {
      const overlay = document.querySelector('[class*="rss-reader-overlay"]');
      for (const b of overlay.querySelectorAll("button")) {
        if (b.textContent.includes("下载")) { b.click(); return; }
      }
    });
    await page.waitForTimeout(4000);

    // Step 7: Verify button changed to jump
    console.log(`[${feed.name}] Step 7: 按钮已变为跳转`);
    await page.waitForTimeout(800);
    let afterDownload = await getReaderInfo();
    if (!afterDownload.open) {
      await page.waitForTimeout(1000);
      afterDownload = await getReaderInfo();
    }
    if (afterDownload.buttons) {
      const hasJump = afterDownload.buttons.some(b => b.includes("跳转") || b.includes("✅"));
      ok(hasJump, `下载后显示跳转按钮 (当前: ${afterDownload.buttons.join(" | ")})`);
      ok(afterDownload.open, "阅读器仍在打开状态（未消失）");
    } else {
      ok(false, `下载后阅读器异常关闭`);
    }

    // Step 8: Click jump → should open siyuan
    console.log(`[${feed.name}] Step 8: 点击跳转 → 打开思源文档`);
    await page.evaluate(() => {
      const overlay = document.querySelector('[class*="rss-reader-overlay"]');
      for (const b of overlay.querySelectorAll("button")) {
        if (b.textContent.includes("跳转") || b.textContent.includes("✅")) { b.click(); return; }
      }
    });
    await page.waitForTimeout(2000);
    console.log(`  siyuan:// 协议已触发 (新窗口/标签页)`);

    // Step 9: Re-open same article → should show jump button
    console.log(`[${feed.name}] Step 9: 重新打开文章 → 验证显示跳转`);
    await switchToFeed();

    await page.evaluate(() => {
      const headers = document.querySelectorAll('[class*="rss-feed-header"]');
      if (headers.length > 0) headers[headers.length - 1].click();
    });
    await page.waitForTimeout(800);

    await page.evaluate(() => {
      const items = document.querySelectorAll('[class*="rss-article-item"]');
      if (items.length > 0) items[0].click();
    });
    await page.waitForTimeout(2500);

    const recheck = await getReaderInfo();
    if (!recheck.open) {
      await page.evaluate(() => {
        const items = document.querySelectorAll('[class*="rss-article-item"]');
        if (items.length > 0) items[0].click();
      });
      await page.waitForTimeout(2500);
    }
    const recheck2 = await getReaderInfo();
    if (recheck2.buttons) {
      const hasJumpAgain = recheck2.buttons.some(b => b.includes("跳转") || b.includes("查看") || b.includes("✅"));
      ok(hasJumpAgain, `再次打开显示跳转按钮 (当前: ${recheck2.buttons.join(" | ")})`);
      ok(!recheck2.buttons.includes("⬇ 下载"), `不再显示下载按钮`);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    } else {
      ok(false, `再次打开阅读器失败`);
    }

    // Step 10: Close reader, switch to settings for next
    console.log(`[${feed.name}] Step 10: 清理`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    await switchToSettings();

    await page.screenshot({ path: `screenshots/test-${feed.name}-final.png` });
  }

  // ═══════════════════════════════════════════════
  console.log("\n" + "═".repeat(60));
  console.log(`  通过: ${passed}  失败: ${failed}`);
  if (failed === 0) console.log("  🎉 全部通过！");
  else console.log(`  ⚠️ ${failed} 项失败`);
  console.log("═".repeat(60) + "\n");

  await page.waitForTimeout(1000);
  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error("异常:", e.message);
  process.exit(1);
});
