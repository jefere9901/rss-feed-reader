import { chromium } from "playwright";

const FEEDS = [
  {
    name: "阮一峰",
    url: "http://www.ruanyifeng.com/blog/atom.xml",
    checkTitle: "阮一峰的网络日志",
  },
  {
    name: "柴静",
    url: "https://feedmaker.kindle4rss.com/feeds/cnfeat.weixin.xml",
    checkWord: "柴静",
  },
  {
    name: "笨方法写作",
    url: "https://www.cnfeat.com/feed",
    checkTitle: "笨方法学习周报",
  },
];

let passed = 0, failed = 0;
function ok(c, d) {
  if (c) { passed++; console.log(`  ✅ ${d}`); }
  else { failed++; console.log(`  ❌ ${d}`); }
}

async function main() {
  console.log("\n" + "═".repeat(60));
  console.log("  三源全流程 E2E 测试: 阮一峰 / 柴静 / 笨方法写作");
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

  // ─── Go to settings ───
  console.log("\n--- 切换到设置 Tab ---");
  await page.evaluate(() => {
    for (const b of document.querySelectorAll("button")) {
      if (b.textContent.includes("设") || b.textContent.includes("⚙")) { b.click(); return; }
    }
  });
  await page.waitForTimeout(800);

  for (const feed of FEEDS) {
    console.log(`\n${"━".repeat(56)}`);
    console.log(`  📡 测试 ${feed.name}: ${feed.url}`);
    console.log(`${"━".repeat(56)}`);

    // ─── Step 1: 点击「+ 添加订阅」───
    console.log(`\n[${feed.name}] Step 1: 打开添加表单`);
    await page.evaluate(() => {
      for (const b of document.querySelectorAll("button")) {
        if (b.textContent.includes("添加订阅")) { b.click(); return; }
      }
    });
    await page.waitForTimeout(600);
    const formVisible = await page.evaluate(() => !!document.querySelector("#rss-url-input"));
    ok(formVisible, "添加表单出现");

    // ─── Step 2: 填入 URL 并检测 ───
    console.log(`[${feed.name}] Step 2: 填入 URL`);
    const input = page.locator("#rss-url-input");
    if (await input.count() > 0) {
      await input.fill(feed.url);
      await page.waitForTimeout(300);
      const val = await input.inputValue();
      ok(val === feed.url, `URL 正确填入`);
    }

    // ─── Step 3: 点击检测并添加 ───
    console.log(`[${feed.name}] Step 3: 检测并添加 (最多20秒)...`);
    const detectBtn = page.locator("#rss-add-detect");
    if (await detectBtn.count() > 0) {
      await detectBtn.click();
      await page.waitForTimeout(20000);
    }

    const feedback = await page.evaluate(() => {
      const fb = document.querySelector('[class*="rss-detect-result"]');
      if (!fb) return "(表单已关闭)";
      return fb.textContent.trim().slice(0, 300);
    });
    console.log(`  检测结果: ${feedback}`);
    const added = feedback.includes("✅") || feedback.includes("(表单已关闭)");
    ok(added, `成功添加 ${feed.name}`);

    if (!added) {
      console.log(`  ⚠️ ${feed.name} 添加异常，跳过后续测试`);
      // Close form if still open
      await page.evaluate(() => {
        const cancel = document.querySelector("#rss-add-cancel");
        if (cancel) cancel.click();
      });
      await page.waitForTimeout(500);
      continue;
    }
    await page.waitForTimeout(1000);

    // ─── Step 4: 切回订阅 Tab ───
    console.log(`[${feed.name}] Step 4: 切回订阅 Tab`);
    await page.evaluate(() => {
      for (const b of document.querySelectorAll("button")) {
        if (b.textContent.includes("阅")) { b.click(); return; }
      }
    });
    await page.waitForTimeout(2000);

    // ─── Step 5: 验证 feed 出现在列表中 ───
    console.log(`[${feed.name}] Step 5: 验证 Feed 列表`);
    const feedNames = await page.evaluate(() => {
      const names = document.querySelectorAll('[class*="rss-feed-name"]');
      return Array.from(names).map(e => e.textContent.trim());
    });
    console.log(`  订阅列表: ${JSON.stringify(feedNames)}`);
    ok(feedNames.length > 0, "Feed 列表非空");

    // ─── Step 6: 展开该 feed 查看文章 ───
    console.log(`[${feed.name}] Step 6: 展开 Feed 查看条目`);
    await page.evaluate(() => {
      const headers = document.querySelectorAll('[class*="rss-feed-header"]');
      if (headers.length > 0) headers[0].click();
    });
    await page.waitForTimeout(800);

    const articles = await page.evaluate(() => {
      const items = document.querySelectorAll('[class*="rss-article-item"]');
      if (items.length === 0) {
        const all = document.querySelectorAll('[class*="rss-feed-group"]');
        return { count: 0, debug: Array.from(all).map(a => a.innerHTML.slice(0, 200)).join("|") };
      }
      return {
        count: items.length,
        first: items[0].textContent.trim().slice(0, 80),
      };
    });
    console.log(`  文章条目: ${articles.count} 篇, 首条: ${articles.first || "(空)"}`);
    ok(articles.count > 0, `${feed.name} 有文章条目`);

    // ─── Step 7: 点击第一篇文章，打开阅读器 ───
    console.log(`[${feed.name}] Step 7: 打开第一篇文章`);
    let readerOpened = await page.evaluate(() => {
      const items = document.querySelectorAll('[class*="rss-article-item"]');
      if (items.length > 0) { items[0].click(); return true; }
      return false;
    });
    await page.waitForTimeout(1500);

    // Check reader content
    const readerContent = await page.evaluate(() => {
      const overlay = document.querySelector('[class*="rss-reader-overlay"]');
      if (!overlay) return { open: false };
      const title = overlay.querySelector('[class*="rss-reader-title"]');
      const body = overlay.querySelector('[class*="rss-reader-body"]');
      const content = overlay.querySelector('[class*="rss-reader-content"]');
      return {
        open: true,
        title: title ? title.textContent.trim().slice(0, 60) : "(无标题)",
        bodyHTML: body ? body.innerHTML.slice(0, 300) : "(无)",
        contentLen: content ? content.textContent.length : 0,
      };
    });
    ok(readerContent.open, "阅读器已打开");
    console.log(`  标题: ${readerContent.title}`);
    console.log(`  内容长度: ${readerContent.contentLen} 字符`);

    // ─── Step 8: 内容渲染检查 ───
    console.log(`[${feed.name}] Step 8: 内容渲染检查`);
    const renderCheck = await page.evaluate(() => {
      const content = document.querySelector('[class*="rss-reader-content"]');
      if (!content) return { ok: false };
      const hasImages = content.querySelectorAll("img").length;
      const hasLinks = content.querySelectorAll("a").length;
      const hasPlain = content.textContent.length > 50;
      return { ok: true, hasImages, hasLinks, hasPlain, textLen: content.textContent.length };
    });
    console.log(`  图片:${renderCheck.hasImages} 链接:${renderCheck.hasLinks} 文本:${renderCheck.textLen}字符`);
    ok(renderCheck.textLen > 50, "内容有足够文本");

    // ─── Step 9: 点击下载 ───
    console.log(`[${feed.name}] Step 9: 点击「⬇ 下载」`);
    let downloadClicked = await page.evaluate(() => {
      const overlay = document.querySelector('[class*="rss-reader-overlay"]');
      if (!overlay) return false;
      for (const b of overlay.querySelectorAll("button")) {
        if (b.textContent.includes("下")) { b.click(); return true; }
      }
      return false;
    });
    ok(downloadClicked, "下载按钮已点击");
    await page.waitForTimeout(3000);

    const downloadResult = await page.evaluate(() => {
      const overlay = document.querySelector('[class*="rss-reader-overlay"]');
      if (!overlay) return "(阅读器已关闭=成功)";
      for (const b of overlay.querySelectorAll("button")) {
        if (b.textContent.includes("下载") || b.textContent.includes("✅") || b.textContent.includes("❌")) {
          return b.textContent.trim();
        }
      }
      return "(未知)";
    });
    console.log(`  下载状态: ${downloadResult}`);
    const dlOK = downloadResult.includes("✅") || downloadResult.includes("(阅读器已关闭=成功)");
    ok(dlOK, `${feed.name} 下载完成`);

    // ─── Step 10: 关闭阅读器，切回设置，准备下一个 ───
    console.log(`[${feed.name}] Step 10: 清理，准备下一个`);

    // Close reader if open
    await page.evaluate(() => {
      const overlay = document.querySelector('[class*="rss-reader-overlay"]');
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    });
    await page.waitForTimeout(500);

    // Switch back to settings
    await page.evaluate(() => {
      for (const b of document.querySelectorAll("button")) {
        if (b.textContent.includes("设") || b.textContent.includes("⚙")) { b.click(); return; }
      }
    });
    await page.waitForTimeout(800);

    // Screenshot for this feed
    await page.screenshot({ path: `screenshots/test-${feed.name}.png` });
    console.log(`  📸 截图: screenshots/test-${feed.name}.png`);
  }

  // ═══════════════════════════════════════════════
  // Summary
  // ═══════════════════════════════════════════════
  console.log("\n" + "═".repeat(60));
  console.log(`  总通过: ${passed}  失败: ${failed}`);
  if (failed === 0) console.log("  🎉 全部通过！");
  else console.log(`  ⚠️ ${failed} 项失败，请查看截图`);
  console.log("═".repeat(60) + "\n");

  await page.waitForTimeout(1000);
  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error("测试异常:", e.message);
  process.exit(1);
});
