import { createInterface } from "readline";

const SIYUAN_URL = process.env.SIYUAN_URL || "http://127.0.0.1:6806";
const TOKEN = process.env.SIYUAN_TOKEN || "";

function siyuanApi(path, body = {}) {
  return fetch(`${SIYUAN_URL}${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Token ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }).then((r) => r.json());
}

const colors = {
  reset: "\x1b[0m", green: "\x1b[32m", yellow: "\x1b[33m", red: "\x1b[31m", cyan: "\x1b[36m",
};
function log(msg, c = "reset") { console.log(`${colors[c]}${msg}${colors.reset}`); }

// ===== 测试 1: 验证插件文件 =====
log("\n=== 测试 1: 插件文件检查 ===", "cyan");
const pluginDir = "D:/IDMDown/tec9901/data/plugins/rss-feed-reader";
import { existsSync, readFileSync, statSync } from "fs";
import { resolve } from "path";

const indexPath = resolve(pluginDir, "index.js");
const jsonPath = resolve(pluginDir, "plugin.json");

if (existsSync(indexPath)) {
  const size = statSync(indexPath).size;
  log(`  ✓ index.js 存在 (${(size / 1024).toFixed(1)} KB)`, "green");
} else {
  log(`  ✗ index.js 不存在! 路径: ${indexPath}`, "red");
}

if (existsSync(jsonPath)) {
  const cfg = JSON.parse(readFileSync(jsonPath, "utf-8"));
  log(`  ✓ plugin.json 存在`, "green");
  log(`    名称: ${cfg.name}`, "green");
  log(`    版本: ${cfg.version}`, "green");
  log(`    字段: displayName=${!!cfg.displayName}, backends=${cfg.backends?.join(",")}, frontends=${cfg.frontends?.join(",")}`, "green");
} else {
  log(`  ✗ plugin.json 不存在!`, "red");
}

// ===== 测试 2: API 连通性 =====
log("\n=== 测试 2: 思源 API 连通性 ===", "cyan");
try {
  const t = await siyuanApi("/api/system/currentTime");
  log(`  ✓ API 连接成功, 服务器时间: ${new Date(t.data).toLocaleString("zh-CN")}`, "green");
} catch (e) {
  log(`  ✗ API 连接失败: ${e.message}`, "red");
  process.exit(1);
}

// ===== 测试 3: 笔记本列表 =====
log("\n=== 测试 3: 笔记本列表 ===", "cyan");
let notebooks = [];
try {
  const r = await siyuanApi("/api/notebook/lsNotebooks");
  notebooks = r.data.notebooks;
  notebooks.forEach((nb) => {
    log(`  📓 ${nb.name} (${nb.id})`, "green");
  });
} catch (e) {
  log(`  ✗ 获取失败: ${e.message}`, "red");
}

// ===== 测试 4: 创建 RSS 测试笔记本 =====
log("\n=== 测试 4: 创建 RSS 测试笔记本 ===", "cyan");
let rssNotebookId = notebooks.find((n) => n.name === "RSS 订阅")?.id;
if (!rssNotebookId) {
  try {
    const r = await siyuanApi("/api/notebook/createNotebook", { name: "RSS 订阅" });
    rssNotebookId = r.data.notebook.id;
    log(`  ✓ 已创建 'RSS 订阅' 笔记本 (${rssNotebookId})`, "green");
  } catch (e) {
    log(`  ✗ 创建失败: ${e.message}`, "red");
  }
} else {
  log(`  ✓ 'RSS 订阅' 笔记本已存在 (${rssNotebookId})`, "green");
}

// ===== 测试 5: RSS 解析测试 =====
log("\n=== 测试 5: RSS 源解析 ===", "cyan");
const testFeeds = [
  "https://feeds.feedburner.com/ruanyifeng",
  "https://sspai.com/feed",
];

async function testRssParse(url) {
  try {
    log(`  测试: ${url}`, "yellow");
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(15000) });
    const xml = await res.text();
    const { DOMParser } = await import("@xmldom/xmldom");
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "application/xml");

    let title = "", items = [];

    // RSS 2.0
    const rssChannels = doc.getElementsByTagName("channel");
    if (rssChannels.length > 0) {
      title = rssChannels[0].getElementsByTagName("title")[0]?.textContent || "";
      items = Array.from(rssChannels[0].getElementsByTagName("item")).slice(0, 5);
    }

    // Atom
    const atomFeeds = doc.getElementsByTagName("feed");
    if (atomFeeds.length > 0) {
      title = atomFeeds[0].getElementsByTagName("title")[0]?.textContent || "";
      items = Array.from(atomFeeds[0].getElementsByTagName("entry")).slice(0, 5);
    }

    log(`  ✓ 标题: ${title}`, "green");
    log(`  ✓ 文章数(前5): ${items.length}`, "green");
    items.forEach((item, i) => {
      const t = item.getElementsByTagName("title")[0]?.textContent || "(无标题)";
      const l = (item.getElementsByTagName("link")[0]?.textContent || item.getElementsByTagName("link")[0]?.getAttribute("href") || "");
      log(`    ${i + 1}. ${t}`, "green");
    });
    return { title, items };
  } catch (e) {
    log(`  ✗ 解析失败: ${e.message}`, "red");
    return null;
  }
}

for (const feedUrl of testFeeds) {
  await testRssParse(feedUrl);
}

// ===== 测试 6: 创建测试文章文档 =====
log("\n=== 测试 6: 写入思源文档 ===", "cyan");
if (rssNotebookId) {
  const now = new Date().toLocaleDateString("zh-CN").replace(/\//g, "-");
  const docPath = `/RSS 测试-${now}`;
  try {
    const r = await siyuanApi("/api/filetree/createDocWithMd", {
      notebook: rssNotebookId,
      path: docPath,
      markdown: `# RSS 插件功能测试\n\n## 测试时间\n\n${new Date().toLocaleString("zh-CN")}\n\n## 环境状态\n\n- 插件文件: 已部署\n- 思源 API: 正常\n- RSS 解析: 已测试`,
    });
    const docId = r.data;
    log(`  ✓ 文档已创建: ${docPath}`, "green");
    log(`    文档ID: ${docId}`, "green");

    // 追加块
    await siyuanApi("/api/block/prependBlock", {
      parentID: docId,
      data: `## RSS 源测试\n\n- 测试时间: ${new Date().toLocaleString("zh-CN")}\n- 结果: API 写入正常`,
      dataType: "markdown",
    });
    log(`  ✓ 块已追加到文档`, "green");
  } catch (e) {
    log(`  ✗ 写入失败: ${e.message}`, "red");
  }
}

log("\n=== 测试完成 ===", "cyan");
log("请检查思源笔记中是否出现:", "yellow");
log("  1. 左侧 Dock 栏 RSS 图标 📰", "yellow");
log("  2. 点击图标后展开侧边栏面板", "yellow");
log("  3. 'RSS 订阅' 笔记本及测试文档", "yellow");
