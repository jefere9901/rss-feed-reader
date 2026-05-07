import { chromium } from "playwright";

const YOUTUBE_URL = "https://www.youtube.com/@chaijing2023";
const P = "✅", F = "❌";

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("  YouTube handle → channel ID (via SiYuan forwardProxy)");
  console.log("=".repeat(60) + "\n");

  let browser;
  try { browser = await chromium.launch({ headless: false, args: ["--window-size=1400,900", "--no-sandbox"] }); }
  catch { browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--window-size=1400,900", "--no-sandbox"] }); }
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true })).newPage();

  // Open SiYuan first to get the auth context
  await page.goto("http://localhost:6806", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);

  let passed = 0, failed = 0;
  function ok(c, d) { if (c) { passed++; console.log(`  ${P} ${d}`); } else { failed++; console.log(`  ${F} ${d}`); } }

  // Step 1: Fetch channel page via SiYuan proxy
  console.log("Step 1: 通过思源 forwardProxy 获取频道页面...");
  let pageResult = await page.evaluate(async (url) => {
    try {
      let res = await fetch("http://127.0.0.1:6806/api/network/forwardProxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url,
          method: "GET",
          timeout: 20000,
          contentType: "text/html",
          headers: [
            { name: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" },
            { name: "Accept-Language", value: "zh-CN,zh;q=0.9" },
            { name: "Accept", value: "text/html,application/xhtml+xml" },
          ],
          payload: {},
          payloadEncoding: "text",
          responseEncoding: "text",
        }),
      });
      let json = await res.json();
      if (json.code !== 0) return { error: json.code + " " + json.msg, status: json.data?.status };
      let html = json.data.body;

      // Extract channel ID
      let results = { size: html.length, status: json.data.status };

      // Pattern 1: meta itemprop channelId
      let m1 = html.match(/<meta\s+itemprop="channelId"\s+content="([^"]+)"/);
      results.metaItemprop = m1 ? m1[1] : null;

      // Pattern 2: canonical
      let m2 = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/);
      results.canonical = m2 ? m2[1] : null;

      // Pattern 3: externalId
      let m3 = html.match(/"externalId"\s*:\s*"([^"]+)"/);
      results.externalId = m3 ? m3[1] : null;

      // Pattern 4: channelId
      let m4 = html.match(/"channelId"\s*:\s*"([^"]+)"/);
      results.channelId = m4 ? m4[1] : null;

      // Pattern 5: browseId
      let m5 = html.match(/"browseId"\s*:\s*"([^"]+)"/);
      results.browseId = m5 ? m5[1] : null;

      // Pattern 6: rssUrl in ytInitialData
      let m6 = html.match(/"rssUrl"\s*:\s*"([^"]+)"/);
      results.rssUrl = m6 ? m6[1].replace(/\\/g, '') : null;

      // Pattern 7: title
      let m7 = html.match(/<meta\s+name="title"\s+content="([^"]+)"/);
      results.metaTitle = m7 ? m7[1] : null;

      // Pattern 8: og:title
      let m8 = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/);
      results.ogTitle = m8 ? m8[1] : null;

      // Pattern 9: Try parsing ytInitialData JSON
      let ytIdx = html.indexOf("var ytInitialData");
      if (ytIdx > -1) {
        let eqIdx = html.indexOf("=", ytIdx);
        let semiIdx = html.indexOf(";", eqIdx);
        if (eqIdx > -1 && semiIdx > -1) {
          try {
            let jsonStr = html.substring(eqIdx + 1, semiIdx).trim();
            let data = JSON.parse(jsonStr);
            let meta = data?.metadata?.channelMetadataRenderer;
            if (meta) {
              results.ytExternalId = meta.externalId || null;
              results.ytTitle = meta.title || null;
              results.ytRssUrl = meta.rssUrl || null;
            }
          } catch(e) { results.parseErr = e.message; }
        }
      }

      return results;
    } catch(e) { return { error: e.message }; }
  }, YOUTUBE_URL);

  console.log(JSON.stringify(pageResult, null, 2));

  if (pageResult.error) {
    console.log(`  ${F} fetch 失败: ${pageResult.error}`);
  } else {
    ok(pageResult.size > 1000, `页面获取成功 (${pageResult.size} 字节)`);

    const channelId = pageResult.ytExternalId ||
      pageResult.externalId ||
      pageResult.channelId ||
      pageResult.browseId ||
      pageResult.metaItemprop;

    console.log(`\n  → Channel ID: ${channelId || "(未找到)"}`);
    ok(!!channelId, `Channel ID: ${channelId}`);

    if (channelId) {
      const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
      console.log(`  → RSS URL: ${rssUrl}`);

      // Step 2: Fetch RSS via proxy
      console.log("\nStep 2: 通过思源 forwardProxy 获取 RSS...");
      let rssResult = await page.evaluate(async (url) => {
        try {
          let res = await fetch("http://127.0.0.1:6806/api/network/forwardProxy", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: url, method: "GET", timeout: 15000, contentType: "text/xml",
              headers: [
                { name: "User-Agent", value: "Mozilla/5.0 RSS Reader/1.0" },
              ],
              payload: {}, payloadEncoding: "text", responseEncoding: "text",
            }),
          });
          let json = await res.json();
          if (json.code !== 0) return { error: json.code + " " + json.msg };
          let xml = json.data.body;
          return {
            size: xml.length, status: json.data.status,
            hasFeed: xml.includes('<feed'), hasEntry: xml.includes('<entry'),
            entryCount: (xml.match(/<entry>/g) || []).length,
            title: (xml.match(/<title>([^<]+)<\/title>/) || [])[1] || '',
            hasMediaDesc: xml.includes('<media:description'),
            preview: xml.slice(0, 500),
          };
        } catch(e) { return { error: e.message }; }
      }, rssUrl);

      console.log(JSON.stringify(rssResult, null, 2));

      if (!rssResult.error) {
        ok(rssResult.hasFeed, "RSS 格式正确");
        ok(rssResult.entryCount > 0, `含 ${rssResult.entryCount} 个视频`);
        console.log(`\n  🎬 频道: "${rssResult.title}"`);
        console.log(`  📹 视频数: ${rssResult.entryCount}`);
        console.log(`  📺 media:description: ${rssResult.hasMediaDesc}`);
      } else {
        ok(false, `RSS fetch 失败: ${rssResult.error}`);
      }
    }
  }

  console.log("\n" + "=".repeat(60));
  let total = passed + failed;
  console.log(`  结果: ${passed}/${total} 通过, ${failed} 失败`);
  console.log("=".repeat(60));
  await browser.close();
}
main();
