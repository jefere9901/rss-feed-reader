import { execSync } from "child_process";
import { readFileSync } from "fs";
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

execSync(
  `powershell -Command "Copy-Item -Path '${resolve(base, zipName)}' -Destination '${resolve(base, "package.zip")}' -Force"`,
  { stdio: "inherit" }
);

console.log(`✅ ${zipName} 已生成`);
console.log(`✅ package.zip 已生成 (集市用)`);
console.log(`📤 上传到: https://github.com/jefere9901/rss-feed-reader/releases/new`);
console.log(`   把 package.zip 作为附件上传到 Release`);
