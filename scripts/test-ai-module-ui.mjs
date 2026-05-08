import { chromium } from "playwright";

let passed = 0, failed = 0;
function ok(c, d) { if (c) { passed++; console.log(`  ✅ ${d}`); } else { failed++; console.log(`  ❌ ${d}`); } }

async function main() {
  console.log("\n══════════════════════════════");
  console.log("  AI 模块化面板测试");
  console.log("══════════════════════════════");

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
      return !!(w && w.textContent && w.textContent.length > 50);
    })) break;
    await page.waitForTimeout(2000);
  }

  // Switch to settings
  await page.evaluate(() => { for (const b of document.querySelectorAll("button")) { if (b.textContent.includes("设") || b.textContent.includes("⚙")) { b.click(); return; } } });
  await page.waitForTimeout(1000);

  // Click AI section title to expand
  const clicked = await page.evaluate(() => {
    const titles = document.querySelectorAll('[class$="-collapse-header"]');
    for (const t of titles) {
      if (t.textContent && t.textContent.includes("AI")) { t.click(); return true; }
    }
    return false;
  });
  await page.waitForTimeout(500);

  const aiModules = await page.evaluate(() => {
    const modules = document.querySelectorAll('.rss-ai-module');
    if (!modules.length) {
      // Check if section collapsed
      const bodies = document.querySelectorAll('[class$="-collapse-body"]');
      for (const b of bodies) {
        if (b.classList.contains('collapsed')) return 'section_collapsed';
      }
      return 'no_modules';
    }

    const result = [];
    modules.forEach((m, i) => {
      const header = m.querySelector('.rss-ai-module-header');
      const toggle = m.querySelector('.rss-toggle');
      const content = m.querySelector('.rss-ai-module-content');
      const pills = content ? content.querySelectorAll('.rss-pill') : [];
      const inputs = content ? content.querySelectorAll('input, select, textarea') : [];

      let labelText = '';
      if (header) {
        const arrow = header.querySelector('.rss-ai-module-arrow');
        if (arrow) arrow.remove();
        if (toggle) toggle.remove();
        labelText = header.textContent?.trim() || '';
      }

      result.push({
        label: labelText.slice(0, 25),
        hasToggle: !!toggle,
        toggleActive: toggle?.classList.contains('active') || false,
        collapsed: content?.classList.contains('collapsed') || false,
        pillCount: pills.length,
        inputCount: inputs.length,
      });
    });
    return result;
  });

  console.log(`   类型: ${typeof aiModules}`);
  if (typeof aiModules === 'string') {
    console.log(`   ${aiModules}`);
    await page.screenshot({ path: "screenshots/test-ai-module.png" });
    ok(false, "AI 模块未渲染");
  } else {
    ok(aiModules.length === 6, `共 ${aiModules.length} 个模块`);
    aiModules.forEach(m => console.log(`   [${m.label}] toggle:${m.hasToggle ? "✅" : "❌"} collapsed:${m.collapsed} pills:${m.pillCount} inputs:${m.inputCount}`));

    ok(aiModules.every(m => m.hasToggle), "每个模块有开关");
    ok(aiModules.some(m => m.label.includes("摘要") && m.toggleActive), "摘要默认开启");

    // Expand summary module
    const summaryBefore = aiModules.find(m => m.label.includes("摘要"));
    if (summaryBefore && summaryBefore.collapsed) {
      await page.evaluate(() => {
        const headers = document.querySelectorAll('.rss-ai-module-header');
        for (const h of headers) {
          if (h.textContent && h.textContent.includes("摘要")) { h.click(); return; }
        }
      });
      await page.waitForTimeout(500);

      const summaryAfter = await page.evaluate(() => {
        const mods = document.querySelectorAll('.rss-ai-module');
        for (const m of mods) {
          const h = m.querySelector('.rss-ai-module-header');
          if (h && h.textContent && h.textContent.includes("摘要")) {
            const body = m.querySelector('.rss-ai-module-content');
            return {
              collapsed: body?.classList.contains('collapsed') || false,
              pillTexts: body ? Array.from(body.querySelectorAll('.rss-pill')).map(p => p.textContent.trim()) : [],
              inputCount: body ? body.querySelectorAll('input, select, textarea').length : 0,
            };
          }
        }
        return null;
      });

      if (summaryAfter) {
        ok(!summaryAfter.collapsed, "摘要模块已展开");
        ok(summaryAfter.pillTexts.length === 3, `摘要长度 3个按钮: ${summaryAfter.pillTexts.join("/")}`);
        ok(summaryAfter.inputCount >= 2, `摘要配置 ${summaryAfter.inputCount} 个输入控件`);
      }
    }
  }

  await page.screenshot({ path: "screenshots/test-ai-module.png" });

  console.log("\n══════════════════════════════");
  console.log(`  通过: ${passed}  失败: ${failed}`);
  if (failed === 0) console.log("  🎉 面板验证通过!");
  console.log("══════════════════════════════\n");

  await page.waitForTimeout(500);
  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("异常:", e.message); process.exit(1); });
