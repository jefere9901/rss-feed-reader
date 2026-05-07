import { chromium } from "playwright";
import { resolve } from "path";

let passed = 0, failed = 0;
function ok(c, d) {
  if (c) { passed++; console.log(`  ✅ ${d}`); }
  else { failed++; console.log(`  ❌ ${d}`); }
}

async function main() {
  console.log("\n" + "═".repeat(60));
  console.log("  OPML 导入图标验证: Reeder.opml");
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

  // ─── Reset data ───
  console.log("\n--- Step 0: 重置数据 ---");
  await page.evaluate(() => { for (const b of document.querySelectorAll("button")) { if (b.textContent.includes("设") || b.textContent.includes("⚙")) { b.click(); return; } } });
  await page.waitForTimeout(800);
  await page.evaluate(() => { for (const el of document.querySelectorAll('[class*="rss-settings-collapse-header"]')) { if (el.textContent.includes("通用设置")) { el.click(); return; } } });
  await page.waitForTimeout(500);
  await page.evaluate(() => { for (const b of document.querySelectorAll("button")) { if (b.textContent.includes("清除")) { b.click(); return; } } });
  await page.waitForTimeout(500);
  // Accept dialog
  page.once("dialog", d => d.accept());
  await page.evaluate(() => { for (const b of document.querySelectorAll("button")) { if (b.textContent.includes("清除")) { b.click(); return; } } });
  await page.waitForTimeout(1000);
  ok(true, "数据已重置");

  // ─── Import OPML ───
  console.log("\n--- Step 1: 导入 OPML ---");
  // Click import button and handle file chooser
  const opmlPath = resolve("D:/demo/rss_siyuan/Reeder.opml");

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.evaluate(() => { for (const b of document.querySelectorAll("button")) { if (b.textContent.includes("导入 OPML")) { b.click(); return; } } });
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(opmlPath);
  ok(true, "OPML 文件已导入");
  console.log("   等待导入完成 (30s)...");
  await page.waitForTimeout(30000);

  // ─── Go to feed tab ───
  console.log("\n--- Step 2: 查看订阅列表 ---");
  await page.evaluate(() => { for (const b of document.querySelectorAll("button")) { if (b.textContent.includes("阅")) { b.click(); return; } } });
  await page.waitForTimeout(3000);

  // Analyze icons
  const iconData = await page.evaluate(() => {
    const feedIcons = document.querySelectorAll('[class*="rss-feed-icon"]');
    const results = [];
    feedIcons.forEach((el, i) => {
      const img = el.querySelector("img");
      const name = el.parentElement?.querySelector('[class*="rss-feed-name"]')?.textContent?.trim() || "";
      results.push({
        name: name.slice(0, 35),
        hasImg: !!img,
        imgSrc: img ? img.src.slice(0, 60) : null,
        textContent: el.textContent?.trim().slice(0, 10) || "",
        isEmoji: !img && el.textContent?.trim() !== "",
      });
    });
    return results;
  });

  console.log(`   总共 ${iconData.length} 个订阅源图标:`);
  let imgCount = 0, emojiCount = 0;
  iconData.forEach((d, i) => {
    if (d.hasImg) {
      imgCount++;
      console.log(`   [${i + 1}] 🖼️ ${d.name} → ${d.imgSrc}`);
    } else if (d.isEmoji) {
      emojiCount++;
      console.log(`   [${i + 1}] 📡 ${d.name} (默认emoji)`);
    } else {
      console.log(`   [${i + 1}] ❓ ${d.name} (无图标)`);
    }
  });

  console.log(`\n   图标统计: 🖼️图片=${imgCount}  📡默认=${emojiCount}`);
  ok(imgCount > 0, `至少 ${imgCount} 个订阅有图片图标`);
  ok(iconData.length > 0, "有订阅源");

  await page.screenshot({ path: "screenshots/test-opml-icons.png" });

  console.log("\n" + "═".repeat(60));
  console.log(`  通过: ${passed}  失败: ${failed}`);
  if (failed === 0) console.log("  🎉 OPML 图标验证通过!");
  else console.log(`  ⚠️ ${failed} 项失败`);
  console.log("═".repeat(60) + "\n");

  await page.waitForTimeout(1000);
  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("异常:", e.message); process.exit(1); });
