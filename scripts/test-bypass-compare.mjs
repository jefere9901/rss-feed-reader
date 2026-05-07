const URL = "https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml";
const UA_N = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 RSS Reader/1.0";
const UA_B = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

function c(s, c = "reset") {
  const codes = { reset: "\x1b[0m", green: "\x1b[32m", yellow: "\x1b[33m", red: "\x1b[31m", cyan: "\x1b[36m", magenta: "\x1b[35m", dim: "\x1b[2m" };
  return (codes[c] || "") + s + codes.reset;
}

async function fetchRSS(ua) {
  const t0 = Date.now();
  const r = await fetch(URL, {
    headers: { "User-Agent": ua, Accept: "application/rss+xml, application/xml, text/xml" },
    signal: AbortSignal.timeout(20000),
  });
  const xml = await r.text();
  const ms = Date.now() - t0;

  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const body = m[1];
    const titleMt = body.match(/<title[^>]*>([\s\S]*?)<\/title>/);
    const title = (titleMt ? titleMt[1] : "").trim().replace(/<!\[CDATA\[|\]\]>/g, "");
    const linkMt = body.match(/<link[^>]*>([\s\S]*?)<\/link>/);
    const link = (linkMt ? linkMt[1] : "").trim();
    const descMt = body.match(/<description[^>]*>([\s\S]*?)<\/description>/);
    const desc = (descMt ? descMt[1] : "").trim().replace(/<!\[CDATA\[|\]\]>/g, "").slice(0, 150);
    const creatorMt = body.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/);
    const creator = (creatorMt ? creatorMt[1] : "").trim().replace(/<!\[CDATA\[|\]\]>/g, "");
    const pubMt = body.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const pubDate = (pubMt ? pubMt[1] : "").trim();
    items.push({ title, link, desc, creator, pubDate });
  }

  return { items, xml, ms, status: r.status, sizeKB: (xml.length / 1024).toFixed(1) };
}

async function main() {
  console.log("\n" + c("╔══════════════════════════════════════════════════════════╗", "cyan"));
  console.log(c("║  NYT Arts RSS — 关闭 vs 开启 bypass  内容对比测试        ║", "cyan"));
  console.log(c("╚══════════════════════════════════════════════════════════╝", "cyan"));
  console.log("");

  console.log(c("RSS URL: ", "dim") + URL);
  console.log("");

  const normal = await fetchRSS(UA_N);
  const bypass = await fetchRSS(UA_B);

  console.log("┌──────────────────────────┬──────────────────┬──────────────────┐");
  console.log("│                          │  " + c("🔵 关闭 bypass", "yellow") + "  │  " + c("🟢 开启 bypass", "green") + "  │");
  console.log("├──────────────────────────┼──────────────────┼──────────────────┤");
  console.log("│ HTTP 状态码              │  " + String(normal.status).padEnd(15) + "│  " + String(bypass.status).padEnd(15) + "│");
  console.log("│ 响应耗时                 │  " + (normal.ms + "ms").padEnd(15) + "│  " + (bypass.ms + "ms").padEnd(15) + "│");
  console.log("│ 响应大小                 │  " + normal.sizeKB.padEnd(15) + "│  " + bypass.sizeKB.padEnd(15) + "│");
  console.log("│ 文章条目数               │  " + String(normal.items.length).padEnd(15) + "│  " + String(bypass.items.length).padEnd(15) + "│");
  const xmlSame = normal.xml === bypass.xml;
  console.log("│ XML byte-by-byte 一致?   │  " + (xmlSame ? c("✅ 完全一致", "green").padEnd(19) : c("❌ 有差异", "red")).padEnd(15) + "│                  │");
  console.log("└──────────────────────────┴──────────────────┴──────────────────┘");

  console.log("");
  const n = Math.min(normal.items.length, bypass.items.length, 8);
  console.log(c(`── 前 ${n} 篇文章详情 (两模式内容相同，仅展示一份) ──`, "cyan"));
  console.log("");

  for (let i = 0; i < n; i++) {
    const a = normal.items[i];
    console.log(c(`  [${i + 1}] `, "magenta") + c(a.title.slice(0, 72), "green"));
    console.log(c("      链接: ", "dim") + a.link.slice(0, 85));
    console.log(c("      作者: ", "dim") + (a.creator || "(无)") + c("  日期: ", "dim") + (a.pubDate || "(无)"));
    if (a.desc) {
      const cleanDesc = a.desc.replace(/<[^>]+>/g, "").trim().slice(0, 100);
      console.log(c("      摘要: ", "dim") + cleanDesc + (a.desc.length > 150 ? "..." : ""));
    }
    console.log("");
  }

  console.log(c("══════════════════════════════════════════════════════════", "cyan"));
  if (xmlSame) {
    console.log(c("  ✅ 结论: 两种模式返回的 RSS XML 完全一致", "green"));
    console.log(c("  RSS Feed 本身没有付费墙，bypass 不影响 RSS 抓取结果", "yellow"));
    console.log(c("  bypass 的真正价值在后续「全文抓取」场景", "yellow"));
  } else {
    console.log(c("  ❌ 两种模式返回内容不同!", "red"));
  }
  console.log(c("══════════════════════════════════════════════════════════", "cyan"));
  console.log("");
}

main();
