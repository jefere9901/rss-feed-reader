import { Plugin } from "siyuan";
import { DockWidget } from "./views/dock";
import { initStore } from "./store";
import css from "./styles/index.css?inline";

const RSS_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
<symbol id="iconRSS" viewBox="0 0 32 32">
  <circle cx="7" cy="25" r="3.5" fill="currentColor"/>
  <path d="M4 16a12 12 0 0 1 12 12" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
  <path d="M4 8a20 20 0 0 1 20 20" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
</symbol>
</svg>`;

export default class RSSFeedReader extends Plugin {
  private dockWidget!: DockWidget;
  private dockData!: ReturnType<typeof initStore>;

  onload(): void {
    this.addIcons(RSS_ICON);

    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);

    this.dockData = initStore(this);
  }

  onLayoutReady(): void {
    const plugin = this;
    this.addDock({
      config: {
        position: "Left",
        size: { width: 320, height: 0 },
        icon: "iconRSS",
        title: "RSS Feed",
      },
      data: {
        icon: "iconRSS",
        title: "RSS Feed",
      },
      type: "dock",
      hotkey: "Ctrl+Shift+R",
      show: true,
      init() {
        plugin.dockWidget = new DockWidget(plugin.dockData);
        this.element.appendChild(plugin.dockWidget.element);
      },
      resize() {},
      destroy() {},
    });
  }
}
