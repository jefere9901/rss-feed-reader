import { Plugin } from "siyuan";
import { DockWidget } from "./views/dock";
import { initStore } from "./store";
import css from "./styles/index.css?inline";

export default class RSSFeedReader extends Plugin {
  private dockWidget!: DockWidget;
  private dockData!: ReturnType<typeof initStore>;

  onload(): void {
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
