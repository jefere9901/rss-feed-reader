import type { PluginData, Feed, FeedFolder, Article, AppSettings } from "./types";

export function cleanFeedName(...candidates: string[]): string {
  for (const c of candidates) {
    if (!c || c.trim() === "") continue;
    if (!/^https?:\/\//i.test(c.trim())) return c.trim();
  }
  for (const c of candidates) {
    if (c && c.trim()) {
      try {
        const u = new URL(c.trim());
        let name = u.hostname.replace(/^www\./, "");
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        if (parts.length > 0) name += "/" + parts[parts.length - 1];
        if (name.length > 50) name = name.slice(0, 50) + "...";
        return name;
      } catch {}
    }
  }
  return "未命名订阅";
}

function repairFeedNames(data: PluginData): void {
  for (const f of data.feeds) {
    if (/^https?:\/\//i.test(f.name)) {
      f.name = cleanFeedName(f.name);
    }
  }
}

function defaultSettings(): AppSettings {
  return {
    targetNotebook: "",
    targetNotebookName: "RSS 订阅",
    newArticlePosition: "top",
    autoRefreshMinutes: 0,
  };
}

function defaultData(): PluginData {
  return {
    folders: [],
    feeds: [],
    articles: [],
    settings: defaultSettings(),
  };
}

let pluginInstance: any = null;
let dataFilePath: string = "";

function getPluginDataDir(plugin: any): string {
  if (plugin.dataDir) return plugin.dataDir;
  try {
    const path = require("path");
    const fs = require("fs");
    const candidates = [
      path.join((window as any).siyuan?.config?.system?.workspaceDir || "", "data", "plugins", "rss-feed-reader"),
    ];
    for (const dir of candidates) {
      if (fs.existsSync(dir)) return dir;
    }
  } catch (e) {}
  return "";
}

function readDataFile(): PluginData | null {
  if (!dataFilePath) return null;
  try {
    const fs = require("fs");
    if (fs.existsSync(dataFilePath)) {
      const raw = fs.readFileSync(dataFilePath, "utf-8");
      if (raw && raw.trim()) {
        const data = JSON.parse(raw);
        if (data && typeof data === "object") return data;
      }
    }
  } catch (e) {
    console.warn("[RSS Feed] 读取数据文件失败:", e);
  }
  return null;
}

function writeDataFile(data: PluginData): void {
  if (!dataFilePath) return;
  try {
    const fs = require("fs");
    const path = require("path");
    const dir = path.dirname(dataFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("[RSS Feed] 写入数据文件失败:", e);
  }
}

export function getPluginInstance(): any {
  return pluginInstance;
}

export function initStore(plugin: any): PluginData {
  pluginInstance = plugin;
  const dir = getPluginDataDir(plugin);
  if (dir) {
    const path = require("path");
    dataFilePath = path.join(dir, "data.json");
  }

  const fileData = readDataFile();
  if (fileData) {
    console.log("[RSS Feed] 从文件加载数据:", fileData.feeds?.length || 0, "个订阅源");
    const result = {
      folders: Array.isArray(fileData.folders) ? fileData.folders : [],
      feeds: Array.isArray(fileData.feeds) ? fileData.feeds : [],
      articles: Array.isArray(fileData.articles) ? fileData.articles : [],
      settings: { ...defaultSettings(), ...(fileData.settings || {}) },
    };
    repairFeedNames(result);
    return result;
  }

  try {
    const saved = plugin.loadData("rss-feed-reader-data");
    if (saved !== null && saved !== undefined && saved !== "" && !(typeof saved === "object" && Object.keys(saved).length === 0)) {
      let data: any;
      if (typeof saved === "string") {
        data = JSON.parse(saved);
      } else {
        data = saved;
      }
      if (data && typeof data === "object" && (data.feeds || data.folders)) {
        console.log("[RSS Feed] 从 loadData 加载数据:", data.feeds?.length || 0, "个订阅源");
        writeDataFile(data);
        const result = {
          folders: Array.isArray(data.folders) ? data.folders : [],
          feeds: Array.isArray(data.feeds) ? data.feeds : [],
          articles: Array.isArray(data.articles) ? data.articles : [],
          settings: { ...defaultSettings(), ...(data.settings || {}) },
        };
        repairFeedNames(result);
        return result;
      }
    }
  } catch (e) {
    console.warn("[RSS Feed] loadData 失败:", e);
  }

  try {
    const path = require("path");
    const fs = require("fs");
    const workspaceDir = (window as any).siyuan?.config?.system?.workspaceDir || "";
    if (workspaceDir) {
      const petalFile = path.join(workspaceDir, "data", "storage", "petal", "rss-feed-reader-data");
      if (fs.existsSync(petalFile)) {
        const raw = fs.readFileSync(petalFile, "utf-8");
        if (raw && raw.trim()) {
          const data = JSON.parse(raw);
          if (data && typeof data === "object" && (data.feeds || data.folders)) {
            console.log("[RSS Feed] 从 petal 存储恢复数据:", data.feeds?.length || 0, "个订阅源");
            writeDataFile(data);
            const result = {
              folders: Array.isArray(data.folders) ? data.folders : [],
              feeds: Array.isArray(data.feeds) ? data.feeds : [],
              articles: Array.isArray(data.articles) ? data.articles : [],
              settings: { ...defaultSettings(), ...(data.settings || {}) },
            };
            repairFeedNames(result);
            return result;
          }
        }
      }
    }
  } catch (e) {
    console.warn("[RSS Feed] petal 恢复失败:", e);
  }
  return defaultData();
}

function persist(data: PluginData): void {
  if (!pluginInstance) {
    console.warn("[RSS Feed] 插件实例未初始化，跳过保存");
    return;
  }
  for (const f of data.feeds) {
    if (/^https?:\/\//i.test(f.name)) {
      f.name = cleanFeedName(f.name);
    }
  }
  writeDataFile(data);
  try {
    const json = JSON.stringify(data);
    pluginInstance.saveData("rss-feed-reader-data", json);
  } catch (e) {
    console.error("[RSS Feed] saveData 保存失败:", e);
  }
}

export function saveSettings(
  data: PluginData,
  settings: Partial<AppSettings>
): PluginData {
  data.settings = { ...data.settings, ...settings };
  persist(data);
  return { ...data };
}

export function addFeed(data: PluginData, feed: Feed): PluginData {
  feed.name = cleanFeedName(feed.name);
  if (data.feeds.some((f) => f.url === feed.url)) {
    throw new Error("该订阅源已存在");
  }
  data.feeds.push(feed);
  persist(data);
  return { ...data };
}

export function removeFeed(data: PluginData, feedID: string): PluginData {
  data.feeds = data.feeds.filter((f) => f.id !== feedID);
  data.articles = data.articles.filter((a) => a.feedID !== feedID);
  persist(data);
  return { ...data };
}

export function addArticles(
  data: PluginData,
  feedID: string,
  articles: Article[]
): PluginData {
  const existing = new Set(
    data.articles
      .filter((a) => a.feedID === feedID)
      .map((a) => a.link)
  );
  const newArticles = articles.filter((a) => !existing.has(a.link));
  data.articles.push(...newArticles);
  persist(data);
  return { ...data };
}

export function markRead(
  data: PluginData,
  articleID: string
): PluginData {
  const article = data.articles.find((a) => a.id === articleID);
  if (article) article.read = true;
  persist(data);
  return { ...data };
}

export function markAllRead(
  data: PluginData,
  feedID: string
): PluginData {
  data.articles
    .filter((a) => a.feedID === feedID)
    .forEach((a) => (a.read = true));
  persist(data);
  return { ...data };
}

export function updateFeedDocID(
  data: PluginData,
  feedID: string,
  docID: string
): PluginData {
  const feed = data.feeds.find((f) => f.id === feedID);
  if (feed) {
    feed.docID = docID;
    feed.lastFetchTime = new Date().toISOString();
  }
  persist(data);
  return { ...data };
}

export function getFeedArticles(
  data: PluginData,
  feedID: string
): Article[] {
  return data.articles
    .filter((a) => a.feedID === feedID)
    .sort(
      (a, b) =>
        new Date(b.published || b.id).getTime() -
        new Date(a.published || a.id).getTime()
    );
}

export function getUnreadCount(data: PluginData): number {
  return data.articles.filter((a) => !a.read).length;
}

export function getFeedUnreadCount(
  data: PluginData,
  feedID: string
): number {
  return data.articles.filter((a) => a.feedID === feedID && !a.read).length;
}

export function addFolder(data: PluginData, name: string, parentID: string | null = null): PluginData {
  const folder: FeedFolder = {
    id: `folder-${Date.now()}`,
    name,
    parentID,
  };
  data.folders.push(folder);
  persist(data);
  return { ...data };
}

export function removeFolder(data: PluginData, folderID: string): PluginData {
  data.folders = data.folders.filter((f) => f.id !== folderID);
  data.feeds.forEach((f) => {
    if (f.folderID === folderID) f.folderID = null;
  });
  persist(data);
  return { ...data };
}

export function renameFolder(data: PluginData, folderID: string, name: string): PluginData {
  const folder = data.folders.find((f) => f.id === folderID);
  if (folder) folder.name = name;
  persist(data);
  return { ...data };
}

export function moveFeedToFolder(data: PluginData, feedID: string, folderID: string | null): PluginData {
  const feed = data.feeds.find((f) => f.id === feedID);
  if (feed) feed.folderID = folderID;
  persist(data);
  return { ...data };
}

export function getRootFolders(data: PluginData): FeedFolder[] {
  return data.folders.filter((f) => !f.parentID);
}

export function getChildFolders(data: PluginData, parentID: string): FeedFolder[] {
  return data.folders.filter((f) => f.parentID === parentID);
}

export function getFolderFeeds(data: PluginData, folderID: string | null): Feed[] {
  return data.feeds.filter((f) => f.folderID === folderID);
}
