import { copyFileSync } from "fs";
import { resolve } from "path";

const base = resolve(import.meta.dirname || ".", "..");
const dist = resolve(base, "dist");

const extras = ["plugin.json", "README.md", "README_en.md", "icon.png"];
for (const f of extras) {
  try {
    copyFileSync(resolve(base, f), resolve(dist, f));
    console.log(`✅ ${f} → dist/`);
  } catch (e) {
    console.log(`⚠️ ${f} 复制失败:`, e.message);
  }
}

console.log("dist 目录已准备就绪");
