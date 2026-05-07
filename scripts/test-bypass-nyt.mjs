const NORMAL_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 RSS Reader/1.0";
const GOOGLEBOT_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

const NYT_FEEDS = [
  "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
  "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
  "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml",
];

const colors = {
  reset: "\x1b[0m", green: "\x1b[32m", yellow: "\x1b[33m",
  red: "\x1b[31m", cyan: "\x1b[36m", magenta: "\x1b[35m",
};
function log(msg, c = "reset") { console.log(`${colors[c]}${msg}${colors.reset}`); }

function countArticles(xml) {
  const matches = xml.match(/<item>/gi);
  return matches ? matches.length : 0;
}

function extractTitles(xml) {
  const re = /<title[^>]*>([^<]*)<\/title>/gi;
  const titles = [];
  let m;
  while ((m = re.exec(xml)) !== null) {
    const t = m[1].trim();
    if (t && !t.includes("NYT >") && t !== "NYTimes.com" && !t.includes("RSS")) {
      titles.push(t);
    }
  }
  return titles.slice(0, 5);
}

function checkBlocked(xml) {
  const sizeKB = (xml.length / 1024).toFixed(1);
  const articleCount = countArticles(xml);
  const hasPaywall = /paywall|subscribe|subscription|meter|metered|log.?in|sign.?in/i.test(xml.slice(0, 2000));
  const topTitles = extractTitles(xml);

  return {
    sizeKB,
    articleCount,
    hasPaywall,
    topTitles: topTitles.length > 0 ? topTitles : ["(未提取到标题)"],
  };
}

async function fetchWithUA(url, ua, label) {
  log(`\n${"─".repeat(60)}`, "reset");
  log(`${label}: ${url}`, "cyan");
  log(`UA: ${ua.slice(0, 60)}...`, "yellow");

  const start = Date.now();
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": ua, "Accept": "application/rss+xml, application/xml, text/xml" },
      signal: AbortSignal.timeout(20000),
    });
    const ms = Date.now() - start;

    log(`  HTTP ${res.status} ${res.statusText} (${ms}ms)`, res.status === 200 ? "green" : "red");
    log(`  Content-Type: ${res.headers.get("content-type") || "none"}`, "reset");

    const xml = await res.text();
    const info = checkBlocked(xml);

    log(`  📦 大小: ${info.sizeKB} KB`, "cyan");
    log(`  📄 文章数: ${info.articleCount}`, info.articleCount > 0 ? "green" : "red");
    if (info.topTitles[0] !== "(未提取到标题)") {
      log(`  📰 前5篇:`, "magenta");
      info.topTitles.forEach((t, i) => log(`     ${i + 1}. ${t.slice(0, 60)}`, "reset"));
    }
    if (info.hasPaywall) {
      log(`  ⚠️ 检测到付费墙标记!`, "red");
    }

    if (info.articleCount === 0) {
      const preview = xml.slice(0, 500).replace(/\s+/g, " ").trim();
      log(`  🔍 响应预览: ${preview}`, "red");
    }

    return { success: res.status === 200 && info.articleCount > 0, info, xml, status: res.status };
  } catch (e) {
    const ms = Date.now() - start;
    log(`  ❌ 请求失败 (${ms}ms): ${e.message}`, "red");
    return { success: false, info: null, xml: "", status: 0 };
  }
}

async function main() {
  log("\n╔══════════════════════════════════════════════╗", "cyan");
  log("║   NYT 付费墙绕过测试                          ║", "cyan");
  log("╚══════════════════════════════════════════════╝", "cyan");

  let normalOk = 0, bypassOk = 0, total = 0;

  for (const feedUrl of NYT_FEEDS) {
    total++;

    // Test 1: Normal UA
    const normal = await fetchWithUA(feedUrl, NORMAL_UA, "🔵 普通模式");
    if (normal.success) normalOk++;

    // Test 2: Googlebot UA (bypass)
    const bypass = await fetchWithUA(feedUrl, GOOGLEBOT_UA, "🟢 绕过模式 (Googlebot)");
    if (bypass.success) bypassOk++;
  }

  // Summary
  log(`\n${"═".repeat(60)}`, "cyan");
  log(`📊 测试总结`, "cyan");
  log(`  普通模式: ${normalOk}/${total} 成功`, normalOk === total ? "green" : "red");
  log(`  绕过模式: ${bypassOk}/${total} 成功`, bypassOk === total ? "green" : "red");

  if (bypassOk > normalOk) {
    log(`\n✅ 绕过模式效果更好!`, "green");
  } else if (bypassOk === normalOk) {
    log(`\nℹ️ 两种模式都能正常获取 (RSS 通常没有付费墙限制)`, "yellow");
  } else {
    log(`\n⚠️ 普通模式更好，绕过模式可能需要更多参数`, "red");
  }

  log(`\n💡 说明: RSS Feed 本身通常不设付费墙，绕过功能主要用于后续的「全文抓取」场景。`, "cyan");
}

main();
