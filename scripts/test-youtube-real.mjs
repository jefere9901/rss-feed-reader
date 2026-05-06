import { DOMParser } from "@xmldom/xmldom";

const colors = {
  reset: "\x1b[0m", green: "\x1b[32m", yellow: "\x1b[33m", red: "\x1b[31m", cyan: "\x1b[36m", magenta: "\x1b[35m",
};
function log(msg, c = "reset") { console.log(`${colors[c]}${msg}${colors.reset}`); }

const FEED_URL = "https://www.youtube.com/feeds/videos.xml?channel_id=UCjuNibFJ21MiSNpu8LZyV4w";

log("\n========================================", "cyan");
log(`  YouTube Atom Feed 端到端解析测试`, "cyan");
log(`  ${FEED_URL}`, "magenta");
log("========================================\n", "cyan");

const res = await fetch(FEED_URL, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/atom+xml, application/xml, text/xml",
  },
  signal: AbortSignal.timeout(15000),
});

if (!res.ok) {
  log(`HTTP ${res.status}: ${res.statusText}`, "red");
  process.exit(1);
}

const xml = await res.text();
log(`✓ 成功获取 XML (${(xml.length / 1024).toFixed(1)} KB)\n`, "green");

const parser = new DOMParser();
const doc = parser.parseFromString(xml, "text/xml");

const feedTitle = doc.getElementsByTagName("title")[0]?.textContent?.trim() || "(无标题)";
log(`频道: ${feedTitle}\n`, "yellow");

const entries = Array.from(doc.getElementsByTagName("entry"));
log(`共 ${entries.length} 个视频条目\n`, "cyan");

let totalPass = 0;
let totalFail = 0;

entries.slice(0, 5).forEach((entry, idx) => {
  log(`--- Entry #${idx + 1} ---`, "magenta");

  const title = entry.getElementsByTagName("title")[0]?.textContent?.trim() || "(无标题)";
  log(`  标题: ${title.slice(0, 60)}`, "yellow");

  const published = entry.getElementsByTagName("published")[0]?.textContent?.trim() || "";
  log(`  发布: ${published}`, "yellow");

  const author = entry.getElementsByTagName("author")?.[0]
    ?.getElementsByTagName("name")?.[0]?.textContent?.trim() || "";
  log(`  作者: ${author}`, "yellow");

  const contentEl = entry.getElementsByTagName("content");
  const hasContent = contentEl.length > 0 && (contentEl[0]?.textContent?.trim()?.length || 0) > 0;
  log(`  <content> 有内容: ${hasContent ? "是 (" + contentEl[0].textContent.trim().length + " chars)" : "否"}`, hasContent ? "green" : "red");

  const mediaGroups = entry.getElementsByTagName("media:group");
  const hasMediaGroup = mediaGroups.length > 0;
  log(`  <media:group> 存在: ${hasMediaGroup ? "是" : "否"}`, hasMediaGroup ? "green" : "red");

  if (hasMediaGroup) {
    const mediaDesc = mediaGroups[0].getElementsByTagName("media:description")[0];
    if (mediaDesc) {
      const descText = mediaDesc.textContent?.trim() || "";
      log(`  <media:description> 内容长度: ${descText.length} chars`, "green");
      log(`  预览: ${descText.slice(0, 80)}...`, "cyan");
    } else {
      log(`  <media:description> 不存在`, "red");
    }
  }

  let content = contentEl?.[0]?.textContent?.trim() ?? "";
  if (!content && hasMediaGroup) {
    const mediaDesc = mediaGroups[0].getElementsByTagName("media:description")[0];
    if (mediaDesc) {
      content = mediaDesc.textContent?.trim() ?? "";
    }
  }

  const summaryEl = entry.getElementsByTagName("summary")[0];
  const summaryText = summaryEl?.textContent?.trim() ?? "";
  const summary = summaryText || content.replace(/<[^>]+>/g, "").slice(0, 500);

  log(`  最终 content 长度: ${content.length} chars`, content.length > 0 ? "green" : "red");
  log(`  最终 summary 长度: ${summary.length} chars`, summary.length > 0 ? "green" : "red");

  if (content.length > 0 && summary.length > 0) {
    totalPass++;
    log(`  ✅ 解析成功\n`, "green");
  } else {
    totalFail++;
    log(`  ❌ 解析失败\n`, "red");
  }
});

log("=".repeat(50), "cyan");
log(`  结果: ${totalPass} 通过 / ${totalFail} 失败 (共 ${entries.slice(0, 5).length} 条)`, totalFail === 0 ? "green" : "red");

if (totalFail === 0) {
  log("\n  🎉 YouTube Atom media:description 解析修复验证成功!", "green");
} else {
  log("\n  ❌ 仍有条目解析失败，需要进一步排查", "red");
}
log("=".repeat(50) + "\n", "cyan");
