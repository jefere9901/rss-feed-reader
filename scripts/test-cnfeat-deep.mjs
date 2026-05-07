import { chromium } from "playwright";

const TEST_RSS_URL = "https://www.cnfeat.com/feed.xml";

async function main() {
  let browser;
  try { browser = await chromium.launch({ headless: false, args: ["--window-size=1400,900", "--no-sandbox"] }); }
  catch { browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--window-size=1400,900", "--no-sandbox"] }); }
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true })).newPage();
  await page.goto("http://localhost:6806", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);

  // Fetch raw feed via API
  console.log("=== 获取原始 Feed 并分析 ===");
  let analysis = await page.evaluate(async (url) => {
    let res = await fetch("http://127.0.0.1:6806/api/network/forwardProxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: url, method: "GET", timeout: 15000, contentType: "text/xml",
        headers: [
          { name: "User-Agent", value: "Mozilla/5.0 RSS Reader/1.0" },
          { name: "Accept", value: "application/rss+xml, application/xml, text/xml" },
        ],
        payload: {}, payloadEncoding: "text", responseEncoding: "text",
      }),
    });
    let json = await res.json();
    if (json.code !== 0 || !json.data.body) return { error: "fetch failed" };

    let xml = json.data.body;

    // Parse with DOMParser
    let parser = new DOMParser();
    let doc = parser.parseFromString(xml, "text/xml");

    // Get first item
    let firstItem = doc.querySelector("item");
    if (!firstItem) return { error: "no item found" };

    let descEl = firstItem.querySelector("description");
    let title = firstItem.querySelector("title")?.textContent?.trim();

    let result = {
      title: title,
      descTagName: descEl?.tagName,
      descChildNodes: [],
    };

    // List all child nodes of description
    if (descEl) {
      let children = descEl.childNodes;
      for (let i = 0; i < children.length; i++) {
        let cn = children[i];
        result.descChildNodes.push({
          index: i,
          nodeType: cn.nodeType,
          nodeTypeName: cn.nodeType === 1 ? "ELEMENT" : cn.nodeType === 3 ? "TEXT" : cn.nodeType === 4 ? "CDATA" : cn.nodeType === 8 ? "COMMENT" : "OTHER",
          nodeName: cn.nodeName || "",
          value: cn.nodeValue ? cn.nodeValue.slice(0, 200) : (cn.textContent ? cn.textContent.slice(0, 200) : ""),
        });
      }
    }

    // Test getHTMLContent logic
    let cdataFound = false;
    let cdataValue = "";
    if (descEl) {
      for (let i = 0; i < descEl.childNodes.length; i++) {
        if (descEl.childNodes[i].nodeType === 4) {
          cdataFound = true;
          cdataValue = descEl.childNodes[i].nodeValue || "";
        }
      }
    }

    // Test what el.textContent gives
    let textContent = descEl ? descEl.textContent?.trim() || "" : "";
    
    // Test what div.textContent → innerHTML does
    let div = document.createElement("div");
    div.textContent = textContent;
    let reEscaped = div.innerHTML || "";

    // Test: raw innerHTML of description element
    let rawDescHTML = descEl ? descEl.innerHTML?.slice(0, 300) : "";

    result.cdataCheck = { found: cdataFound, valuePreview: cdataValue.slice(0, 200) };
    result.textContentCheck = { textLength: textContent.length, preview: textContent.slice(0, 200) };
    result.reEscapeCheck = { length: reEscaped.length, preview: reEscaped.slice(0, 200) };
    result.rawDescHTML = rawDescHTML;
    result.textStartsWithLT = textContent.startsWith("<");

    return result;
  }, TEST_RSS_URL);

  console.log("\n分析结果:");
  console.log(JSON.stringify(analysis, null, 2));

  // Check the key finding
  console.log("\n=== 关键判断 ===");
  console.log(`CDATA 节点: ${analysis.cdataCheck?.found ? "✅ 存在" : "❌ 不存在"}`);
  console.log(`textContent 以 '<' 开头: ${analysis.textStartsWithLT}`);
  console.log(`textContent 开头: "${analysis.textContentCheck?.preview?.slice(0, 80)}..."`);
  console.log(`reEscaped 开头: "${analysis.reEscapeCheck?.preview?.slice(0, 80)}..."`);

  if (analysis.textStartsWithLT && !analysis.cdataCheck?.found) {
    console.log("\n⚠️ 问题确认: description 内容含 HTML 但没有 CDATA 包装");
    console.log("   → textContent 取出的是原始 HTML 文本");
    console.log("   → 再通过 div.textContent=s; div.innerHTML 会二次转义");
    console.log("   → 导致 &lt;p&gt; 显示为文字而非渲染为段落");
  }

  if (analysis.textStartsWithLT && analysis.cdataCheck?.found) {
    console.log("\nCDATA 存在，内容正常。如果不是，请检查其他环节。");
  }

  await browser.close();
}
main();
