import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const base = resolve(import.meta.dirname || ".", "..");

const pkg = JSON.parse(readFileSync(resolve(base, "package.json"), "utf-8"));
const version = pkg.version;
const zipName = `rss-feed-reader-v${version}.zip`;

console.log(`打包 release: ${zipName}`);

execSync(
  `powershell -Command "Compress-Archive -Path '${resolve(base, "dist")}\\*' -DestinationPath '${resolve(base, zipName)}' -Force"`,
  { stdio: "inherit" }
);

console.log(`✅ ${zipName} 已生成`);
console.log(`📤 上传到: https://github.com/jefere9901/rss-feed-reader/releases/new`);
