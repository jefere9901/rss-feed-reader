const CONTENT_SELECTORS = [
  "article",
  '[role="main"]',
  "main",
  ".post-content",
  ".article-content",
  ".entry-content",
  ".post-body",
  ".article-body",
  ".content-body",
  '[itemprop="articleBody"]',
  ".story-body",
  ".article__body",
];

const REMOVE_SELECTORS = [
  "script", "style", "noscript", "iframe", "svg",
  "nav", "header", "footer",
  ".sidebar", ".widget", ".advertisement", ".ad",
  ".social-share", ".comments", ".comment-list",
  '[role="navigation"]', '[role="banner"]',
  ".related-posts", ".recommended",
  ".paywall", ".subscribe-banner", ".newsletter-signup",
];

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "");
}

function findMainContent(doc: Document): Element | null {
  for (const sel of CONTENT_SELECTORS) {
    const el = doc.querySelector(sel);
    if (el) return el;
  }
  return null;
}

function cleanElement(el: Element): void {
  const removeList = [
    "script", "style", "noscript", "iframe", "svg",
    "nav", "footer", "header",
  ];
  removeList.forEach(tag => {
    el.querySelectorAll(tag).forEach(n => n.remove());
  });
  REMOVE_SELECTORS.forEach(sel => {
    try { el.querySelectorAll(sel).forEach(n => n.remove()); } catch {}
  });
}

function getTextLength(el: Element): number {
  return (el.textContent || "").replace(/\s+/g, "").length;
}

export interface ExtractedContent {
  title: string;
  content: string;
  textContent: string;
}

export function extractContent(html: string, fallbackTitle = ""): ExtractedContent {
  const stripped = stripTags(html);
  const parser = new DOMParser();
  const doc = parser.parseFromString(stripped, "text/html");

  const title = doc.querySelector("title")?.textContent?.trim() ||
    doc.querySelector("h1")?.textContent?.trim() ||
    fallbackTitle;

  const mainEl = findMainContent(doc);
  if (mainEl) {
    cleanElement(mainEl);
    return {
      title,
      content: mainEl.innerHTML,
      textContent: mainEl.textContent?.trim() || "",
    };
  }

  const body = doc.querySelector("body");
  if (!body) {
    return { title, content: "", textContent: "" };
  }

  cleanElement(body);
  const kids = Array.from(body.children);

  let bestEl: Element | null = null;
  let bestLen = 0;
  for (const kid of kids) {
    const len = getTextLength(kid);
    if (len > bestLen) {
      bestLen = len;
      bestEl = kid;
    }
  }

  if (bestEl && bestLen > 200) {
    return {
      title,
      content: bestEl.innerHTML,
      textContent: bestEl.textContent?.trim() || "",
    };
  }

  cleanElement(body);
  return {
    title,
    content: body.innerHTML,
    textContent: body.textContent?.trim() || "",
  };
}

export function isContentSubstantial(content: string, summary: string): boolean {
  const cLen = (content || "").replace(/<[^>]+>/g, "").trim().length;
  const sLen = (summary || "").replace(/<[^>]+>/g, "").trim().length;
  const maxLen = Math.max(cLen, sLen);
  return maxLen > 500;
}
