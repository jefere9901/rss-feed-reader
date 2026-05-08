import type { PluginData } from "../types";
import * as store from "../store";
import { FeedView } from "./feed-view";
import { SettingsView } from "./settings-view";

type Tab = "feed" | "settings";

export class DockWidget {
  public element: HTMLElement;
  private data: PluginData;
  private currentTab: Tab = "feed";
  private feedView!: FeedView;
  private settingsView!: SettingsView;
  private contentEl!: HTMLElement;
  private feedTabEl!: HTMLElement;
  private settingsTabEl!: HTMLElement;

  constructor(data: PluginData) {
    this.data = data;
    this.element = document.createElement("div");
    this.element.className = "rss-widget";
    this.syncTheme();
    this.build();
    this.switchTab("feed");

    this.observeThemeChange();
  }

  private syncTheme(): void {
    const html = document.documentElement;
    const isDark = html.getAttribute("data-theme-mode") === "dark"
      || html.getAttribute("data-theme") === "dark";
    if (isDark) {
      this.element.setAttribute("data-theme-mode", "dark");
    } else {
      this.element.removeAttribute("data-theme-mode");
    }
  }

  private observeThemeChange(): void {
    const observer = new MutationObserver(() => this.syncTheme());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme-mode", "data-theme"],
    });
  }

  updateData(data: PluginData): void {
    this.data = data;
    if (this.feedView) this.feedView.updateData(data);
    if (this.settingsView) this.settingsView.updateData(data);
    if (this.currentTab === "feed") {
      this.feedView.render();
    }
    this.updateTabBadges();
    this.updateBottomBar();
  }

  private build(): void {
    this.element.innerHTML = "";

    const header = document.createElement("div");
    header.className = "rss-header";
    header.innerHTML = `
      <div class="rss-title">
        <svg class="rss-title-svg" viewBox="0 0 32 32"><use href="#iconRSS"/></svg>
        RSS Feed
      </div>
    `;
    this.element.appendChild(header);

    const tabBar = document.createElement("div");
    tabBar.className = "rss-tab-bar";

    this.feedTabEl = document.createElement("button");
    this.feedTabEl.className = "rss-tab";
    this.feedTabEl.dataset.tab = "feed";
    this.feedTabEl.innerHTML = `📰 订阅<span class="rss-tab-badge" style="display:none">0</span>`;
    this.feedTabEl.addEventListener("click", () => this.switchTab("feed"));

    this.settingsTabEl = document.createElement("button");
    this.settingsTabEl.className = "rss-tab";
    this.settingsTabEl.dataset.tab = "settings";
    this.settingsTabEl.innerHTML = `⚙️ 设置`;
    this.settingsTabEl.addEventListener("click", () => this.switchTab("settings"));

    tabBar.appendChild(this.feedTabEl);
    tabBar.appendChild(this.settingsTabEl);
    this.element.appendChild(tabBar);

    this.contentEl = document.createElement("div");
    this.contentEl.className = "rss-content";
    this.element.appendChild(this.contentEl);

    const bottomBar = document.createElement("div");
    bottomBar.className = "rss-bottom-bar";
    bottomBar.id = "rss-bottom-bar";
    bottomBar.textContent = "就绪";
    this.element.appendChild(bottomBar);

    this.feedView = new FeedView(
      document.createElement("div"),
      this.data,
      (newData: PluginData) => {
        this.data = newData;
        this.updateData(newData);
      }
    );

    this.settingsView = new SettingsView(
      document.createElement("div"),
      this.data,
      (newData: PluginData) => {
        this.data = newData;
        this.updateData(newData);
      }
    );
  }

  private switchTab(tab: Tab): void {
    this.currentTab = tab;

    this.feedTabEl.classList.toggle("active", tab === "feed");
    this.settingsTabEl.classList.toggle("active", tab === "settings");

    this.contentEl.innerHTML = "";

    if (tab === "feed") {
      this.contentEl.appendChild(this.feedView.container);
      this.feedView.render();
    } else {
      this.contentEl.appendChild(this.settingsView.container);
      this.settingsView.render();
    }

    this.updateTabBadges();
  }

  private updateTabBadges(): void {
    const unread = store.getUnreadCount(this.data);
    const badge = this.feedTabEl.querySelector(".rss-tab-badge") as HTMLElement;
    if (badge) {
      if (unread > 0) {
        badge.style.display = "inline";
        badge.textContent = String(unread);
      } else {
        badge.style.display = "none";
      }
    }
  }

  private updateBottomBar(): void {
    const bar = this.element.querySelector("#rss-bottom-bar");
    if (bar) {
      const total = this.data.feeds.length;
      const unread = store.getUnreadCount(this.data);
      bar.textContent = `📊 ${total} 个订阅源 · ${unread} 篇未读`;
    }
  }
}
