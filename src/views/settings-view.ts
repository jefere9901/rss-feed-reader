import type { PluginData, Notebook, FeedFolder } from "../types";
import * as store from "../store";
import * as api from "../api";
import { fetchFeed, discoverFeed, parseOPML, generateOPML } from "../rss-parser";
import { testConnection } from "../ai";

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
  private aiCollapsed = false;
  private aiModuleCollapsed: Record<string, boolean> = {};
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
    this.renderAISettings();
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
    nameSpan.title = "单击修改名称 / 双击修改链接";
    nameSpan.style.cursor = "pointer";

    const urlSpan = document.createElement("span");
    urlSpan.className = "rss-feed-manage-url";
    urlSpan.textContent = feed.url;
    urlSpan.style.fontSize = "10px";
    urlSpan.style.color = "var(--rss-text-muted)";
    urlSpan.style.marginLeft = "8px";
    urlSpan.style.overflow = "hidden";
    urlSpan.style.textOverflow = "ellipsis";
    urlSpan.style.whiteSpace = "nowrap";
    urlSpan.style.maxWidth = "200px";
    urlSpan.title = feed.url + "（双击修改）";
    urlSpan.style.cursor = "pointer";

    const status = document.createElement("span");
    status.className = "rss-feed-manage-status";
    status.style.marginLeft = "auto";
    status.style.marginRight = "8px";
    status.style.flexShrink = "0";
    const hasError = !!feed.lastFetchError;
    status.textContent = hasError ? "🔴" : "🟢";
    status.title = hasError ? `错误：${feed.lastFetchError}` : "正常";
    status.style.cursor = "default";

    const makeInlineEditor = (currentValue: string, onSave: (value: string) => void) => {
      const input = document.createElement("input");
      input.type = "text";
      input.value = currentValue;
      input.className = "rss-feed-manage-input";
      input.style.cssText = "font-size:13px;padding:2px 6px;border:1px solid var(--rss-primary);border-radius:4px;background:var(--rss-bg);color:var(--rss-text);outline:none;width:180px;";

      let save = () => {
        const val = input.value.trim();
        input.replaceWith(nameSpan);
        if (val && val !== currentValue) onSave(val);
      };

      input.addEventListener("blur", save);
      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") { ev.preventDefault(); save(); }
        if (ev.key === "Escape") { input.value = currentValue; input.blur(); }
      });

      nameSpan.replaceWith(input);
      input.focus();
      input.select();
    };

    const makeUrlEditor = (currentValue: string, onSave: (value: string) => void) => {
      const input = document.createElement("input");
      input.type = "text";
      input.value = currentValue;
      input.className = "rss-feed-manage-input";
      input.style.cssText = "font-size:10px;padding:2px 6px;border:1px solid var(--rss-primary);border-radius:4px;background:var(--rss-bg);color:var(--rss-text);outline:none;max-width:300px;flex:1;";

      let save = () => {
        const val = input.value.trim();
        input.replaceWith(urlSpan);
        if (val && val !== currentValue) {
          try {
            onSave(val);
          } catch (err: any) {
            api.pushErrMsg(err.message);
          }
        }
      };

      input.addEventListener("blur", save);
      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") { ev.preventDefault(); save(); }
        if (ev.key === "Escape") { input.value = currentValue; input.blur(); }
      });

      urlSpan.replaceWith(input);
      input.focus();
      input.select();
    };

    nameSpan.addEventListener("click", (e) => {
      e.stopPropagation();
      const currentFeed = this.data.feeds.find((f) => f.id === feed.id);
      if (!currentFeed) return;
      makeInlineEditor(currentFeed.name, (newName) => {
        this.data = store.renameFeed(this.data, feed.id, newName);
        this.onDataChange(this.data);
        this.render();
      });
    });

    urlSpan.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      const currentFeed = this.data.feeds.find((f) => f.id === feed.id);
      if (!currentFeed) return;
      makeUrlEditor(currentFeed.url, (newUrl) => {
        this.data = store.updateFeedUrl(this.data, feed.id, newUrl);
        this.onDataChange(this.data);
        this.render();
        api.pushMsg(`✅ 链接已更新：${newUrl}`);
      });
    });

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
    item.appendChild(urlSpan);
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
                  lastFetchError: "",
                  docID: "",
                  articleIDs: [],
                };
                this.data = store.addFeed(this.data, newFeed);
                feedCount++;

                try {
                  const parsed = await fetchFeed(item.xmlUrl, this.data.settings.bypassPaywall);

                  if (parsed.icon) {
                    this.data = store.setFeedIcon(this.data, feedID, parsed.icon);
                  }

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
          const feeds = await discoverFeed(url, this.data.settings.bypassPaywall);
          if (feeds.length > 0) {
            feedUrl = feeds[0].url;
            feedName = feeds[0].title;
          }
        } catch {}

        const parsed = await fetchFeed(feedUrl, this.data.settings.bypassPaywall);
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
          lastFetchError: "",
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
    card.appendChild(this.createBypassSetting());
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

  private createBypassSetting(): HTMLElement {
    const row = document.createElement("div");
    row.className = "rss-setting-row";

    const labelDiv = document.createElement("div");
    labelDiv.innerHTML = `
      <div class="rss-setting-label">反限制模式</div>
      <div class="rss-setting-desc">使用搜索引擎身份抓取，自动提取文章全文</div>
    `;
    row.appendChild(labelDiv);

    const toggle = document.createElement("div");
    toggle.className = `rss-toggle${this.data.settings.bypassPaywall ? " active" : ""}`;
    toggle.title = this.data.settings.bypassPaywall ? "已启用：全文提取 + 搜索引擎身份" : "已关闭：普通模式";
    toggle.addEventListener("click", () => {
      this.data = store.saveSettings(this.data, {
        bypassPaywall: !this.data.settings.bypassPaywall,
      });
      this.onDataChange(this.data);
      this.render();
    });
    row.appendChild(toggle);

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

  private renderAISettings(): void {
    const section = document.createElement("div");
    section.className = "rss-settings-section";

    const title = document.createElement("div");
    title.className = "rss-settings-section-title rss-settings-collapse-header";
    title.innerHTML = `<span class="rss-settings-arrow">${this.aiCollapsed ? "▶" : "▼"}</span> 🤖 AI 设置`;
    title.addEventListener("click", () => {
      this.aiCollapsed = !this.aiCollapsed;
      this.render();
    });
    section.appendChild(title);

    const body = document.createElement("div");
    body.className = `rss-settings-collapse-body${this.aiCollapsed ? " collapsed" : ""}`;

    const card = document.createElement("div");
    card.className = "rss-settings-card";

    const ai = this.data.aiSettings;

    const makeRow = (label: string, desc: string, right: HTMLElement) => {
      const row = document.createElement("div");
      row.className = "rss-setting-row";
      const ld = document.createElement("div");
      ld.innerHTML = `<div class="rss-setting-label">${label}</div><div class="rss-setting-desc">${desc}</div>`;
      row.appendChild(ld);
      row.appendChild(right);
      return row;
    };

    const makeToggle = (key: keyof typeof ai, onLabel = "已启用", offLabel = "已关闭") => {
      const t = document.createElement("div");
      t.className = `rss-toggle${ai[key] ? " active" : ""}`;
      t.title = ai[key] ? onLabel : offLabel;
      t.addEventListener("click", () => {
        this.data = store.saveAISettings(this.data, { [key]: !this.data.aiSettings[key] } as any);
        this.onDataChange(this.data);
        this.render();
      });
      return t;
    };

    const makeSelect = (key: keyof typeof ai, opts: { value: string; label: string }[]) => {
      const s = document.createElement("select");
      s.className = "rss-select";
      opts.forEach(o => {
        const opt = document.createElement("option");
        opt.value = o.value;
        opt.textContent = o.label;
        if (ai[key] === o.value) opt.selected = true;
        s.appendChild(opt);
      });
      s.addEventListener("change", () => {
        this.data = store.saveAISettings(this.data, { [key]: s.value } as any);
        this.onDataChange(this.data);
        this.render();
      });
      return s;
    };

    // API config
    const providerRow = document.createElement("div");
    providerRow.className = "rss-setting-row";
    const providerLabel = document.createElement("div");
    providerLabel.innerHTML = `<div class="rss-setting-label">API 提供商</div><div class="rss-setting-desc">选择 AI 服务</div>`;
    providerRow.appendChild(providerLabel);
    const providerSelect = makeSelect("provider", [
      { value: "deepseek", label: "DeepSeek（推荐）" },
      { value: "openai", label: "OpenAI" },
      { value: "custom", label: "自定义" },
    ]);
    providerRow.appendChild(providerSelect);
    card.appendChild(providerRow);

    const endpointRow = makeRow(
      "API 地址",
      "OpenAI 兼容接口地址",
      (() => {
        const inp = document.createElement("input");
        inp.type = "text";
        inp.value = ai.apiEndpoint;
        inp.className = "rss-add-form-input";
        inp.style.width = "260px";
        inp.style.fontSize = "11px";
        inp.addEventListener("change", () => {
          this.data = store.saveAISettings(this.data, { apiEndpoint: inp.value });
          this.onDataChange(this.data);
        });
        return inp;
      })()
    );
    card.appendChild(endpointRow);

    const modelRow = makeRow(
      "模型",
      "如 deepseek-chat、gpt-4o-mini",
      (() => {
        const inp = document.createElement("input");
        inp.type = "text";
        inp.value = ai.model;
        inp.className = "rss-add-form-input";
        inp.style.width = "160px";
        inp.style.fontSize = "11px";
        inp.addEventListener("change", () => {
          this.data = store.saveAISettings(this.data, { model: inp.value });
          this.onDataChange(this.data);
        });
        return inp;
      })()
    );
    card.appendChild(modelRow);

    const keyRow = makeRow(
      "API Key",
      "密钥存储在本地",
      (() => {
        const inp = document.createElement("input");
        inp.type = "password";
        inp.value = ai.apiKey;
        inp.className = "rss-add-form-input";
        inp.style.width = "200px";
        inp.style.fontSize = "11px";
        inp.addEventListener("change", () => {
          this.data = store.saveAISettings(this.data, { apiKey: inp.value });
          this.onDataChange(this.data);
        });
        return inp;
      })()
    );
    card.appendChild(keyRow);

    const testBtn = document.createElement("button");
    testBtn.className = "rss-btn rss-btn-secondary";
    testBtn.textContent = "🔍 测试连接";
    testBtn.style.cssText = "margin: 0 12px 12px; font-size: 12px; padding: 4px 12px;";
    testBtn.addEventListener("click", async () => {
      testBtn.textContent = "⏳ 测试中...";
      testBtn.disabled = true;
      try {
        const ok = await testConnection(this.data.aiSettings);
        if (ok) { testBtn.textContent = "✅ 连接成功"; api.pushMsg("✅ AI 连接测试通过"); }
        else { testBtn.textContent = "❌ 连接失败"; api.pushErrMsg("❌ AI 连接测试失败"); }
      } catch (e: any) {
        testBtn.textContent = "❌ 连接失败";
        api.pushErrMsg(`❌ ${e.message}`);
      }
      setTimeout(() => { testBtn.textContent = "🔍 测试连接"; testBtn.disabled = false; }, 3000);
    });
    card.appendChild(testBtn);

    const limitRow = makeRow(
      "每月上限",
      `本月已用 ${this.data.aiUsage.calls} 次 / ${this.data.aiUsage.tokens} tokens`,
      (() => {
        const inp = document.createElement("input");
        inp.type = "number";
        inp.value = String(ai.monthlyCallLimit);
        inp.className = "rss-add-form-input";
        inp.style.width = "80px";
        inp.style.fontSize = "11px";
        inp.addEventListener("change", () => {
          this.data = store.saveAISettings(this.data, { monthlyCallLimit: parseInt(inp.value) || 500 });
          this.onDataChange(this.data);
        });
        return inp;
      })()
    );
    card.appendChild(limitRow);

    const subDiv = document.createElement("div");
    subDiv.className = "rss-settings-subtitle";
    subDiv.textContent = "⚙️ 功能配置";
    subDiv.style.marginTop = "12px";
    card.appendChild(subDiv);

    const modules: {
      key: string;
      icon: string;
      name: string;
      desc: string;
      enabledKey: keyof typeof ai;
      body: () => HTMLElement;
    }[] = [
      {
        key: "summary",
        icon: "🤖",
        name: "AI 摘要",
        desc: "点击按钮生成文章摘要",
        enabledKey: "summaryEnabled",
        body: () => {
          const wrap = document.createElement("div");
          wrap.className = "rss-ai-module-body";

          const r1 = document.createElement("div");
          r1.className = "rss-setting-row";
          r1.innerHTML = `<div><div class="rss-setting-label">摘要长度</div><div class="rss-setting-desc">提取要点的详细程度</div></div>`;
          const pills = document.createElement("div");
          pills.className = "rss-pill-group";
          (["short","medium","long"] as const).forEach(v => {
            const b = document.createElement("button");
            b.className = `rss-pill${ai.summaryLength === v ? " active" : ""}`;
            b.textContent = { short: "简明", medium: "适中", long: "详细" }[v];
            b.addEventListener("click", () => {
              this.data = store.saveAISettings(this.data, { summaryLength: v } as any);
              this.onDataChange(this.data); this.render();
            });
            pills.appendChild(b);
          });
          r1.appendChild(pills);
          wrap.appendChild(r1);

          const r2 = document.createElement("div");
          r2.className = "rss-setting-row";
          r2.innerHTML = `<div><div class="rss-setting-label">输出语言</div><div class="rss-setting-desc">摘要使用的语言</div></div>`;
          const sel = document.createElement("select");
          sel.className = "rss-select";
          [
            { v: "zh", l: "中文" },
            { v: "original", l: "原文语言" },
            { v: "en", l: "英文" },
          ].forEach(o => {
            const opt = document.createElement("option");
            opt.value = o.v; opt.textContent = o.l;
            if (ai.summaryLang === o.v) opt.selected = true;
            sel.appendChild(opt);
          });
          sel.addEventListener("change", () => {
            this.data = store.saveAISettings(this.data, { summaryLang: sel.value } as any);
            this.onDataChange(this.data); this.render();
          });
          r2.appendChild(sel);
          wrap.appendChild(r2);

          const r3 = document.createElement("div");
          r3.className = "rss-setting-row";
          r3.style.flexDirection = "column";
          r3.style.alignItems = "stretch";
          r3.innerHTML = `<div><div class="rss-setting-label">自定义 Prompt 模板</div><div class="rss-setting-desc">留空则使用默认模板。支持 {title} {content} 占位符</div></div>`;
          const ta = document.createElement("textarea");
          ta.className = "rss-add-form-input";
          ta.value = ai.summaryPrompt;
          ta.placeholder = "留空使用默认模板...";
          ta.style.cssText = "width:100%;height:60px;font-size:11px;font-family:inherit;resize:vertical;margin-top:4px;";
          ta.addEventListener("change", () => {
            this.data = store.saveAISettings(this.data, { summaryPrompt: ta.value } as any);
            this.onDataChange(this.data);
          });
          r3.appendChild(ta);
          wrap.appendChild(r3);

          return wrap;
        },
      },
      {
        key: "translate",
        icon: "🌐",
        name: "AI 翻译",
        desc: "将外文文章翻译成目标语言",
        enabledKey: "translateEnabled",
        body: () => {
          const wrap = document.createElement("div");
          wrap.className = "rss-ai-module-body";

          const r1 = document.createElement("div");
          r1.className = "rss-setting-row";
          r1.innerHTML = `<div><div class="rss-setting-label">目标语言</div><div class="rss-setting-desc">翻译的目标语言</div></div>`;
          const inp = document.createElement("input");
          inp.type = "text";
          inp.value = ai.translateTargetLang;
          inp.className = "rss-add-form-input";
          inp.style.cssText = "width:120px;font-size:11px;";
          inp.addEventListener("change", () => {
            this.data = store.saveAISettings(this.data, { translateTargetLang: inp.value } as any);
            this.onDataChange(this.data); this.render();
          });
          r1.appendChild(inp);
          wrap.appendChild(r1);

          const r2 = document.createElement("div");
          r2.className = "rss-setting-row";
          r2.innerHTML = `<div><div class="rss-setting-label">翻译风格</div><div class="rss-setting-desc">直译/意译/学术</div></div>`;
          const pills2 = document.createElement("div");
          pills2.className = "rss-pill-group";
          (["literal","free","academic"] as const).forEach(v => {
            const b = document.createElement("button");
            b.className = `rss-pill${ai.translateStyle === v ? " active" : ""}`;
            b.textContent = { literal: "直译", free: "意译", academic: "学术" }[v];
            b.addEventListener("click", () => {
              this.data = store.saveAISettings(this.data, { translateStyle: v } as any);
              this.onDataChange(this.data); this.render();
            });
            pills2.appendChild(b);
          });
          r2.appendChild(pills2);
          wrap.appendChild(r2);

          const r3 = document.createElement("div");
          r3.className = "rss-setting-row";
          r3.innerHTML = `<div><div class="rss-setting-label">自动翻译</div><div class="rss-setting-desc">打开外文文章时自动翻译</div></div>`;
          const t = document.createElement("div");
          t.className = `rss-toggle${ai.autoTranslate ? " active" : ""}`;
          t.addEventListener("click", () => {
            this.data = store.saveAISettings(this.data, { autoTranslate: !ai.autoTranslate } as any);
            this.onDataChange(this.data); this.render();
          });
          r3.appendChild(t);
          wrap.appendChild(r3);

          return wrap;
        },
      },
      {
        key: "tagging",
        icon: "🏷️",
        name: "AI 智能标签",
        desc: "抓取时自动为文章打标签",
        enabledKey: "taggingEnabled",
        body: () => {
          const wrap = document.createElement("div");
          wrap.className = "rss-ai-module-body";

          const r1 = document.createElement("div");
          r1.className = "rss-setting-row";
          r1.innerHTML = `<div><div class="rss-setting-label">最多标签数</div><div class="rss-setting-desc">每篇文章生成的标签数量上限</div></div>`;
          const inp = document.createElement("input");
          inp.type = "number";
          inp.value = String(ai.taggingMaxTags);
          inp.className = "rss-add-form-input";
          inp.style.cssText = "width:60px;font-size:11px;";
          inp.min = "1"; inp.max = "10";
          inp.addEventListener("change", () => {
            this.data = store.saveAISettings(this.data, { taggingMaxTags: parseInt(inp.value) || 5 } as any);
            this.onDataChange(this.data);
          });
          r1.appendChild(inp);
          wrap.appendChild(r1);

          const r2 = document.createElement("div");
          r2.className = "rss-setting-row";
          r2.style.flexDirection = "column";
          r2.style.alignItems = "stretch";
          r2.innerHTML = `<div><div class="rss-setting-label">预设标签库</div><div class="rss-setting-desc">逗号分隔，AI 优先从中选择</div></div>`;
          const ta = document.createElement("textarea");
          ta.className = "rss-add-form-input";
          ta.value = ai.taggingPresetLabels.join(", ");
          ta.placeholder = "科技, 商业, 编程, 设计, 创业, AI";
          ta.style.cssText = "width:100%;height:48px;font-size:11px;font-family:inherit;resize:vertical;margin-top:4px;";
          ta.addEventListener("change", () => {
            const labels = ta.value.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean);
            this.data = store.saveAISettings(this.data, { taggingPresetLabels: labels } as any);
            this.onDataChange(this.data);
          });
          r2.appendChild(ta);
          wrap.appendChild(r2);

          const r3 = document.createElement("div");
          r3.className = "rss-setting-row";
          r3.innerHTML = `<div><div class="rss-setting-label">仅非中文文章</div><div class="rss-setting-desc">只对非中文内容打标签</div></div>`;
          const t = document.createElement("div");
          t.className = `rss-toggle${ai.tagOnlyNonChinese ? " active" : ""}`;
          t.addEventListener("click", () => {
            this.data = store.saveAISettings(this.data, { tagOnlyNonChinese: !ai.tagOnlyNonChinese } as any);
            this.onDataChange(this.data); this.render();
          });
          r3.appendChild(t);
          wrap.appendChild(r3);

          return wrap;
        },
      },
      {
        key: "digest",
        icon: "📰",
        name: "AI 日报",
        desc: "自动生成每日/每周阅读简报",
        enabledKey: "digestEnabled",
        body: () => {
          const wrap = document.createElement("div");
          wrap.className = "rss-ai-module-body";

          const r1 = document.createElement("div");
          r1.className = "rss-setting-row";
          r1.innerHTML = `<div><div class="rss-setting-label">频率</div><div class="rss-setting-desc">每天/每周生成一次</div></div>`;
          const pills = document.createElement("div");
          pills.className = "rss-pill-group";
          (["daily","weekly"] as const).forEach(v => {
            const b = document.createElement("button");
            b.className = `rss-pill${ai.digestFrequency === v ? " active" : ""}`;
            b.textContent = v === "daily" ? "每天" : "每周";
            b.addEventListener("click", () => {
              this.data = store.saveAISettings(this.data, { digestFrequency: v } as any);
              this.onDataChange(this.data); this.render();
            });
            pills.appendChild(b);
          });
          r1.appendChild(pills);
          wrap.appendChild(r1);

          const r2 = document.createElement("div");
          r2.className = "rss-setting-row";
          r2.innerHTML = `<div><div class="rss-setting-label">生成时间</div><div class="rss-setting-desc">每天几点执行（0-23）</div></div>`;
          const inp = document.createElement("input");
          inp.type = "number";
          inp.value = String(ai.digestHour);
          inp.className = "rss-add-form-input";
          inp.style.cssText = "width:60px;font-size:11px;";
          inp.min = "0"; inp.max = "23";
          inp.addEventListener("change", () => {
            this.data = store.saveAISettings(this.data, { digestHour: parseInt(inp.value) || 8 } as any);
            this.onDataChange(this.data);
          });
          r2.appendChild(inp);
          wrap.appendChild(r2);

          const r3 = document.createElement("div");
          r3.className = "rss-setting-row";
          r3.innerHTML = `<div><div class="rss-setting-label">精选篇数</div><div class="rss-setting-desc">日报中包含的文章数量</div></div>`;
          const inp2 = document.createElement("input");
          inp2.type = "number";
          inp2.value = String(ai.digestArticleCount);
          inp2.className = "rss-add-form-input";
          inp2.style.cssText = "width:60px;font-size:11px;";
          inp2.min = "3"; inp2.max = "50";
          inp2.addEventListener("change", () => {
            this.data = store.saveAISettings(this.data, { digestArticleCount: parseInt(inp2.value) || 10 } as any);
            this.onDataChange(this.data);
          });
          r3.appendChild(inp2);
          wrap.appendChild(r3);

          const r4 = document.createElement("div");
          r4.className = "rss-setting-row";
          r4.innerHTML = `<div><div class="rss-setting-label">输出路径</div><div class="rss-setting-desc">简报保存到哪个笔记本路径</div></div>`;
          const inp3 = document.createElement("input");
          inp3.type = "text";
          inp3.value = ai.digestNotebookPath;
          inp3.className = "rss-add-form-input";
          inp3.style.cssText = "width:140px;font-size:11px;";
          inp3.addEventListener("change", () => {
            this.data = store.saveAISettings(this.data, { digestNotebookPath: inp3.value } as any);
            this.onDataChange(this.data);
          });
          r4.appendChild(inp3);
          wrap.appendChild(r4);

          const r5 = document.createElement("div");
          r5.className = "rss-setting-row";
          r5.innerHTML = `<div><div class="rss-setting-label">包含原文链接</div><div class="rss-setting-desc">在日报中附带原文链接</div></div>`;
          const t = document.createElement("div");
          t.className = `rss-toggle${ai.digestIncludeLink ? " active" : ""}`;
          t.addEventListener("click", () => {
            this.data = store.saveAISettings(this.data, { digestIncludeLink: !ai.digestIncludeLink } as any);
            this.onDataChange(this.data); this.render();
          });
          r5.appendChild(t);
          wrap.appendChild(r5);

          return wrap;
        },
      },
      {
        key: "qa",
        icon: "💬",
        name: "AI 问答",
        desc: "基于文章内容的对话问答",
        enabledKey: "qaEnabled",
        body: () => {
          const wrap = document.createElement("div");
          wrap.className = "rss-ai-module-body";
          wrap.innerHTML = `<div class="rss-setting-desc" style="padding:4px 0;color:var(--rss-text-muted);">无额外配置，开启后阅读器底部显示问答输入框。</div>`;
          return wrap;
        },
      },
      {
        key: "filter",
        icon: "🔍",
        name: "AI 兴趣过滤",
        desc: "只显示感兴趣的文章",
        enabledKey: "filterEnabled",
        body: () => {
          const wrap = document.createElement("div");
          wrap.className = "rss-ai-module-body";

          const r1 = document.createElement("div");
          r1.className = "rss-setting-row";
          r1.style.flexDirection = "column";
          r1.style.alignItems = "stretch";
          r1.innerHTML = `<div><div class="rss-setting-label">兴趣关键词</div><div class="rss-setting-desc">逗号分隔，文章包含这些词则显示</div></div>`;
          const ta = document.createElement("textarea");
          ta.className = "rss-add-form-input";
          ta.value = ai.filterKeywords;
          ta.placeholder = "AI, 编程, 创业, 科技";
          ta.style.cssText = "width:100%;height:48px;font-size:11px;font-family:inherit;resize:vertical;margin-top:4px;";
          ta.addEventListener("change", () => {
            this.data = store.saveAISettings(this.data, { filterKeywords: ta.value } as any);
            this.onDataChange(this.data);
          });
          r1.appendChild(ta);
          wrap.appendChild(r1);

          const r2 = document.createElement("div");
          r2.className = "rss-setting-row";
          r2.style.flexDirection = "column";
          r2.style.alignItems = "stretch";
          r2.innerHTML = `<div><div class="rss-setting-label">排除关键词</div><div class="rss-setting-desc">逗号分隔，文章包含这些词则隐藏</div></div>`;
          const ta2 = document.createElement("textarea");
          ta2.className = "rss-add-form-input";
          ta2.value = ai.filterExcludeKeywords;
          ta2.placeholder = "体育, 娱乐, 八卦";
          ta2.style.cssText = "width:100%;height:48px;font-size:11px;font-family:inherit;resize:vertical;margin-top:4px;";
          ta2.addEventListener("change", () => {
            this.data = store.saveAISettings(this.data, { filterExcludeKeywords: ta2.value } as any);
            this.onDataChange(this.data);
          });
          r2.appendChild(ta2);
          wrap.appendChild(r2);

          const r3 = document.createElement("div");
          r3.className = "rss-setting-row";
          r3.innerHTML = `<div><div class="rss-setting-label">仅显示相关</div><div class="rss-setting-desc">开启后只展示过滤后的文章</div></div>`;
          const t = document.createElement("div");
          t.className = `rss-toggle${ai.filterShowOnlyRelevant ? " active" : ""}`;
          t.addEventListener("click", () => {
            this.data = store.saveAISettings(this.data, { filterShowOnlyRelevant: !ai.filterShowOnlyRelevant } as any);
            this.onDataChange(this.data); this.render();
          });
          r3.appendChild(t);
          wrap.appendChild(r3);

          return wrap;
        },
      },
    ];

    modules.forEach((mod) => {
      const isEnabled = !!(ai as any)[mod.enabledKey];
      const isOpen = !this.aiModuleCollapsed[mod.key];

      const modWrap = document.createElement("div");
      modWrap.className = "rss-ai-module";

      const header = document.createElement("div");
      header.className = "rss-ai-module-header";
      header.style.cursor = "pointer";
      header.innerHTML = `
        <span class="rss-ai-module-arrow">${isOpen ? "▼" : "▶"}</span>
        <span>${mod.icon} ${mod.name}</span>
        <span style="margin-left:8px;font-size:10px;color:var(--rss-text-muted);">${mod.desc}</span>
        <span style="flex:1"></span>
      `;

      const toggle = document.createElement("div");
      toggle.className = `rss-toggle${isEnabled ? " active" : ""}`;
      toggle.title = isEnabled ? `已启用：${mod.name}` : `已关闭：${mod.name}`;
      toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        this.data = store.saveAISettings(this.data, { [mod.enabledKey]: !isEnabled } as any);
        this.onDataChange(this.data);
        this.render();
      });
      header.appendChild(toggle);

      header.addEventListener("click", () => {
        this.aiModuleCollapsed[mod.key] = !this.aiModuleCollapsed[mod.key];
        this.render();
      });
      modWrap.appendChild(header);

      const bodyWrap = document.createElement("div");
      bodyWrap.className = `rss-ai-module-content${isOpen ? "" : " collapsed"}`;
      if (isEnabled && isOpen) {
        bodyWrap.appendChild(mod.body());
      }
      modWrap.appendChild(bodyWrap);

      card.appendChild(modWrap);
    });

    body.appendChild(card);
    section.appendChild(body);
    this.container.appendChild(section);
  }
}
