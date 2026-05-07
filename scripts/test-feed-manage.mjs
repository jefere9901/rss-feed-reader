import { chromium } from "playwright";

let passed = 0, failed = 0;
function ok(c, d) {
  if (c) { passed++; console.log(`  ✅ ${d}`); }
  else { failed++; console.log(`  ❌ ${d}`); }
}

async function main() {
  console.log("\n" + "═".repeat(60));
  console.log("  内联编辑: 单击出输入框改名 / 双击出输入框改URL");
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

  const getFeeds = () => page.evaluate(() => {
    return Array.from(document.querySelectorAll('[class*="rss-feed-manage-item"]')).map(r => {
      const name = r.querySelector('[class*="rss-feed-manage-name"]');
      const input = r.querySelector('input');
      const url = r.querySelector('[class*="rss-feed-manage-url"]');
      const status = r.querySelector('[class*="rss-feed-manage-status"]');
      return {
        name: name ? name.textContent.trim() : "",
        url: url && !input ? url.textContent.trim() : "",
        hasInput: !!input,
        inputValue: input ? input.value : "",
        statusText: status ? status.textContent.trim() : "",
      };
    });
  });

  // ─── Go to settings ───
  console.log("\n--- 进入设置 ---");
  await page.evaluate(() => { for (const b of document.querySelectorAll("button")) { if (b.textContent.includes("设") || b.textContent.includes("⚙")) { b.click(); return; } } });
  await page.waitForTimeout(1000);

  // Ensure we have feeds
  if ((await getFeeds()).length < 2) {
    console.log("\n--- 添加2个Feed ---");
    for (const url of ["http://www.ruanyifeng.com/blog/atom.xml", "https://www.cnfeat.com/feed.xml"]) {
      await page.evaluate(() => { for (const b of document.querySelectorAll("button")) { if (b.textContent.includes("添加订阅")) { b.click(); return; } } });
      await page.waitForTimeout(600);
      await page.locator("#rss-url-input").fill(url);
      await page.locator("#rss-add-detect").click();
      await page.waitForTimeout(20000);
    }
  }

  const before = await getFeeds();
  console.log(`\n   当前 (${before.length}个):`);
  before.forEach((f, i) => console.log(`   [${i + 1}] ${f.name} | ${f.url.slice(0, 50)} | ${f.statusText}`));

  // ═══ TEST A: 单击名称 → 输入框出现 → 输入新名 → Enter 保存 ═══
  console.log("\n" + "─".repeat(55));
  console.log("  Test A: 单击名称 → 输入框 → 改名");
  console.log("─".repeat(55));

  const NEW_NAME = "内联改名测试_" + Math.random().toString(36).slice(2, 6);
  console.log(`   新名: ${NEW_NAME}`);

  await page.evaluate(() => {
    const name = document.querySelector('[class*="rss-feed-manage-name"]');
    if (name) name.click();
  });
  await page.waitForTimeout(500);

  // Input should now be visible
  let inputState = await getFeeds();
  ok(inputState.some(f => f.hasInput), "单击后出现输入框");

  // Type new name
  const nameInput = page.locator("input.rss-feed-manage-input").first();
  await nameInput.fill(NEW_NAME);
  await page.waitForTimeout(200);
  await nameInput.press("Enter");
  await page.waitForTimeout(800);

  const afterRename = await getFeeds();
  const found = afterRename.find(f => f.name === NEW_NAME);
  ok(!!found, `改名成功: "${NEW_NAME}"`);

  // ═══ TEST B: 双击URL → 输入框 → 改无效URL → Enter ═══
  console.log("\n" + "─".repeat(55));
  console.log("  Test B: 双击URL → 输入框 → 改为无效");
  console.log("─".repeat(55));

  const BAD = "https://invalid-" + Date.now() + ".com/rss.xml";
  console.log(`   改为: ${BAD}`);

  await page.evaluate(() => {
    const url = document.querySelector('[class*="rss-feed-manage-url"]');
    if (url) url.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  });
  await page.waitForTimeout(500);

  const urlInput = page.locator("input.rss-feed-manage-input").first();
  await urlInput.fill(BAD);
  await page.waitForTimeout(200);
  await urlInput.press("Enter");
  await page.waitForTimeout(800);

  const afterUrl = await getFeeds();
  console.log(`   列表URL:`);
  afterUrl.forEach(f => console.log(`     ${f.name.slice(0, 20)} → ${f.url.slice(0, 60)}`));
  const badInList = afterUrl.some(f => f.url === BAD);
  ok(badInList, "URL已改为无效链接");

  // ═══ TEST C: Escape 取消编辑 ═══
  console.log("\n" + "─".repeat(55));
  console.log("  Test C: 单击 → 输入 → Escape 取消");
  console.log("─".repeat(55));

  await page.evaluate(() => {
    const name = document.querySelector('[class*="rss-feed-manage-name"]');
    if (name) name.click();
  });
  await page.waitForTimeout(500);

  const escInput = page.locator("input.rss-feed-manage-input").first();
  const beforeCancel = await escInput.inputValue();
  await escInput.fill("CANCEL_THIS");
  await escInput.press("Escape");
  await page.waitForTimeout(800);

  const afterCancel = await getFeeds();
  const stillHasOld = afterCancel.some(f => f.name === "RSS改名测试_qnta" || f.name.includes("阮一峰") || f.name.includes("笨方法"));
  ok(stillHasOld && !afterCancel.some(f => f.name === "CANCEL_THIS"), "Escape 取消编辑 (名称未变更)");

  await page.screenshot({ path: "screenshots/test-inline-edit.png" });
  console.log("\n  📸 截图已保存");

  console.log("\n" + "═".repeat(60));
  console.log(`  通过: ${passed}  失败: ${failed}`);
  if (failed === 0) console.log("  🎉 全部通过!");
  else console.log(`  ⚠️ ${failed} 项失败`);
  console.log("═".repeat(60) + "\n");

  await page.waitForTimeout(500);
  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("异常:", e.message); process.exit(1); });
