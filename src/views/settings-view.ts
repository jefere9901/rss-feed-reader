import type { PluginData, Notebook, FeedFolder } from "../types";
import * as store from "../store";
import * as api from "../api";
import { fetchFeed, discoverFeed, parseOPML, generateOPML } from "../rss-parser";

export class SettingsView {
  private container: HTMLElement;
  private data: PluginData;
  private notebooks: Notebook[] = [];
  private onDataChange: (data: PluginData) => void;
  private showAddForm = false;
  private showFolderForm = false;
  private editingFolder: FeedFolder | null = null;
  private feedMgmtCollapsed = false;
  private generalCollapsed = false;
  private collapsedFolders: Set<string> = new Set();

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

  async render(): Promise<void> {
    try {
      this.notebooks = await api.lsNotebooks();
    } catch {
      this.notebooks = [];
    }

    this.container.innerHTML = "";
    this.renderFeedManagement();
    this.renderActionsBar();
    this.renderGeneralSettings();
  }

  private renderFeedManagement(): void {
    const section = document.createElement("div");
    section.className = "rss-settings-section";

    const title = document.createElement("div");
    title.className = "rss-settings-section-title rss-settings-collapse-header";
    title.innerHTML = `<span class="rss-settings-arrow">${this.feedMgmtCollapsed ? "▶" : "▼"}</span> ${this.data.feeds.length} 个订阅`;
    title.addEventListener("click", () => {
      this.feedMgmtCollapsed = !this.feedMgmtCollapsed;
      this.render();
    });
    section.appendChild(title);

    const body = document.createElement("div");
    body.className = `rss-settings-collapse-body${this.feedMgmtCollapsed ? " collapsed" : ""}`;

    const card = document.createElement("div");
    card.className = "rss-settings-card";

    const rootFolders = store.getRootFolders(this.data);
    const hasContent = rootFolders.length > 0 || this.data.feeds.length > 0;

    if (!hasContent) {
      const empty = document.createElement("div");
      empty.style.cssText =
        "padding: 24px; text-align: center; color: var(--rss-text-muted); font-size: 13px;";
      empty.textContent = "暂无订阅，点击下方按钮添加";
      card.appendChild(empty);
    } else {
      rootFolders.forEach((folder) => {
        card.appendChild(this.createFolderGroupItem(folder));
      });
      const ungroupedFeeds = store.getFolderFeeds(this.data, null);
      if (ungroupedFeeds.length > 0) {
        if (rootFolders.length > 0) {
          const divider = document.createElement("div");
          divider.className = "rss-settings-subtitle";
          divider.textContent = "📂 未分类";
          card.appendChild(divider);
        }
        ungroupedFeeds.forEach((feed) => {
          card.appendChild(this.createFeedManageItem(feed, null));
        });
      }
    }

    body.appendChild(card);
    section.appendChild(body);

    if (this.showFolderForm) {
      section.appendChild(this.createFolderForm());
    }

    if (this.showAddForm) {
      section.appendChild(this.createAddForm());
    }

    this.container.appendChild(section);
  }

  private createFolderGroupItem(folder: FeedFolder): HTMLElement {
    const isCollapsed = this.collapsedFolders.has(folder.id);
    const folderFeeds = store.getFolderFeeds(this.data, folder.id);
    const container = document.createElement("div");

    // Header row — always visible, clickable to toggle
    const header = document.createElement("div");
    header.className = "rss-folder-manage-item rss-folder-group-header";
    header.style.cursor = "pointer";
    header.innerHTML = `
      <span class="rss-folder-group-arrow">${isCollapsed ? "▶" : "▼"}</span>
      <span class="rss-folder-manage-name">📁 ${folder.name}</span>
      <span class="rss-folder-manage-count">${folderFeeds.length}</span>
    `;

    const delBtn = document.createElement("button");
    delBtn.className = "rss-feed-manage-delete";
    delBtn.textContent = "✕";
    delBtn.title = "删除文件夹（订阅移至未分类）";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm(`确定删除文件夹「${folder.name}」？文件夹内的订阅将移至未分类。`)) {
        this.data = store.removeFolder(this.data, folder.id);
        this.onDataChange(this.data);
        this.render();
      }
    });
    header.appendChild(delBtn);

    // Rename on long-click / double-click
    const nameSpan = header.querySelector(".rss-folder-manage-name") as HTMLElement;
    nameSpan.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      const newName = prompt("重命名文件夹：", folder.name);
      if (newName && newName.trim() && newName.trim() !== folder.name) {
        this.data = store.renameFolder(this.data, folder.id, newName.trim());
        this.onDataChange(this.data);
        this.render();
      }
    });

    header.addEventListener("click", () => {
      if (this.collapsedFolders.has(folder.id)) {
        this.collapsedFolders.delete(folder.id);
      } else {
        this.collapsedFolders.add(folder.id);
      }
      this.render();
    });

    container.appendChild(header);

    // Children body
    const children = document.createElement("div");
    children.className = `rss-folder-group-children${isCollapsed ? " collapsed" : ""}`;
    folderFeeds.forEach((feed) => {
      children.appendChild(this.createFeedManageItem(feed, folder));
    });
    container.appendChild(children);

    return container;
  }

  private createFeedManageItem(feed: any, folder: FeedFolder | null): HTMLElement {
    const isNested = folder !== null;
    const item = document.createElement("div");
    item.className = "rss-feed-manage-item";
    if (isNested) item.style.paddingLeft = "36px";

    const moveSelect = document.createElement("select");
    moveSelect.className = "rss-feed-move-select";
    moveSelect.style.marginRight = "8px";
    moveSelect.style.fontSize = "11px";
    moveSelect.style.padding = "2px 4px";
    moveSelect.style.border = "1px solid var(--rss-border)";
    moveSelect.style.borderRadius = "4px";
    moveSelect.style.background = "var(--rss-bg)";
    moveSelect.style.color = "var(--rss-text-secondary)";

    const optNone = document.createElement("option");
    optNone.value = "";
    optNone.textContent = "未分类";
    if (!folder) optNone.selected = true;
    moveSelect.appendChild(optNone);

    store.getRootFolders(this.data).forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f.id;
      opt.textContent = f.name;
      if (folder && f.id === folder.id) opt.selected = true;
      moveSelect.appendChild(opt);
    });

    moveSelect.addEventListener("change", () => {
      const targetFolder = moveSelect.value || null;
      this.data = store.moveFeedToFolder(this.data, feed.id, targetFolder);
      this.onDataChange(this.data);
      this.render();
    });

    const nameSpan = document.createElement("span");
    nameSpan.className = "rss-feed-manage-name";
    nameSpan.textContent = feed.name;

    const status = document.createElement("span");
    status.className = "rss-feed-manage-status";
    status.textContent = "●";

    const delBtn = document.createElement("button");
    delBtn.className = "rss-feed-manage-delete";
    delBtn.textContent = "✕";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.data = store.removeFeed(this.data, feed.id);
      this.onDataChange(this.data);
      this.render();
    });

    item.appendChild(moveSelect);
    item.appendChild(nameSpan);
    item.appendChild(status);
    item.appendChild(delBtn);
    return item;
  }

  private createFolderForm(): HTMLElement {
    const form = document.createElement("div");
    form.className = "rss-add-form";

    form.innerHTML = `
      <input
        class="rss-add-form-input"
        type="text"
        placeholder="输入文件夹名称..."
        id="rss-folder-name-input"
      />
      <div class="rss-add-form-actions">
        <button class="rss-btn rss-btn-secondary" id="rss-folder-cancel">取消</button>
        <button class="rss-btn rss-btn-primary" id="rss-folder-confirm">创建</button>
      </div>
    `;

    const input = form.querySelector("#rss-folder-name-input") as HTMLInputElement;
    const confirmBtn = form.querySelector("#rss-folder-confirm") as HTMLButtonElement;
    const cancelBtn = form.querySelector("#rss-folder-cancel") as HTMLButtonElement;

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") confirmBtn.click();
    });

    confirmBtn.addEventListener("click", () => {
      const name = input.value.trim();
      if (name) {
        this.data = store.addFolder(this.data, name);
        this.showFolderForm = false;
        this.onDataChange(this.data);
        this.render();
        api.pushMsg(`📁 已创建文件夹：${name}`);
      }
    });

    cancelBtn.addEventListener("click", () => {
      this.showFolderForm = false;
      this.render();
    });

    setTimeout(() => input.focus(), 50);
    return form;
  }

  private handleOPMLImport(): void {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".opml,.xml";
    fileInput.style.display = "none";

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const outlines = parseOPML(text);

        if (outlines.length === 0) {
          api.pushErrMsg("OPML 文件中没有找到订阅源");
          return;
        }

        let feedCount = 0;

        const processOutlines = async (items: any[], parentFolder: string | null) => {
          for (const item of items) {
            if (item.xmlUrl) {
              try {
                const feedID = `feed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                const newFeed = {
                  id: feedID,
                  folderID: parentFolder,
                  name: store.cleanFeedName(item.text, item.title, item.xmlUrl),
                  url: item.xmlUrl,
                  icon: "📡",
                  lastFetchTime: "",
                  docID: "",
                  articleIDs: [],
                };
                this.data = store.addFeed(this.data, newFeed);
                feedCount++;

                try {
                  const parsed = await fetchFeed(item.xmlUrl);
                  if (parsed.articles.length > 0) {
                    const articles = parsed.articles.map((a) => ({
                      id: `article-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                      feedID,
                      title: a.title,
                      link: a.link,
                      summary: a.summary,
                      content: a.content,
                      published: a.published,
                      author: a.author,
                      read: false,
                    }));
                    this.data = store.addArticles(this.data, feedID, articles);
                  }
                } catch {}
              } catch {}
            }

            if (item.children && item.children.length > 0) {
              let folderID: string | null = null;
              if (item.text || item.title) {
                folderID = `folder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                this.data.folders.push({
                  id: folderID,
                  name: item.text || item.title || "未命名",
                  parentID: parentFolder,
                });
              }
              await processOutlines(item.children, folderID || parentFolder);
            }
          }
        };

        await processOutlines(outlines, null);

        if (feedCount > 0) {
          this.onDataChange(this.data);
          this.render();
          api.pushMsg(`✅ 成功导入 ${feedCount} 个订阅源`);
        } else {
          api.pushErrMsg("未能从 OPML 文件中解析出有效订阅");
        }
      } catch (err: any) {
        api.pushErrMsg(`OPML 导入失败：${err.message || "文件格式错误"}`);
      }
    });

    document.body.appendChild(fileInput);
    fileInput.click();
    setTimeout(() => {
      if (fileInput.parentNode) fileInput.parentNode.removeChild(fileInput);
    }, 1000);
  }

  private handleOPMLExport(): void {
    const feeds = this.data.feeds;
    if (feeds.length === 0) {
      api.pushErrMsg("暂无订阅源可导出");
      return;
    }

    const opml = generateOPML({
      folders: this.data.folders,
      feeds: feeds.map((f) => ({ folderID: f.folderID, name: f.name, url: f.url })),
    });

    const blob = new Blob([opml], { type: "text/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rss-subscriptions.opml";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    api.pushMsg(`📤 已导出 ${feeds.length} 个订阅源到 OPML 文件`);
  }

  private createAddForm(): HTMLElement {
    const form = document.createElement("div");
    form.className = "rss-add-form";

    form.innerHTML = `
      <input
        class="rss-add-form-input"
        type="text"
        placeholder="输入 RSS Feed URL..."
        id="rss-url-input"
      />
      <div style="margin-top:8px;display:flex;align-items:center;gap:8px;">
        <label style="font-size:12px;color:var(--rss-text-secondary);white-space:nowrap;">分类：</label>
        <select id="rss-folder-select" class="rss-select" style="flex:1;"></select>
      </div>
      <div id="rss-add-feedback"></div>
      <div class="rss-add-form-actions">
        <button class="rss-btn rss-btn-secondary" id="rss-add-cancel">取消</button>
        <button class="rss-btn rss-btn-primary" id="rss-add-detect">检测并添加</button>
      </div>
    `;

    const input = form.querySelector("#rss-url-input") as HTMLInputElement;
    const folderSelect = form.querySelector("#rss-folder-select") as HTMLSelectElement;
    const feedback = form.querySelector("#rss-add-feedback") as HTMLElement;
    const detectBtn = form.querySelector("#rss-add-detect") as HTMLButtonElement;
    const cancelBtn = form.querySelector("#rss-add-cancel") as HTMLButtonElement;

    const noneOpt = document.createElement("option");
    noneOpt.value = "";
    noneOpt.textContent = "未分类";
    folderSelect.appendChild(noneOpt);

    store.getRootFolders(this.data).forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f.id;
      opt.textContent = f.name;
      folderSelect.appendChild(opt);
    });

    detectBtn.addEventListener("click", async () => {
      const url = input.value.trim();
      if (!url) return;

      detectBtn.disabled = true;
      detectBtn.textContent = "检测中...";
      feedback.className = "rss-detect-result";

      try {
        let feedUrl = url;
        let feedName = "";

        try {
          const feeds = await discoverFeed(url);
          if (feeds.length > 0) {
            feedUrl = feeds[0].url;
            feedName = feeds[0].title;
          }
        } catch {}

        const parsed = await fetchFeed(feedUrl);
        feedName = store.cleanFeedName(feedName, parsed.title, feedUrl);

        feedback.className = "rss-detect-result rss-detect-success";
        feedback.innerHTML = `
          ✅ 检测成功<br/>
          标题：${feedName}<br/>
          条目：${parsed.articles.length} 篇
        `;

        const feedID = `feed-${Date.now()}`;
        const folderID = folderSelect.value || null;
        const newFeed = {
          id: feedID,
          folderID,
          name: feedName,
          url: feedUrl,
          icon: parsed.icon || "📡",
          lastFetchTime: "",
          docID: "",
          articleIDs: [],
        };

        this.data = store.addFeed(this.data, newFeed);

        if (parsed.articles.length > 0) {
          const articles = parsed.articles.map((a) => ({
            id: `article-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            feedID,
            title: a.title,
            link: a.link,
            summary: a.summary,
            content: a.content,
            published: a.published,
            author: a.author,
            read: false,
          }));
          this.data = store.addArticles(this.data, feedID, articles);
        }

        this.showAddForm = false;
        this.onDataChange(this.data);
        this.render();

        api.pushMsg(`✅ 已添加订阅：${feedName} (${parsed.articles.length} 篇)`);
      } catch (err: any) {
        feedback.className = "rss-detect-result rss-detect-error";
        feedback.textContent = `❌ 检测失败：${err.message || "无法解析该地址"}`;
      } finally {
        detectBtn.disabled = false;
        detectBtn.textContent = "检测并添加";
      }
    });

    cancelBtn.addEventListener("click", () => {
      this.showAddForm = false;
      this.render();
    });

    return form;
  }

  private renderActionsBar(): void {
    const actions = document.createElement("div");
    actions.className = "rss-settings-actions";

    const opmlBtn = document.createElement("button");
    opmlBtn.className = "rss-add-btn";
    opmlBtn.innerHTML = "📂 导入 OPML";
    opmlBtn.addEventListener("click", () => this.handleOPMLImport());
    actions.appendChild(opmlBtn);

    const exportBtn = document.createElement("button");
    exportBtn.className = "rss-add-btn";
    exportBtn.innerHTML = "📤 导出 OPML";
    exportBtn.addEventListener("click", () => this.handleOPMLExport());
    actions.appendChild(exportBtn);

    const folderBtn = document.createElement("button");
    folderBtn.className = "rss-add-btn";
    folderBtn.innerHTML = "📁 新建文件夹";
    folderBtn.addEventListener("click", () => {
      this.showFolderForm = !this.showFolderForm;
      this.showAddForm = false;
      this.editingFolder = null;
      this.render();
    });
    actions.appendChild(folderBtn);

    const addBtn = document.createElement("button");
    addBtn.className = "rss-add-btn";
    addBtn.innerHTML = "＋ 添加订阅";
    addBtn.addEventListener("click", () => {
      this.showAddForm = !this.showAddForm;
      this.showFolderForm = false;
      this.render();
    });
    actions.appendChild(addBtn);

    this.container.appendChild(actions);
  }

  private renderGeneralSettings(): void {
    const section = document.createElement("div");
    section.className = "rss-settings-section";

    const title = document.createElement("div");
    title.className = "rss-settings-section-title rss-settings-collapse-header";
    title.innerHTML = `<span class="rss-settings-arrow">${this.generalCollapsed ? "▶" : "▼"}</span> 通用设置`;
    title.addEventListener("click", () => {
      this.generalCollapsed = !this.generalCollapsed;
      this.render();
    });
    section.appendChild(title);

    const body = document.createElement("div");
    body.className = `rss-settings-collapse-body${this.generalCollapsed ? " collapsed" : ""}`;

    const card = document.createElement("div");
    card.className = "rss-settings-card";

    card.appendChild(this.createNotebookSetting());
    card.appendChild(this.createPositionSetting());
    card.appendChild(this.createRefreshIntervalSetting());
    card.appendChild(this.createResetSetting());

    body.appendChild(card);
    section.appendChild(body);
    this.container.appendChild(section);
  }

  private createNotebookSetting(): HTMLElement {
    const row = document.createElement("div");
    row.className = "rss-setting-row";

    const labelDiv = document.createElement("div");
    labelDiv.innerHTML = `
      <div class="rss-setting-label">目标笔记本</div>
      <div class="rss-setting-desc">文章将保存到该笔记本</div>
    `;
    row.appendChild(labelDiv);

    const select = document.createElement("select");
    select.className = "rss-select";

    const currentID = this.data.settings.targetNotebook;

    if (this.notebooks.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "请先打开思源";
      select.appendChild(opt);
      select.disabled = true;
    } else {
      const defaultOpt = document.createElement("option");
      defaultOpt.value = "";
      defaultOpt.textContent = "自动创建「RSS 订阅」笔记本";
      select.appendChild(defaultOpt);

      this.notebooks.forEach((nb) => {
        const opt = document.createElement("option");
        opt.value = nb.id;
        opt.textContent = nb.name;
        if (nb.id === currentID) opt.selected = true;
        select.appendChild(opt);
      });
    }

    select.addEventListener("change", async () => {
      const val = select.value;
      if (val) {
        this.data = store.saveSettings(this.data, {
          targetNotebook: val,
          targetNotebookName:
            this.notebooks.find((n) => n.id === val)?.name || "",
        });
      } else {
        try {
          const nb = await api.createNotebook("RSS 订阅");
          this.data = store.saveSettings(this.data, {
            targetNotebook: nb.id,
            targetNotebookName: nb.name,
          });
          this.render();
        } catch (err: any) {
          api.pushErrMsg(`创建笔记本失败：${err.message}`);
        }
      }
      this.onDataChange(this.data);
    });

    row.appendChild(select);
    return row;
  }

  private createPositionSetting(): HTMLElement {
    const row = document.createElement("div");
    row.className = "rss-setting-row";

    const labelDiv = document.createElement("div");
    labelDiv.innerHTML = `
      <div class="rss-setting-label">新文章位置</div>
      <div class="rss-setting-desc">插入到文档的顶部或底部</div>
    `;
    row.appendChild(labelDiv);

    const group = document.createElement("div");
    group.className = "rss-pill-group";

    const topPill = document.createElement("button");
    topPill.className = `rss-pill ${this.data.settings.newArticlePosition === "top" ? "active" : ""}`;
    topPill.textContent = "顶部";
    topPill.addEventListener("click", () => {
      this.data = store.saveSettings(this.data, { newArticlePosition: "top" });
      this.onDataChange(this.data);
      this.render();
    });

    const bottomPill = document.createElement("button");
    bottomPill.className = `rss-pill ${this.data.settings.newArticlePosition === "bottom" ? "active" : ""}`;
    bottomPill.textContent = "底部";
    bottomPill.addEventListener("click", () => {
      this.data = store.saveSettings(this.data, { newArticlePosition: "bottom" });
      this.onDataChange(this.data);
      this.render();
    });

    group.appendChild(topPill);
    group.appendChild(bottomPill);
    row.appendChild(group);
    return row;
  }

  private createRefreshIntervalSetting(): HTMLElement {
    const row = document.createElement("div");
    row.className = "rss-setting-row";

    const labelDiv = document.createElement("div");
    labelDiv.innerHTML = `
      <div class="rss-setting-label">自动刷新</div>
      <div class="rss-setting-desc">定时自动检查更新</div>
    `;
    row.appendChild(labelDiv);

    const group = document.createElement("div");
    group.className = "rss-pill-group";

    const options = [
      { label: "关闭", value: 0 },
      { label: "15分钟", value: 15 },
      { label: "30分钟", value: 30 },
      { label: "1小时", value: 60 },
    ];

    options.forEach((opt) => {
      const pill = document.createElement("button");
      pill.className = `rss-pill ${this.data.settings.autoRefreshMinutes === opt.value ? "active" : ""}`;
      pill.textContent = opt.label;
      pill.addEventListener("click", () => {
        this.data = store.saveSettings(this.data, {
          autoRefreshMinutes: opt.value,
        });
        this.onDataChange(this.data);
        this.render();
      });
      group.appendChild(pill);
    });

    row.appendChild(group);
    return row;
  }

  private createResetSetting(): HTMLElement {
    const row = document.createElement("div");
    row.className = "rss-setting-row";
    row.style.borderTop = "1px solid var(--rss-border)";
    row.style.paddingTop = "10px";

    const labelDiv = document.createElement("div");
    labelDiv.innerHTML = `
      <div class="rss-setting-label" style="color:#ef4444;">重置数据</div>
      <div class="rss-setting-desc">清除所有订阅源、文章和文件夹</div>
    `;
    row.appendChild(labelDiv);

    const btn = document.createElement("button");
    btn.className = "rss-reset-btn";
    btn.textContent = "🔄 清除全部";
    btn.addEventListener("click", () => {
      if (confirm("确定要清除所有订阅数据吗？此操作不可撤销！")) {
        this.data = store.resetAll(this.data);
        this.onDataChange(this.data);
        this.render();
        api.pushMsg("🔄 已清除所有订阅数据");
      }
    });

    row.appendChild(btn);
    return row;
  }
}
