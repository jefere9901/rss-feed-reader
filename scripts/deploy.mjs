import { copyFileSync, existsSync } from "fs";
import { resolve } from "path";

const dist = resolve(import.meta.dirname || ".", "..", "dist");
const pluginDir = process.env.SIYUAN_PLUGIN_DIR || "";

if (!pluginDir) {
  console.log("请设置环境变量 SIYUAN_PLUGIN_DIR 指向思源插件目录");
  console.log("示例: $env:SIYUAN_PLUGIN_DIR='D:/SiYuan/data/plugins/rss-feed-reader'; npm run deploy");
  process.exit(1);
}

const files = ["index.js", "plugin.json", "index.css"];
for (const f of files) {
  const src = resolve(dist, f);
  const dst = resolve(pluginDir, f);
  if (existsSync(src)) {
    copyFileSync(src, dst);
    console.log(`✅ ${f} → ${dst}`);
  } else {
    console.log(`⚠️ ${src} 不存在，跳过`);
  }
}

console.log("部署完成!");
