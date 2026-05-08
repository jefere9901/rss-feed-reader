import type { Article } from "../types";
import * as api from "../api";
import * as store from "../store";
import { htmlToMarkdown } from "../rss-parser";
import { extractContent, isContentSubstantial } from "../readability";
import { getBypassHeaders } from "../bypass";
import { aiSummarize, aiTranslate, aiChat } from "../ai";

export class ReaderView {
  private overlay: HTMLElement;
  private article: Article;
  private data: any;
  private onDataChange: (data: any) => void;
  private fullTextLoaded = false;
  private translated = false;
  private chatHistory: { role: "user" | "assistant"; content: string }[] = [];

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
      this.maybeFetchFullText();
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

    const currentContent = this.article.content || this.article.summary || "（无内容）";

    const aiBtns: string[] = [];
    const ais = this.data.aiSettings;
    if (ais.summaryEnabled) aiBtns.push(`<button class="rss-reader-btn rss-reader-ai-summary" title="AI 摘要">🤖 摘要</button>`);
    if (ais.translateEnabled) aiBtns.push(`<button class="rss-reader-btn rss-reader-ai-translate" title="AI 翻译">🌐 翻译</button>`);

    panel.innerHTML = `
      <div class="rss-reader-toolbar">
        <button class="rss-reader-btn rss-reader-close" title="关闭">✕</button>
        <div class="rss-reader-toolbar-spacer"></div>
        ${aiBtns.join("")}
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
          ${this.article.aiTags ? `<span class="rss-ai-tags">${this.article.aiTags.map((t: string) => "#" + t).join(" ")}</span>` : ""}
        </div>
        <div class="rss-reader-content" id="rss-reader-content">
          ${this.sanitizeContent(currentContent)}
        </div>
        ${ais.qaEnabled ? `
        <div class="rss-ai-qa" id="rss-ai-qa">
          <div class="rss-ai-qa-messages" id="rss-ai-qa-messages"></div>
          <div class="rss-ai-qa-input-row">
            <input class="rss-ai-qa-input" id="rss-ai-qa-input" placeholder="💬 基于文章内容提问..." />
            <button class="rss-btn rss-btn-primary" id="rss-ai-qa-send" style="font-size:11px;padding:4px 10px;">发送</button>
          </div>
        </div>
        ` : ""}
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
    linkBtn.addEventListener("click", (e) => { e.stopPropagation(); });

    const summaryBtn = panel.querySelector(".rss-reader-ai-summary") as HTMLElement | null;
    if (summaryBtn) {
      summaryBtn.addEventListener("click", (e) => { e.stopPropagation(); this.handleAISummary(summaryBtn); });
    }

    const translateBtn = panel.querySelector(".rss-reader-ai-translate") as HTMLElement | null;
    if (translateBtn) {
      translateBtn.addEventListener("click", (e) => { e.stopPropagation(); this.handleAITranslate(translateBtn); });
    }

    const qaSend = panel.querySelector("#rss-ai-qa-send") as HTMLElement | null;
    if (qaSend) qaSend.addEventListener("click", () => this.handleAIQA());

    const qaInput = panel.querySelector("#rss-ai-qa-input") as HTMLInputElement | null;
    if (qaInput) {
      qaInput.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Enter") this.handleAIQA();
      });
    }

    panel.addEventListener("click", (e) => { e.stopPropagation(); });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.close();
    }, { once: true });

    overlay.appendChild(panel);
    return overlay;
  }

  private async handleAISummary(btn: HTMLElement): Promise<void> {
    const content = this.article.content || this.article.summary || "";
    const cached = store.getAICache(this.data, this.article.id, "summary");
    if (cached) {
      this.showSummaryCard(cached);
      return;
    }

    btn.textContent = "⏳ 摘要...";
    btn.disabled = true;

    try {
      const { result, tokens } = await aiSummarize(this.data.aiSettings, this.article.title, content);
      this.data = store.updateAIUsage(this.data, tokens);
      this.data = store.setAICache(this.data, this.article.id, "summary", result);
      this.onDataChange(this.data);
      this.showSummaryCard(result);
      btn.textContent = "✅ 已摘要";
    } catch (e: any) {
      btn.textContent = "❌";
      api.pushErrMsg(`摘要失败：${e.message}`);
    } finally {
      setTimeout(() => { btn.textContent = "🤖 摘要"; btn.disabled = false; }, 3000);
    }
  }

  private showSummaryCard(result: string): void {
    const existing = document.getElementById("rss-ai-summary-card");
    if (existing) { existing.remove(); return; }

    const contentEl = document.getElementById("rss-reader-content");
    if (!contentEl) return;

    const card = document.createElement("div");
    card.id = "rss-ai-summary-card";
    card.className = "rss-ai-summary-card";
    card.innerHTML = `
      <div class="rss-ai-summary-header">
        <span>🤖 AI 摘要</span>
        <button class="rss-ai-summary-close" id="rss-ai-summary-close">✕</button>
      </div>
      <div class="rss-ai-summary-body">${result.replace(/\n/g, "<br>")}</div>
    `;
    card.querySelector("#rss-ai-summary-close")?.addEventListener("click", () => card.remove());

    const parent = contentEl.parentElement;
    if (parent) parent.insertBefore(card, contentEl);
  }

  private async handleAITranslate(btn: HTMLElement): Promise<void> {
    if (this.translated) {
      const contentEl = document.getElementById("rss-reader-content");
      if (contentEl && this.article.aiTranslated) {
        contentEl.innerHTML = this.sanitizeContent(this.article.aiTranslated);
        this.translated = false;
        btn.textContent = "🌐 翻译";
      }
      return;
    }

    const cached = store.getAICache(this.data, this.article.id, "translate");
    if (cached) {
      this.showTranslation(cached);
      btn.textContent = "📋 原文";
      this.translated = true;
      return;
    }

    btn.textContent = "⏳ 翻译...";
    btn.disabled = true;

    const content = this.article.content || this.article.summary || "";

    try {
      const { result, tokens } = await aiTranslate(this.data.aiSettings, content, this.data.aiSettings.translateTargetLang);
      this.data = store.updateAIUsage(this.data, tokens);
      this.data = store.setAICache(this.data, this.article.id, "translate", result);
      this.data = store.setArticleAITranslate(this.data, this.article.id, result);
      this.onDataChange(this.data);
      this.showTranslation(result);
      this.translated = true;
      btn.textContent = "📋 原文";
    } catch (e: any) {
      btn.textContent = "❌";
      api.pushErrMsg(`翻译失败：${e.message}`);
    } finally {
      btn.disabled = false;
    }
  }

  private showTranslation(result: string): void {
    const contentEl = document.getElementById("rss-reader-content");
    if (contentEl) {
      contentEl.innerHTML = this.sanitizeContent(result);
    }
  }

  private async handleAIQA(): Promise<void> {
    const input = document.getElementById("rss-ai-qa-input") as HTMLInputElement;
    if (!input) return;
    const question = input.value.trim();
    if (!question) return;
    input.value = "";

    const msgs = document.getElementById("rss-ai-qa-messages");
    if (!msgs) return;

    const userBubble = document.createElement("div");
    userBubble.className = "rss-ai-qa-bubble rss-ai-qa-user";
    userBubble.textContent = question;
    msgs.appendChild(userBubble);

    const aiBubble = document.createElement("div");
    aiBubble.className = "rss-ai-qa-bubble rss-ai-qa-ai";
    aiBubble.textContent = "⏳ 思考中...";
    msgs.appendChild(aiBubble);
    msgs.scrollTop = msgs.scrollHeight;

    const content = this.article.content || this.article.summary || "";

    try {
      const { result, tokens } = await aiChat(this.data.aiSettings, content, question, this.chatHistory);
      this.data = store.updateAIUsage(this.data, tokens);
      this.onDataChange(this.data);
      this.chatHistory.push({ role: "user", content: question }, { role: "assistant", content: result });
      aiBubble.textContent = result;
    } catch (e: any) {
      aiBubble.textContent = `❌ ${e.message}`;
    }
    msgs.scrollTop = msgs.scrollHeight;
  }

  private async maybeFetchFullText(): Promise<void> {
    const bypass = this.data.settings.bypassPaywall;
    if (!bypass) return;
    if (this.fullTextLoaded) return;
    if (!this.article.link) return;

    const existing = this.article.content || this.article.summary || "";
    if (isContentSubstantial(existing, this.article.summary || "")) return;

    const contentEl = document.getElementById("rss-reader-content");
    if (!contentEl) return;

    contentEl.insertAdjacentHTML("beforebegin",
      '<div class="rss-fulltext-loading" id="rss-fulltext-loading">⏳ 正在提取全文...</div>'
    );

    try {
      const bypassHeaders = getBypassHeaders(this.article.link);
      const headers: { name: string; value: string }[] = [
        { name: "User-Agent", value: bypassHeaders["User-Agent"] || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      ];
      if (bypassHeaders["Referer"]) {
        headers.push({ name: "Referer", value: bypassHeaders["Referer"] });
      }

      const html = await api.forwardProxy(this.article.link, "GET", headers, "text/html");
      const extracted = extractContent(html, this.article.title);

      if (extracted.content) {
        this.article.content = extracted.content;
        contentEl.innerHTML = this.sanitizeContent(extracted.content);
        this.fullTextLoaded = true;
        api.pushMsg(`✅ 已提取全文：${this.article.title}`);
      }
    } catch {
      const loading = document.getElementById("rss-fulltext-loading");
      if (loading) loading.textContent = "⚠️ 全文提取失败，显示摘要";
      setTimeout(() => {
        const l = document.getElementById("rss-fulltext-loading");
        if (l) l.remove();
      }, 2000);
      return;
    }

    const loading = document.getElementById("rss-fulltext-loading");
    if (loading) loading.remove();
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
        docID = await api.createDocWithMd(notebook, `/${this.article.title.slice(0, 40)}`, md);
      } else {
        const notebooks = await api.lsNotebooks();
        let nb = notebooks.find((n) => n.name === "RSS 订阅");
        if (!nb) {
          nb = await api.createNotebook("RSS 订阅");
        }
        docID = await api.createDocWithMd(nb.id, `/${this.article.title.slice(0, 40)}`, md);
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
    if (this.article.aiSummary) {
      lines.push(`## 🤖 AI 摘要`);
      lines.push(this.article.aiSummary);
      lines.push("");
    }
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
        year: "numeric", month: "long", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch { return dateStr; }
  }
}
