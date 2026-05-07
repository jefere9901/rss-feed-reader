import type { PluginData, Feed, Article, FeedFolder } from "../types";
import * as store from "../store";
import * as api from "../api";
import { fetchFeed, articleToSummary } from "../rss-parser";
import { ReaderView } from "./reader-view";

const ARTICLES_PER_PAGE = 30;

export class FeedView {
  private container: HTMLElement;
  private data: PluginData;
  private onDataChange: (data: PluginData) => void;
  private expandedFeed: string | null = null;
  private expandedFolders: Set<string> = new Set();
  private feedArticlePages: Map<string, number> = new Map();

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

    const label = bar.querySelector(".rss-refresh-label") as HTMLElement;
    const sub = bar.querySelector(".rss-refresh-sub") as HTMLElement;
    const count = bar.querySelector(".rss-refresh-count") as HTMLElement;

    let total = 0;
    const feeds = this.data.feeds;
    for (let i = 0; i < feeds.length; i++) {
      const feed = feeds[i];
      try {
        // Update progress
        if (label) label.textContent = `正在刷新 (${i + 1}/${feeds.length})`;
        if (sub) sub.textContent = feed.name;

        const parsed = await fetchFeed(feed.url, this.data.settings.bypassPaywall);
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

      // Yield to event loop to keep UI responsive
      await new Promise((r) => setTimeout(r, 0));
    }

    bar.classList.remove("loading");
    if (label) label.textContent = "全部刷新";
    if (sub) sub.textContent = `${feeds.length} 个订阅源`;

    if (total > 0) {
      if (count) {
        const unread = store.getUnreadCount(this.data);
        count.textContent = `${unread} 篇未读`;
      }
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
    const isExpanded = this.expandedFeed === feed.id;
    if (isExpanded) {
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

    if (/^https?:\/\//i.test(displayIcon)) {
      const img = document.createElement("img");
      img.src = displayIcon;
      img.style.width = "18px";
      img.style.height = "18px";
      img.style.borderRadius = "4px";
      img.onerror = () => { icon.textContent = "📡"; };
      icon.appendChild(img);
    } else {
      icon.textContent = displayIcon;
    }

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
      const wasExpanded = group.classList.contains("expanded");
      if (wasExpanded) {
        group.classList.remove("expanded");
        this.expandedFeed = null;
        // Clear article DOM to free memory
        const list = group.querySelector(".rss-article-list") as HTMLElement;
        if (list) list.innerHTML = "";
        this.feedArticlePages.delete(feed.id);
      } else {
        // Close any other expanded feed
        if (this.expandedFeed) {
          const oldGroup = this.container.querySelector(".rss-feed-group.expanded");
          if (oldGroup) {
            oldGroup.classList.remove("expanded");
            const oldList = oldGroup.querySelector(".rss-article-list") as HTMLElement;
            if (oldList) oldList.innerHTML = "";
          }
        }
        group.classList.add("expanded");
        this.expandedFeed = feed.id;
        // Virtual scroll render
        this.renderArticlePage(group, feed, 0);
      }
    });

    group.appendChild(header);

    const list = document.createElement("div");
    list.className = "rss-article-list";
    if (isExpanded) {
      this.renderArticlePage(group, feed, 0);
    }

    group.appendChild(list);
    return group;
  }

  private renderArticlePage(group: HTMLElement, feed: Feed, page: number): void {
    const articles = store.getFeedArticles(this.data, feed.id);
    const list = group.querySelector(".rss-article-list") as HTMLElement;
    if (!list) return;

    const start = page * ARTICLES_PER_PAGE;
    const end = start + ARTICLES_PER_PAGE;
    const pageArticles = articles.slice(start, end);
    const hasMore = end < articles.length;

    // Clear previous render
    list.innerHTML = "";

    // Scrollable wrapper when paginated
    const needsScroll = hasMore || page > 0 || articles.length > ARTICLES_PER_PAGE;
    if (needsScroll) {
      list.classList.add("has-scroll");
      list.style.maxHeight = "420px";
      list.style.overflowY = "auto";
    } else {
      list.classList.remove("has-scroll");
      list.style.maxHeight = "none";
      list.style.overflowY = "visible";
    }

    if (articles.length === 0) {
      const empty = document.createElement("div");
      empty.className = "rss-article-item";
      empty.style.paddingLeft = "36px";
      empty.style.color = "var(--rss-text-muted)";
      empty.style.fontSize = "12px";
      empty.textContent = "暂无文章";
      list.appendChild(empty);
      return;
    }

    // Show count info
    if (page > 0 || hasMore) {
      const info = document.createElement("div");
      info.className = "rss-article-info";
      info.textContent = `第 ${start + 1}-${Math.min(end, articles.length)} 篇，共 ${articles.length} 篇`;
      list.appendChild(info);
    }

    // Render visible articles
    pageArticles.forEach((article) => {
      list.appendChild(this.createArticleItem(feed, article));
    });

    // "Load more" / pagination controls
    if (hasMore || page > 0) {
      const controls = document.createElement("div");
      controls.className = "rss-pagination";

      if (page > 0) {
        const prevBtn = document.createElement("button");
        prevBtn.className = "rss-pagination-btn";
        prevBtn.textContent = "◀ 上一页";
        prevBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.feedArticlePages.set(feed.id, page - 1);
          this.renderArticlePage(group, feed, page - 1);
          (list.parentElement as HTMLElement)?.scrollIntoView({ behavior: "smooth" });
        });
        controls.appendChild(prevBtn);
      }

      if (hasMore) {
        const nextBtn = document.createElement("button");
        nextBtn.className = "rss-pagination-btn";
        nextBtn.textContent = "下一页 ▶";
        nextBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.feedArticlePages.set(feed.id, page + 1);
          this.renderArticlePage(group, feed, page + 1);
          list.scrollTop = 0;
        });
        controls.appendChild(nextBtn);
      }

      list.appendChild(controls);
    }
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
