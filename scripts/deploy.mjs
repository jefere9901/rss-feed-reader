import { copyFileSync, existsSync } from "fs";
import { resolve } from "path";

const dist = resolve(import.meta.dirname || ".", "..", "dist");
const pluginDir = process.env.SIYUAN_PLUGIN_DIR || "";

if (!pluginDir) {
  console.log("请设置环境变量 SIYUAN_PLUGIN_DIR 指向思源插件目录");
  console.log("示例: $env:SIYUAN_PLUGIN_DIR='D:/SiYuan/data/plugins/rss-feed-reader'; npm run deploy");
  process.exit(1);
}

import { readdirSync } from "fs";

const entries = readdirSync(dist);
for (const f of entries) {
  const src = resolve(dist, f);
  const dst = resolve(pluginDir, f);
  if (existsSync(src) && !src.endsWith(".md") && f !== "icon.png") {
    copyFileSync(src, dst);
    console.log(`✅ ${f} → ${dst}`);
  }
}

console.log("部署完成!");
