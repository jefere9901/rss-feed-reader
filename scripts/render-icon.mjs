import { chromium } from "playwright";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = resolve(__dirname, "..", "icon-render.html");

async function renderIcon() {
  let browser;
  try {
    browser = await chromium.launch({
      channel: "chrome",
      headless: true,
    });
  } catch {
    browser = await chromium.launch({
      headless: true,
    });
  }

  const page = await browser.newPage({
    viewport: { width: 160, height: 160 },
  });

  await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  const outputPath = resolve(__dirname, "..", "icon.png");
  await page.screenshot({ path: outputPath, omitBackground: false });
  console.log(`icon.png 已生成`);
  await browser.close();
}

renderIcon().catch((e) => {
  console.error("失败:", e.message);
  process.exit(1);
});
