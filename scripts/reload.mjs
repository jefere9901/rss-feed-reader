const SIYUAN_URL = process.env.SIYUAN_URL || "http://127.0.0.1:6806";
const TOKEN = process.env.SIYUAN_TOKEN || "";
const PLUGIN_NAME = process.env.SIYUAN_PLUGIN_NAME || "rss-feed-reader";

if (!TOKEN) {
  console.log("请设置环境变量 SIYUAN_TOKEN");
  console.log("示例: $env:SIYUAN_TOKEN='your_token'; npm run reload");
  process.exit(1);
}

const res = await fetch(`${SIYUAN_URL}/api/system/reloadPlugin`, {
  method: "POST",
  headers: {
    "Authorization": `Token ${TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({}),
});

const json = await res.json();
console.log(json.code === 0 ? "✅ 插件已重载" : `❌ ${json.msg}`);
