import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "fs";

const SIYUAN_URL = process.env.SIYUAN_URL || "http://127.0.0.1:6806";
const TOKEN = process.env.SIYUAN_TOKEN || "";

async function main() {
  const browser = await chromium.launch({
    headless: false,
    args: ["--window-size=1280,720"],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();
  const errors = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push({
        time: new Date().toISOString(),
        type: msg.type(),
        text: msg.text(),
        location: msg.location()?.url || "",
      });
    }
  });

  page.on("pageerror", (err) => {
    errors.push({
      time: new Date().toISOString(),
      type: "pageerror",
      text: err.message,
      stack: err.stack,
    });
  });

  try {
    console.log("[Playwright] 正在打开思源笔记...");
    await page.goto(SIYUAN_URL, { waitUntil: "networkidle", timeout: 30000 });
    console.log("[Playwright] 页面加载完成");

    await page.waitForTimeout(3000);

    // 截取首页
    await page.screenshot({ path: "siyuan-screenshot.png" });
    console.log("[Playwright] 已保存截图: siyuan-screenshot.png");

    // 检查是否有 RSS 插件相关元素
    const hasRSS = await page.evaluate(() => {
      return !!document.querySelector('[data-type="dock"]');
    });
    console.log(`[Playwright] 检测到 Dock 栏: ${hasRSS}`);

    // 强制注入插件（通过 reloadPlugin API）
    console.log("[Playwright] 正在重载插件...");
    await page.evaluate(async () => {
      try {
        const res = await fetch("/api/system/reloadPlugin", {
          method: "POST",
          headers: { "Authorization": `Token ${localStorage.getItem("token")}` },
        });
        console.log("[Plugin Reload]", await res.text());
      } catch (e) {
        console.error("[Plugin Reload Error]", e);
      }
    });

    await page.waitForTimeout(2000);

    // 再次截图
    await page.screenshot({ path: "siyuan-after-reload.png" });
    console.log("[Playwright] 已保存截图: siyuan-after-reload.png");

    if (errors.length > 0) {
      console.log("\n===== 捕获到的错误 =====");
      errors.forEach((e, i) => {
        console.log(`\n[Error ${i + 1}]`);
        console.log(`  Time: ${e.time}`);
        console.log(`  Type: ${e.type}`);
        console.log(`  Text: ${e.text}`);
        if (e.stack) console.log(`  Stack: ${e.stack}`);
      });

      // 保存错误日志
      writeFileSync("siyuan-errors.json", JSON.stringify(errors, null, 2));
      console.log(`\n错误日志已保存到 siyuan-errors.json`);
    } else {
      console.log("\n✅ 未捕获到错误");
    }

    console.log("\n[Playwright] 测试完成! 浏览器保持打开中，手动关闭即可。");
    // 不关闭浏览器，让用户观察
  } catch (err) {
    console.error("[Playwright] 测试失败:", err.message);
    await page.screenshot({ path: "siyuan-error.png" });
    console.log("已保存错误截图: siyuan-error.png");
    await browser.close();
  }
}

main();
