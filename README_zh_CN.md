# RSS 订阅阅读器 — 思源笔记插件

一款现代、优雅的 RSS 订阅阅读器插件，专为[思源笔记](https://github.com/siyuan-note/siyuan)打造。

在思源笔记中直接阅读你喜爱的博客、新闻网站和 YouTube 频道 — 支持完整文章内容、暗色模式、OPML 导入和一件保存到笔记本。

<p align="center">
  <img src="image/README/1778036571548.png" alt="RSS 订阅阅读器截图" width="720">
</p>

## ✨ 功能亮点

- **多格式支持** — RSS 2.0、Atom 以及 YouTube 频道 Feed（支持 `media:description` 解析）
- **内置阅读器** — 在思源内部直接阅读完整文章，无需跳转浏览器
- **一键下载** — 将任意文章一键保存为思源笔记
- **订阅管理** — 创建文件夹分类管理订阅源
- **OPML 导入** — 从其他 RSS 阅读器导入现有订阅
- **暗色模式** — 完整暗色主题，与思源 UI 无缝融合
- **未读标记** — 按订阅源和文件夹追踪未读数量
- **自动刷新** — 可配置的自动刷新间隔
- **文章排序** — 新文章可置顶或追加
- **YouTube 支持** — 自动解析 YouTube Atom Feed 中的 `media:group/media:description` 内容

## 📦 安装

### 从 GitHub 安装（推荐）

1. 从 [Releases](https://github.com/your-username/rss-feed-reader/releases) 页面下载最新的 `package.zip`
2. 在思源笔记中，进入 **设置 → 集市 → 插件**
3. 点击 **导入插件**，选择下载的 zip 文件
4. 启用插件

### 手动安装

1. 从源码构建：
   ```bash
   git clone https://github.com/your-username/rss-feed-reader.git
   cd rss-feed-reader
   npm install
   npm run build
   ```
2. 将 `dist/` 目录内容复制到思源插件目录：
   ```
   {workspace}/data/plugins/rss-feed-reader/
   ```

### 环境变量（开发用）

| 变量 | 说明 |
|----------|------|
| `SIYUAN_TOKEN` | 思源 API Token |
| `SIYUAN_PLUGIN_DIR` | 插件目录路径，用于自动部署 |
| `SIYUAN_URL` | 思源服务地址（默认: `http://127.0.0.1:6806`） |

## 🚀 快速上手

1. 点击左侧 Dock 栏的 **RSS Feed** 图标
2. 切换到 **设置** 标签页（⚙️）
3. 点击 **＋ 添加订阅**
4. 输入 Feed 地址（如 `https://sspai.com/feed`），点击 **检测并添加**
5. 切换回 **订阅** 标签页（📰）浏览文章
6. 点击文章打开阅读器，然后点击 **⬇ 下载** 保存到笔记本

### 添加 YouTube 频道

YouTube 频道使用特殊的 URL 格式：

```
https://www.youtube.com/feeds/videos.xml?channel_id=频道ID
```

插件会自动从 `media:description` 命名空间中解析视频描述内容。

### 从 OPML 导入

1. 在 **设置** 标签页中，点击 **📂 导入 OPML**
2. 选择你的 `.opml` 文件（支持从 Feedly、Inoreader、Reeder 等导出）
3. 所有订阅源和文件夹结构将自动导入

## 📁 项目结构

```
rss-feed-reader/
├── src/
│   ├── index.ts              # 插件入口
│   ├── rss-parser.ts         # RSS/Atom/OPML 解析器 + HTML→Markdown 转换
│   ├── store.ts              # 数据持久化与状态管理
│   ├── types.ts              # TypeScript 类型定义
│   ├── api.ts                # 思源 API 封装
│   ├── styles/
│   │   └── index.css         # 插件样式（明暗主题）
│   └── views/
│       ├── dock.ts           # 主面板（标签导航）
│       ├── feed-view.ts      # 订阅/文章列表视图
│       ├── reader-view.ts    # 文章阅读器面板
│       └── settings-view.ts  # 设置与订阅管理
├── scripts/
│   ├── test-media-description.mjs  # media:description 单元测试（6 个场景）
│   ├── test-youtube-real.mjs       # YouTube API 集成测试
│   └── test-youtube-playwright.mjs # Playwright 端到端测试
├── package.json
├── plugin.json
├── vite.config.ts
└── tsconfig.json
```

## 🛠️ 开发

```bash
# 安装依赖
npm install

# 构建
npm run build

# Watch 模式（修改自动重新构建）
npm run dev

# 运行 Playwright 端到端测试
node scripts/test-youtube-playwright.mjs
```

## 🧪 测试

项目包含多层测试覆盖：

| 测试类型 | 文件 | 说明 |
|------|------|------|
| 单元测试 | `scripts/test-media-description.mjs` | 6 个场景 — YouTube media:description 解析 |
| 集成测试 | `scripts/test-youtube-real.mjs` | 真实 YouTube API 调用验证 |
| 端到端测试 | `scripts/test-youtube-playwright.mjs` | 浏览器自动化：添加 Feed → 验证阅读器内容 |

## 📖 已知问题

- YouTube RSS 的 `content` 标签为空 — 已通过 `media:group > media:description` fallback 解决 ✅
- 部分 Atom Feed 可能同时使用 `content` 和 `media:description`，优先使用 `content`

## 🤝 贡献

欢迎提交 Pull Request！请确保：

1. 代码遵循现有风格和规范
2. TypeScript 编译无错误（`npm run build`）
3. 新功能通过相关测试

## 📄 许可证

MIT

---

**为思源社区用 ❤️ 构建**
