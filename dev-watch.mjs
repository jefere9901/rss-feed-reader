import { spawn, execSync } from "child_process";
import { existsSync, mkdirSync, copyFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import http from "http";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectDir = __dirname;
const distDir = resolve(projectDir, "dist");
const pluginsDir = process.env.SIYUAN_PLUGIN_DIR || "";
const token = process.env.SIYUAN_TOKEN || "";

function log(msg, type = "info") {
  const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  const colors = { info: "\x1b[36m", success: "\x1b[32m", warn: "\x1b[33m", error: "\x1b[31m", reset: "\x1b[0m" };
  console.log(`${colors[type]}[${time}] ${msg}${colors.reset}`);
}

function reloadSiyuan() {
  return new Promise((resolve) => {
    const body = JSON.stringify({});
    const options = {
      hostname: "127.0.0.1",
      port: 6806,
      path: "/api/system/reloadPlugin",
      method: "POST",
      headers: {
        "Authorization": `Token ${token}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    });
    req.on("error", () => resolve(null));
    req.write(body);
    req.end();
  });
}

function deploy() {
  if (!existsSync(distDir)) {
    log("dist 目录不存在，请先执行构建", "error");
    return false;
  }
  try {
    copyFileSync(resolve(distDir, "index.js"), resolve(pluginsDir, "index.js"));
    copyFileSync(resolve(distDir, "plugin.json"), resolve(pluginsDir, "plugin.json"));
    log("已部署到思源插件目录", "success");
    return true;
  } catch (e) {
    log("部署失败（沙箱限制）: " + e.message, "warn");
    log("请手动复制 dist\\ 下的文件到: " + pluginsDir, "warn");
    return false;
  }
}

async function reload() {
  const result = await reloadSiyuan();
  if (result) {
    log("思源插件已重载", "success");
  } else {
    log("思源 API 无法连接 (未运行?)", "warn");
  }
}

console.log("");
log("========================================", "info");
log("  RSS Feed Reader - 全自动开发环境", "info");
log("========================================", "info");
log("项目: " + projectDir, "info");
log("部署: " + pluginsDir, "info");
console.log("");

// 首次构建
log("首次构建中...", "info");
execSync("npx vite build", { cwd: projectDir, stdio: "inherit" });
deploy();
await reload();

console.log("");
log("========================================", "info");
log("  Watch 模式已启动 (按 Ctrl+C 停止)", "info");
log("  源码修改 -> 自动构建 -> 自动部署 -> 通知重载", "info");
log("========================================", "info");
console.log("");

// Vite watch
const vite = spawn("npx", ["vite", "build", "--watch"], {
  cwd: projectDir,
  shell: true,
  stdio: ["inherit", "pipe", "pipe"],
});

vite.stdout.on("data", (data) => {
  const text = data.toString();
  process.stdout.write(text);
  if (text.includes("built in")) {
    deploy();
    reload();
  }
});

vite.stderr.on("data", (data) => {
  process.stderr.write(data.toString());
});

vite.on("close", (code) => {
  log(`Vite 进程退出 (code: ${code})`, code === 0 ? "success" : "error");
});
