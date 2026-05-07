import type { Article } from "../types";
import * as api from "../api";
import * as store from "../store";
import { htmlToMarkdown } from "../rss-parser";

export class ReaderView {
  private overlay: HTMLElement;
  private article: Article;
  private data: any;
  private onDataChange: (data: any) => void;

  constructor(
    article: Article,
    data: any,
    onDataChange: (data: any) => void
  ) {
    this.article = article;
    this.data = data;
    this.onDataChange = onDataChange;
    this.overlay = this.build();
  }

  show(): void {
    document.body.appendChild(this.overlay);
    requestAnimationFrame(() => {
      this.overlay.classList.add("visible");
    });
  }

  private close(): void {
    this.overlay.classList.remove("visible");
    setTimeout(() => {
      if (this.overlay.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      }
    }, 250);
  }

  private build(): HTMLElement {
    const overlay = document.createElement("div");
    overlay.className = "rss-reader-overlay";

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) this.close();
    });

    const panel = document.createElement("div");
    panel.className = "rss-reader-panel";

    const isDownloaded = !!this.article.downloadedDocID;
    const actionLabel = isDownloaded ? "📄 跳转查看" : "⬇ 下载";
    const actionTitle = isDownloaded ? "在思源中打开" : "下载到思源";
    const actionClass = isDownloaded ? "rss-reader-jump" : "rss-reader-download";

    panel.innerHTML = `
      <div class="rss-reader-toolbar">
        <button class="rss-reader-btn rss-reader-close" title="关闭">✕</button>
        <div class="rss-reader-toolbar-spacer"></div>
        <button class="rss-reader-btn ${actionClass}" title="${actionTitle}">
          ${actionLabel}
        </button>
        <a class="rss-reader-btn rss-reader-link" href="${this.article.link}" target="_blank" title="在浏览器打开">
          🔗 原文
        </a>
      </div>
      <div class="rss-reader-body">
        <h1 class="rss-reader-title">${this.article.title}</h1>
        <div class="rss-reader-meta">
          ${this.article.author ? `<span>👤 ${this.article.author}</span>` : ""}
          <span>🕐 ${this.formatDate(this.article.published)}</span>
        </div>
        <div class="rss-reader-content" id="rss-reader-content">
          ${this.sanitizeContent(this.article.content || this.article.summary || "（无内容）")}
        </div>
      </div>
    `;

    const closeBtn = panel.querySelector(".rss-reader-close") as HTMLElement;
    closeBtn.addEventListener("click", () => this.close());

    const actionBtn = panel.querySelector(`.${actionClass}`) as HTMLElement;
    if (isDownloaded) {
      actionBtn.addEventListener("click", () => {
        api.openDoc(this.article.downloadedDocID!);
        this.close();
      });
    } else {
      actionBtn.addEventListener("click", () => this.handleDownload(actionBtn));
    }

    const linkBtn = panel.querySelector(".rss-reader-link") as HTMLElement;
    linkBtn.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    panel.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.close();
    }, { once: true });

    overlay.appendChild(panel);
    return overlay;
  }

  private async handleDownload(btn: HTMLElement): Promise<void> {
    btn.disabled = true;
    btn.textContent = "⏳ 下载中...";

    try {
      const content = this.article.content || this.article.summary || "";
      const md = this.buildMarkdown(content);

      const notebook = this.data.settings.targetNotebook;
      let docID: string;

      if (notebook) {
        docID = await api.createDocWithMd(
          notebook,
          `/${this.article.title.slice(0, 40)}`,
          md
        );
      } else {
        const notebooks = await api.lsNotebooks();
        let nb = notebooks.find((n) => n.name === "RSS 订阅");
        if (!nb) {
          nb = await api.createNotebook("RSS 订阅");
        }
        docID = await api.createDocWithMd(
          nb.id,
          `/${this.article.title.slice(0, 40)}`,
          md
        );
        this.data = store.saveSettings(this.data, {
          targetNotebook: nb.id,
          targetNotebookName: nb.name,
        });
      }

      this.data = store.setArticleDownloaded(this.data, this.article.id, docID);
      this.article.downloadedDocID = docID;
      this.onDataChange(this.data);

      btn.textContent = "✅ 已下载";
      api.pushMsg(`✅ 已保存到思源：${this.article.title}`);

      setTimeout(() => {
        api.openDoc(docID);
        this.close();
      }, 300);
    } catch (err: any) {
      btn.textContent = "❌ 失败";
      btn.disabled = true;
      api.pushErrMsg(`下载失败：${err.message || "未知错误"}`);
    }
  }

  private buildMarkdown(content: string): string {
    const lines: string[] = [];
    lines.push(`# ${this.article.title}`);
    lines.push("");
    if (this.article.author) {
      lines.push(`> 作者：${this.article.author}`);
    }
    if (this.article.published) {
      lines.push(`> 日期：${this.formatDate(this.article.published)}`);
    }
    if (this.article.link) {
      lines.push(`> 原文：[${this.article.link}](${this.article.link})`);
    }
    lines.push("");

    if (content) {
      lines.push(htmlToMarkdown(content));
    }

    return lines.join("\n");
  }

  private sanitizeContent(html: string): string {
    const cleaned = html
      .replace(/<!\[CDATA\[|\]\]>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
      .replace(/on\w+\s*=\s*"[^"]*"/gi, "")
      .replace(/on\w+\s*=\s*'[^']*'/gi, "")
      .replace(/on\w+\s*=\s*\S+/gi, "");

    return cleaned;
  }

  private formatDate(dateStr: string): string {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  }
}
