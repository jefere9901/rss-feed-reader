import type { PluginData, Feed, Article, FeedFolder } from "../types";
import * as store from "../store";
import * as api from "../api";
import { fetchFeed, articleToSummary } from "../rss-parser";
import { ReaderView } from "./reader-view";

export class FeedView {
  private container: HTMLElement;
  private data: PluginData;
  private onDataChange: (data: PluginData) => void;
  private expandedFeed: string | null = null;
  private expandedFolders: Set<string> = new Set();

  constructor(
    container: HTMLElement,
    data: PluginData,
    onDataChange: (data: PluginData) => void
  ) {
    this.container = container;
    this.data = data;
    this.onDataChange = onDataChange;
  }

  updateData(data: PluginData): void {
    this.data = data;
  }

  render(): void {
    this.container.innerHTML = "";
    this.container.appendChild(this.createRefreshBar());

    if (this.data.feeds.length === 0) {
      this.container.appendChild(this.createEmptyState());
      return;
    }

    const rootFolders = store.getRootFolders(this.data);
    const ungroupedFeeds = store.getFolderFeeds(this.data, null);

    rootFolders.forEach((folder) => {
      this.container.appendChild(this.createFolderGroup(folder));
    });

    if (ungroupedFeeds.length > 0) {
      if (rootFolders.length > 0) {
        const divider = document.createElement("div");
        divider.className = "rss-folder-divider";
        divider.textContent = "未分类";
        this.container.appendChild(divider);
      }
      ungroupedFeeds.forEach((feed) => {
        this.container.appendChild(this.createFeedGroup(feed));
      });
    }
  }

  private createRefreshBar(): HTMLElement {
    const bar = document.createElement("div");
    bar.className = "rss-refresh-bar";

    const unread = store.getUnreadCount(this.data);

    bar.innerHTML = `
      <div class="rss-refresh-icon">↻</div>
      <div class="rss-refresh-info">
        <div class="rss-refresh-label">全部刷新</div>
        <div class="rss-refresh-sub">${this.data.feeds.length} 个订阅源</div>
      </div>
      ${unread > 0 ? `<span class="rss-refresh-count">${unread} 篇未读</span>` : ""}
    `;

    bar.addEventListener("click", () => this.handleRefresh(bar));
    return bar;
  }

  private async handleRefresh(bar: HTMLElement): Promise<void> {
    if (bar.classList.contains("loading")) return;
    bar.classList.add("loading");

    let total = 0;
    for (const feed of this.data.feeds) {
      try {
        const parsed = await fetchFeed(feed.url);
        const existing = store.getFeedArticles(this.data, feed.id);
        const existingLinks = new Set(existing.map((a) => a.link));

        const newArts: Article[] = parsed.articles
          .filter((a) => !existingLinks.has(a.link))
          .map((a) => ({
            id: `article-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            feedID: feed.id,
            title: a.title || "(无标题)",
            link: a.link,
            summary: a.summary,
            content: a.content,
            published: a.published,
            read: false,
          }));

        for (const art of newArts.reverse()) {
          try {
            if (!feed.docID) {
              const docID = await api.createDocWithMd(
                this.data.settings.targetNotebook,
                `/${feed.name}/`,
                `# ${feed.name}\n`
              );
              this.data = store.updateFeedDocID(this.data, feed.id, docID);
            }

            const md = articleToSummary(art);
            if (this.data.settings.newArticlePosition === "top") {
              await api.prependBlock(feed.docID, md);
            } else {
              await api.appendBlock(feed.docID, md);
            }
          } catch {}
        }

        this.data = store.addArticles(this.data, feed.id, newArts);
        total += newArts.length;
      } catch {}
    }

    bar.classList.remove("loading");
    if (total > 0) {
      api.pushMsg(`✅ 更新完成，新增 ${total} 篇文章`);
    } else {
      api.pushMsg("✅ 已是最新，没有新文章");
    }

    this.onDataChange(this.data);
  }

  private createEmptyState(): HTMLElement {
    const el = document.createElement("div");
    el.className = "rss-empty";
    el.innerHTML = `
      <div class="rss-empty-icon">📡</div>
      <div class="rss-empty-text">还没有订阅源</div>
      <div class="rss-empty-sub">切换到「设置」Tab 添加你的第一个 RSS 订阅</div>
    `;
    return el;
  }

  private createFolderGroup(folder: FeedFolder): HTMLElement {
    const group = document.createElement("div");
    group.className = "rss-folder-group";
    if (this.expandedFolders.has(folder.id)) {
      group.classList.add("expanded");
    }

    const folderFeeds = store.getFolderFeeds(this.data, folder.id);
    let folderUnread = 0;
    folderFeeds.forEach((f) => {
      folderUnread += store.getFeedUnreadCount(this.data, f.id);
    });

    const header = document.createElement("div");
    header.className = "rss-folder-header";
    header.innerHTML = `
      <span class="rss-folder-arrow">▶</span>
      <span class="rss-folder-icon">📁</span>
      <span class="rss-folder-name">${folder.name}</span>
      <span class="rss-folder-count">${folderFeeds.length}</span>
      ${folderUnread > 0 ? `<span class="rss-folder-unread">${folderUnread}</span>` : ""}
    `;

    header.addEventListener("click", () => {
      group.classList.toggle("expanded");
      if (group.classList.contains("expanded")) {
        this.expandedFolders.add(folder.id);
      } else {
        this.expandedFolders.delete(folder.id);
      }
    });

    group.appendChild(header);

    const list = document.createElement("div");
    list.className = "rss-folder-children";

    folderFeeds.forEach((feed) => {
      list.appendChild(this.createFeedGroup(feed));
    });

    group.appendChild(list);
    return group;
  }

  private createFeedGroup(feed: Feed): HTMLElement {
    const group = document.createElement("div");
    group.className = "rss-feed-group";
    if (this.expandedFeed === feed.id) {
      group.classList.add("expanded");
    }

    const articles = store.getFeedArticles(this.data, feed.id);
    const unread = store.getFeedUnreadCount(this.data, feed.id);
    const displayIcon = feed.icon || "📡";

    const header = document.createElement("div");
    header.className = "rss-feed-header";

    const arrow = document.createElement("span");
    arrow.className = "rss-feed-arrow";
    arrow.textContent = "▶";

    const icon = document.createElement("span");
    icon.className = "rss-feed-icon";
    icon.textContent = displayIcon;

    const nameSpan = document.createElement("span");
    nameSpan.className = "rss-feed-name";
    nameSpan.textContent = feed.name;

    header.appendChild(arrow);
    header.appendChild(icon);
    header.appendChild(nameSpan);

    if (unread > 0) {
      const badge = document.createElement("span");
      badge.className = "rss-feed-unread";
      badge.textContent = String(unread);
      header.appendChild(badge);
    }

    header.addEventListener("click", () => {
      group.classList.toggle("expanded");
      this.expandedFeed = group.classList.contains("expanded") ? feed.id : null;
    });

    group.appendChild(header);

    const list = document.createElement("div");
    list.className = "rss-article-list";

    if (articles.length === 0) {
      const empty = document.createElement("div");
      empty.className = "rss-article-item";
      empty.style.paddingLeft = "36px";
      empty.style.color = "var(--rss-text-muted)";
      empty.style.fontSize = "12px";
      empty.textContent = "暂无文章";
      list.appendChild(empty);
    } else {
      articles.slice(0, 20).forEach((article) => {
        list.appendChild(this.createArticleItem(feed, article));
      });
    }

    group.appendChild(list);
    return group;
  }

  private createArticleItem(feed: Feed, article: Article): HTMLElement {
    const item = document.createElement("div");
    item.className = `rss-article-item ${article.read ? "read" : "unread"}`;

    const timeAgo = this.timeAgo(article.published);

    item.innerHTML = `
      <div class="rss-article-title">${article.title}</div>
      <div class="rss-article-meta">
        ${article.author ? `<span>${article.author}</span>` : ""}
        ${timeAgo ? `<span>${timeAgo}</span>` : ""}
        ${article.link ? `<span>${new URL(article.link).hostname}</span>` : ""}
      </div>
    `;

    item.addEventListener("click", () => {
      this.data = store.markRead(this.data, article.id);
      item.classList.remove("unread");
      item.classList.add("read");

      const reader = new ReaderView(article, this.data, (newData) => {
        this.data = newData;
        this.onDataChange(this.data);
      });
      reader.show();
    });

    return item;
  }

  private timeAgo(dateStr: string): string {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "";
      const now = Date.now();
      const diff = now - date.getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return "刚刚";
      if (mins < 60) return `${mins}分钟前`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}小时前`;
      const days = Math.floor(hours / 24);
      if (days < 7) return `${days}天前`;
      return date.toLocaleDateString("zh-CN");
    } catch {
      return "";
    }
  }
}
