import { chromium } from "playwright";
import { writeFileSync } from "fs";

const SIYUAN_URL = "http://127.0.0.1:6806";
const YOUTUBE_RSS = "https://www.youtube.com/feeds/videos.xml?channel_id=UCjuNibFJ21MiSNpu8LZyV4w";

const PASS = "✅";
const FAIL = "❌";

class TestRunner {
  constructor(page) {
    this.page = page;
    this.passed = 0;
    this.failed = 0;
    this.results = [];
    this.screenshots = [];
  }

  async assert(condition, desc) {
    if (condition) {
      this.passed++;
      this.results.push(`${PASS} ${desc}`);
      console.log(`  ${PASS} ${desc}`);
    } else {
      this.failed++;
      this.results.push(`${FAIL} ${desc}`);
      console.log(`  ${FAIL} ${desc}`);
      try {
        const ss = `screenshots/fail-${Date.now()}-${this.failed}.png`;
        await this.page.screenshot({ path: ss });
        this.screenshots.push(ss);
      } catch {}
    }
    return condition;
  }

  summary() {
    console.log("\n" + "=".repeat(55));
    const total = this.passed + this.failed;
    console.log(`  测试结果: ${this.passed}/${total} 通过, ${this.failed} 失败`);
    if (this.failed === 0) {
      console.log(`  ${PASS}${PASS}${PASS} 全部通过!`);
    } else {
      console.log(`  失败截图: ${this.screenshots.join(", ") || "无"}`);
    }
    console.log("=".repeat(55) + "\n");
    return this.failed === 0;
  }
}

async function main() {
  console.log("\n" + "=".repeat(55));
  console.log("  Playwright 端到端测试: YouTube RSS media:description");
  console.log("=".repeat(55) + "\n");

  let browser;
  try {
    browser = await chromium.launch({
      headless: false,
      args: ["--window-size=1400,900"],
    });
  } catch {
    console.log("内置 Chromium 不可用，尝试使用系统 Chrome...");
    browser = await chromium.launch({
      channel: "chrome",
      headless: false,
      args: ["--window-size=1400,900"],
    });
  }

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();
  const t = new TestRunner(page);

  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") pageErrors.push(msg.text());
  });

  try {
    // ====== Step 1: 打开思源 ======
    console.log("--- Step 1: 打开思源笔记 ---");
    await page.goto(SIYUAN_URL, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3000);
    await t.assert(
      (await page.title()).length > 0,
      "思源页面加载成功"
    );

    // ====== Step 2: 打开 RSS 插件 dock ======
    console.log("\n--- Step 2: 打开 RSS 插件 Dock ---");
    const dockBtn = page.locator('[data-type="dock"] .dock__item').filter({ hasText: "RSS Feed" });
    const dockBtnCount = await dockBtn.count();

    if (dockBtnCount === 0) {
      console.log("  尝试通过 toolbar__item 找 RSS dock...");
      const altDock = page.locator('.toolbar__item').filter({ hasText: "RSS" });
      const altCount = await altDock.count();
      console.log(`  找到 ${altCount} 个 toolbar__item 包含 RSS`);
      if (altCount > 0) {
        await altDock.first().click();
        await page.waitForTimeout(1500);
      } else {
        console.log("  尝试查找所有 dock 元素...");
        const allDocks = await page.locator('[class*="dock"]').count();
        console.log(`  页面上有 ${allDocks} 个 class 含 dock 的元素`);
      }
    } else {
      await dockBtn.first().click();
      await page.waitForTimeout(1500);
    }

    // ====== Step 3: 查找 RSS 面板，切换到设置 Tab ======
    console.log("\n--- Step 3: 切换到设置 Tab ---");
    const rssWidget = page.locator(".rss-widget");
    const widgetCount = await rssWidget.count();
    
    if (widgetCount === 0) {
      console.log("  .rss-widget 未找到，尝试点击左侧 dock 图标...");
      const leftDockItems = page.locator('.dock--left .dock__item, [class*="dock"][class*="left"] [class*="item"], .fn__flex-column > div > span');
      const ldc = await leftDockItems.count();
      console.log(`  左侧 dock 项: ${ldc}`);
      for (let i = 0; i < Math.min(ldc, 10); i++) {
        const text = await leftDockItems.nth(i).textContent();
        console.log(`    [${i}] "${text?.trim()}"`);
      }

      const rssIcon = page.locator('svg use[*|href*="iconRSS"], [class*="iconRSS"], [title="RSS Feed"]');
      const ric = await rssIcon.count();
      console.log(`  含 iconRSS/RSS Feed 的元素: ${ric}`);
      if (ric > 0) {
        await rssIcon.first().click();
        await page.waitForTimeout(2000);
      }
    } else {
      await t.assert(true, "RSS 面板 .rss-widget 已找到");
    }

    // 点击设置 Tab
    const settingsTab = page.locator('.rss-tab[data-tab="settings"], .rss-tab:has-text("设置")');
    if ((await settingsTab.count()) > 0) {
      await settingsTab.first().click();
      await page.waitForTimeout(1000);
      await t.assert(true, "已切换到设置 Tab");
    } else {
      await t.assert(false, "未找到设置 Tab");
    }

    // ====== Step 4: 点击 "＋ 添加订阅" ======
    console.log("\n--- Step 4: 添加 YouTube RSS 订阅 ---");
    const addBtn = page.locator('.rss-add-btn:has-text("添加订阅")');
    if ((await addBtn.count()) > 0) {
      await addBtn.first().click();
      await page.waitForTimeout(800);
      await t.assert(true, "已点击 '添加订阅' 按钮");
    } else {
      await t.assert(false, "未找到 '添加订阅' 按钮");
    }

    // 填入 YouTube RSS URL
    const urlInput = page.locator("#rss-url-input");
    if ((await urlInput.count()) > 0) {
      await urlInput.fill(YOUTUBE_RSS);
      await page.waitForTimeout(300);
      const filledVal = await urlInput.inputValue();
      await t.assert(
        filledVal === YOUTUBE_RSS,
        `URL 输入正确: ${filledVal.slice(0, 50)}...`
      );
    } else {
      await t.assert(false, "未找到 URL 输入框 #rss-url-input");
    }

    // ====== Step 5: 点击 "检测并添加" ======
    console.log("\n--- Step 5: 检测并添加 YouTube 频道 ---");
    const detectBtn = page.locator("#rss-add-detect");
    if ((await detectBtn.count()) > 0) {
      await detectBtn.click();
      await t.assert(true, "已点击 '检测并添加'");

      // 等待网络请求完成（fetchFeed + forwardProxy）
      await page.waitForTimeout(8000);

      // 检查反馈消息
      const feedback = page.locator(".rss-detect-result");
      const fbText = (await feedback.count()) > 0
        ? (await feedback.first().textContent())?.trim() ?? ""
        : "";
      console.log(`  反馈: ${fbText.slice(0, 80)}`);
    } else {
      await t.assert(false, "未找到 '检测并添加' 按钮");
    }

    // ====== Step 6: 切换到订阅 Tab 查看结果 ======
    console.log("\n--- Step 6: 验证订阅列表和文章 ---");
    const feedTab = page.locator('.rss-tab[data-tab="feed"], .rss-tab:has-text("订阅")');
    if ((await feedTab.count()) > 0) {
      await feedTab.first().click();
      await page.waitForTimeout(1500);
      await t.assert(true, "已切换到订阅 Tab");
    }

    // 检查 feed 组
    const feedGroups = page.locator(".rss-feed-group");
    const fgCount = await feedGroups.count();
    await t.assert(fgCount > 0, `找到 ${fgCount} 个订阅源`);

    if (fgCount > 0) {
      // 点击展开第一个 feed
      await feedGroups.first().locator(".rss-feed-header").click();
      await page.waitForTimeout(800);

      // 检查文章列表
      const articles = feedGroups.first().locator(".rss-article-item");
      const artCount = await articles.count();
      console.log(`  文章数量: ${artCount}`);
      await t.assert(artCount > 0, `找到 ${artCount} 篇文章`);

      if (artCount > 0) {
        // 点击第一篇文章
        await articles.first().click();
        await page.waitForTimeout(1500);

        // ====== Step 7: 验证阅读器内容 ======
        console.log("\n--- Step 7: 验证阅读器中 content 非空 ---");
        const readerOverlay = page.locator(".rss-reader-overlay.visible, .rss-reader-overlay");
        const roCount = await readerOverlay.count();
        await t.assert(roCount > 0, "阅读器面板已打开");

        if (roCount > 0) {
          // 检查内容区域
          const contentArea = page.locator("#rss-reader-content");
          const caCount = await contentArea.count();
          if (caCount > 0) {
            const contentHtml = await contentArea.first().innerHTML();
            const contentText = (await contentArea.first().textContent())?.trim() ?? "";

            console.log(`  内容 HTML 长度: ${contentHtml.length}`);
            console.log(`  内容文本长度: ${contentText.length}`);
            console.log(`  内容预览: ${contentText.slice(0, 100)}...`);

            await t.assert(
              contentText.length > 20,
              `阅读器内容非空 (${contentText.length} chars) - 预览: "${contentText.slice(0, 50)}..."`
            );

            // 验证不是显示"无内容"
            await t.assert(
              !contentText.includes("（无内容）"),
              "内容不是 '（无内容）' 占位符"
            );

            // 验证内容包含预期关键词（视频描述通常包含时间戳等）
            await t.assert(
              contentHtml.includes("<p") || contentText.length > 50,
              "内容包含富文本或足够长"
            );
          } else {
            await t.assert(false, "未找到 #rss-reader-content");
          }

          // 按 Escape 关闭阅读器
          await page.keyboard.press("Escape");
          await page.waitForTimeout(500);
        }
      }
    }

    // ====== Step 8: 完整性检查 ======
    console.log("\n--- Step 8: 原有功能不受影响检查 ---");
    // 切换到设置 Tab 验证设置页面正常
    const settingsTab2 = page.locator('.rss-tab[data-tab="settings"], .rss-tab:has-text("设置")');
    if ((await settingsTab2.count()) > 0) {
      await settingsTab2.first().click();
      await page.waitForTimeout(800);
    }
    const settingsContent = page.locator(".rss-settings-section");
    const scCount = await settingsContent.count();
    await t.assert(scCount > 0, "设置页面渲染正常");

    // ====== 截图存档 ======
    await page.screenshot({ path: "screenshots/youtube-test-final.png" });
    console.log("\n  已保存截图: screenshots/youtube-test-final.png");

  } catch (err) {
    console.error(`\n❌ 测试异常: ${err.message}`);
    console.error(err.stack);
    await page.screenshot({ path: "screenshots/youtube-test-error.png" });
  }

  // ====== 结果汇总 ======
  if (pageErrors.length > 0) {
    console.log("\n⚠️ 页面 JS 错误:");
    pageErrors.slice(0, 5).forEach((e, i) => console.log(`  [${i + 1}] ${e}`));
  }

  const allPassed = t.summary();

  console.log("浏览器保持打开，可手动检查后关闭。");
  // 不自动关闭浏览器，方便观察

  // 保存测试报告
  const report = {
    time: new Date().toISOString(),
    passed: t.passed,
    failed: t.failed,
    results: t.results,
    pageErrors,
    screenshots: t.screenshots,
  };
  writeFileSync("screenshots/youtube-test-report.json", JSON.stringify(report, null, 2));
  console.log("测试报告已保存: screenshots/youtube-test-report.json\n");

  // 60 秒后自动关闭（给用户观察时间）
  // 如需立即关闭可取消注释下面两行:
  // await browser.close();
  // process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error("启动失败:", err);
  process.exit(1);
});
