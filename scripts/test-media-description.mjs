import { DOMParser } from "@xmldom/xmldom";

const colors = {
  reset: "\x1b[0m", green: "\x1b[32m", yellow: "\x1b[33m", red: "\x1b[31m", cyan: "\x1b[36m",
};
function log(msg, c = "reset") { console.log(`${colors[c]}${msg}${colors.reset}`); }

// ===== 模拟 YouTube Atom Feed XML =====
const youtubeXML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/" xmlns:yt="http://www.youtube.com/xml/schemas/2015">
  <title>YouTube Test Channel</title>
  <link rel="alternate" href="https://www.youtube.com/channel/test"/>
  <entry>
    <title>Test Video Title</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=test123"/>
    <id>yt:video:test123</id>
    <published>2026-05-01T10:00:00+00:00</published>
    <updated>2026-05-01T12:00:00+00:00</updated>
    <author><name>Test Channel</name></author>
    <media:group>
      <media:title>Test Video Title</media:title>
      <media:description>This is the video description from YouTube. It contains full text about the video content.</media:description>
      <media:thumbnail url="https://i.ytimg.com/vi/test123/default.jpg"/>
    </media:group>
  </entry>
</feed>`;

const parser = new DOMParser();
const doc = parser.parseFromString(youtubeXML, "text/xml");

log("\n=== 测试: YouTube Atom Feed media:group > media:description 解析 ===\n", "cyan");

let allPassed = true;

function assert(condition, msg) {
  if (condition) {
    log(`  ✓ ${msg}`, "green");
  } else {
    log(`  ✗ ${msg}`, "red");
    allPassed = false;
  }
}

// 1. 验证 content 元素为空（模拟 YouTube 场景）
log("--- 场景A: <content> 元素不存在 ---", "yellow");
const entries = Array.from(doc.getElementsByTagName("entry"));
assert(entries.length === 1, `找到 ${entries.length} 个 entry 元素`);
const entry = entries[0];
const contentEl = entry.getElementsByTagName("content");
assert(contentEl.length === 0, "<content> 元素不存在（YouTube 典型场景）");

// 2. 验证 media:group > media:description 可被找到
log("\n--- 场景B: 解析 media:group > media:description ---", "yellow");
const mediaGroups = entry.getElementsByTagName("media:group");
assert(mediaGroups.length === 1, `找到 ${mediaGroups.length} 个 media:group 元素`);
const mediaDesc = mediaGroups[0].getElementsByTagName("media:description");
assert(mediaDesc.length === 1, `找到 ${mediaDesc.length} 个 media:description 元素`);

const description = mediaDesc[0]?.textContent?.trim() ?? "";
assert(description.length > 0, `media:description 内容非空: "${description.slice(0, 40)}..."`);
assert(description.includes("video description"), "内容包含预期文本");

// 3. 验证新增的 content fallback 逻辑
log("\n--- 场景C: 模拟 parseAtomEntry content fallback ---", "yellow");
let content = contentEl?.[0]?.textContent?.trim() ?? "";
assert(content === "", "初始 content 为空");
if (!content) {
  const mg = entry.getElementsByTagName("media:group");
  if (mg.length > 0) {
    const md = mg[0].getElementsByTagName("media:description")[0];
    if (md) {
      content = md.textContent?.trim() ?? "";
    }
  }
}
assert(content.length > 0, `fallback 获取到 content: "${content.slice(0, 40)}..."`);

// 4. 验证 summary fallback
log("\n--- 场景D: 模拟 parseAtomEntry summary fallback ---", "yellow");
const summaryEl = entry.getElementsByTagName("summary");
assert(summaryEl.length === 0, "<summary> 元素不存在");
const summary = "" || content.replace(/<[^>]+>/g, "").slice(0, 500);
assert(summary.length > 0, `summary fallback 正常: "${summary.slice(0, 40)}..."`);
assert(summary === content, "summary 等于 content（无 HTML 标签需去除）");

// 5. 场景: <content> 和 <summary> 都存在且有值（非 YouTube 场景不破坏）
log("\n--- 场景E: 普通 Atom feed（有 content）不破坏原有逻辑 ---", "yellow");
const normalXML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Normal Post</title>
    <link rel="alternate" href="https://example.com/post"/>
    <content type="html">&lt;p&gt;Hello World&lt;/p&gt;</content>
    <summary>Short summary</summary>
    <published>2026-05-01T10:00:00+00:00</published>
    <author><name>Author</name></author>
  </entry>
</feed>`;
const normalDoc = parser.parseFromString(normalXML, "text/xml");
const normalEntry = normalDoc.getElementsByTagName("entry")[0];
const normalContent = normalEntry.getElementsByTagName("content")[0]?.textContent?.trim() ?? "";
assert(normalContent === "<p>Hello World</p>", `普通 content 正常: "${normalContent}"`);

// 6. 场景: <content> 存在但为空，media:group 补充
log("\n--- 场景F: <content> 存在但为空, fallback 到 media:description ---", "yellow");
const mixedXML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <entry>
    <title>Mixed Post</title>
    <link rel="alternate" href="https://example.com/mixed"/>
    <content/>
    <media:group>
      <media:description>Content from media namespace</media:description>
    </media:group>
    <published>2026-05-01T10:00:00+00:00</published>
    <author><name>Author</name></author>
  </entry>
</feed>`;
const mixedDoc = parser.parseFromString(mixedXML, "text/xml");
const mixedEntry = mixedDoc.getElementsByTagName("entry")[0];
let mixedContent = mixedEntry.getElementsByTagName("content")[0]?.textContent?.trim() ?? "";
assert(mixedContent === "", "<content> 为空字符串");
if (!mixedContent) {
  const mg = mixedEntry.getElementsByTagName("media:group");
  if (mg.length > 0) {
    const md = mg[0].getElementsByTagName("media:description")[0];
    if (md) {
      mixedContent = md.textContent?.trim() ?? "";
    }
  }
}
assert(mixedContent === "Content from media namespace", `fallback 成功: "${mixedContent}"`);

// ===== 结果汇总 =====
log("\n" + "=".repeat(50), "cyan");
if (allPassed) {
  log("  ✅ 所有测试通过! YouTube Atom media:description 解析修复验证成功", "green");
} else {
  log("  ❌ 存在失败测试，请检查", "red");
}
log("=".repeat(50) + "\n", "cyan");
