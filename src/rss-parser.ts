export interface ParsedFeed {
  title: string;
  description: string;
  link: string;
  icon: string;
  articles: ParsedArticle[];
}

export interface ParsedArticle {
  title: string;
  link: string;
  summary: string;
  content: string;
  published: string;
  author: string;
}

function getTextContent(parent: Element, selector: string): string {
  const el = parent.querySelector(selector);
  return el?.textContent?.trim() ?? "";
}

function getHTMLContent(parent: Element, selector: string): string {
  let el: Element | null = null;

  if (selector.includes("\\:")) {
    const tagged = selector.replace("\\:", ":");
    const els = parent.getElementsByTagName(tagged);
    el = els.length > 0 ? els[0] : null;
  } else {
    el = parent.querySelector(selector);
  }

  if (!el) return "";

  const cdata = Array.from(el.childNodes).find(
    (n) => n.nodeType === 4 /* CDATA_SECTION_NODE */
  );
  if (cdata && cdata.nodeValue) {
    return cdata.nodeValue.trim();
  }

  const text = el.textContent?.trim() || "";
  if (!text) return "";

  if (/<(\w+)[^>]*>/i.test(text)) {
    return text;
  }

  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML || text;
}

function getFirstImage(html: string): string {
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/);
  return imgMatch?.[1] ?? "";
}

function getIconFromLink(links: HTMLCollectionOf<Element>, feedUrl: string): string {
  for (const link of links) {
    const href = (link as Element).getAttribute("href") ?? "";
    const rel = (link as Element).getAttribute("rel") ?? "";
    if (rel.includes("icon") || rel.includes("shortcut")) {
      if (href.startsWith("http")) return href;
      try {
        const url = new URL(feedUrl);
        return `${url.origin}${href.startsWith("/") ? "" : "/"}${href}`;
      } catch {
        return href;
      }
    }
  }
  return "";
}

function extractDomainIcon(feedUrl: string): string {
  try {
    const url = new URL(feedUrl);
    return `${url.origin}/favicon.ico`;
  } catch {
    return "";
  }
}

function detectFeedLinks(doc: Document, baseUrl: string): { title: string; url: string }[] {
  const feeds: { title: string; url: string }[] = [];
  const links = doc.querySelectorAll('link[type*="rss"], link[type*="atom"], link[type*="xml"]');
  links.forEach((link) => {
    const href = link.getAttribute("href");
    const title = link.getAttribute("title") || "";
    if (href) {
      try {
        const absoluteUrl = new URL(href, baseUrl).href;
        feeds.push({ title, url: absoluteUrl });
      } catch {
        feeds.push({ title, url: href });
      }
    }
  });
  return feeds;
}

function parseRSSItem(item: Element, feedUrl: string): ParsedArticle {
  const content = getHTMLContent(item, "content\\:encoded") ||
    getHTMLContent(item, "content") ||
    getHTMLContent(item, "description");

  const descriptionEl = item.querySelector("description");
  const descriptionText = descriptionEl?.textContent?.trim() ?? "";
  const summary = descriptionText.replace(/<[^>]+>/g, "").slice(0, 500) || (content.replace(/<[^>]+>/g, "").slice(0, 500));

  return {
    title: getTextContent(item, "title"),
    link: getTextContent(item, "link"),
    summary: summary.replace(/<[^>]+>/g, "").slice(0, 500),
    content,
    published: getTextContent(item, "pubDate") || getTextContent(item, "dc\\:date"),
    author: getTextContent(item, "author") || getTextContent(item, "dc\\:creator"),
  };
}

function parseAtomEntry(entry: Element): ParsedArticle {
  const getTag = (sel: string) =>
    entry.querySelector(sel)?.textContent?.trim() ?? "";

  const linkEl = entry.querySelector("link[rel=alternate], link:not([rel])");
  const link = linkEl?.getAttribute("href") ?? "";

  const contentEl = entry.querySelector("content");
  let content = contentEl?.textContent?.trim() ?? "";

  if (!content) {
    const mediaGroups = entry.getElementsByTagName("media:group");
    if (mediaGroups.length > 0) {
      const mediaDesc = mediaGroups[0].getElementsByTagName("media:description")[0];
      if (mediaDesc) {
        content = mediaDesc.textContent?.trim() ?? "";
      }
    }
  }

  const summaryEl = entry.querySelector("summary");
  const summary = summaryEl?.textContent?.trim() || content.replace(/<[^>]+>/g, "").slice(0, 500);

  const published = getTag("published") || getTag("updated");

  return {
    title: getTag("title"),
    link,
    summary: summary.replace(/<[^>]+>/g, "").slice(0, 500),
    content,
    published,
    author: getTag("author > name"),
  };
}

export function parseFeedXML(
  xml: string,
  feedUrl: string
): ParsedFeed {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");

  const isRSS = !!doc.querySelector("rss");
  const isAtom = !!doc.querySelector("feed");

  if (!isRSS && !isAtom) {
    throw new Error("不支持的 XML 格式，请确认是有效的 RSS 或 Atom Feed");
  }

  if (isRSS) {
    const channel = doc.querySelector("channel")!;
    const items = Array.from(channel.querySelectorAll("item"));
    const imageEl = channel.querySelector("image > url");

    return {
      title: getTextContent(channel, "title") || feedUrl,
      description: getTextContent(channel, "description"),
      link: getTextContent(channel, "link"),
      icon: imageEl?.textContent?.trim() || extractDomainIcon(feedUrl),
      articles: items.map((item) => parseRSSItem(item, feedUrl)),
    };
  }

  if (isAtom) {
    const entries = Array.from(doc.querySelectorAll("entry"));
    const iconEl = doc.querySelector("icon") || doc.querySelector("logo");

    return {
      title:
        doc.querySelector("title")?.textContent?.trim() || feedUrl,
      description:
        doc.querySelector("subtitle")?.textContent?.trim() ?? "",
      link:
        doc.querySelector("link[rel=alternate]")?.getAttribute("href") ?? "",
      icon: iconEl?.textContent?.trim() || extractDomainIcon(feedUrl),
      articles: entries.map(parseAtomEntry),
    };
  }

  throw new Error("无法解析的 Feed 格式");
}

export async function fetchFeed(
  url: string
): Promise<ParsedFeed> {
  const { forwardProxy } = await import("./api");
  const text = await forwardProxy(
    url,
    "GET",
    [
      { name: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 RSS Reader/1.0" },
      { name: "Accept", value: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
    ],
    "text/xml"
  );
  return parseFeedXML(text, url);
}

export async function discoverFeed(
  url: string
): Promise<{ title: string; url: string }[]> {
  // YouTube channel URL → convert to RSS
  if (/youtube\.com\/(@|channel\/|feeds\/videos)/i.test(url)) {
    return discoverYouTubeChannel(url);
  }

  const { forwardProxy } = await import("./api");
  const html = await forwardProxy(
    url,
    "GET",
    [
      { name: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    ],
    "text/html"
  );

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const feeds = detectFeedLinks(doc, url);
  const title =
    doc.querySelector("title")?.textContent?.trim() || url;

  return feeds.length > 0 ? feeds : [{ title, url }];
}

async function discoverYouTubeChannel(
  url: string
): Promise<{ title: string; url: string }[]> {
  const { forwardProxy } = await import("./api");

  // Case 0: URL is already the RSS feed endpoint
  let channelId = new URL(url).searchParams.get("channel_id") || "";
  if (channelId && /feeds\/videos/i.test(url)) {
    return [{ title: url, url }];
  }

  // Case 2: URL is youtube.com/channel/UCxxx
  if (!channelId) {
    const chanMatch = url.match(/youtube\.com\/channel\/(UC[\w-]+)/);
    if (chanMatch) channelId = chanMatch[1];
  }

  // Case 3: URL has @handle — fetch channel page to extract channelId
  if (!channelId) {
    try {
      const html = await forwardProxy(
        url,
        "GET",
        [
          { name: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" },
          { name: "Accept-Language", value: "zh-CN,zh;q=0.9" },
        ],
        "text/html"
      );

      // Extract channel name from og:title
      const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/);
      const title = titleMatch ? titleMatch[1].replace(/ - YouTube$/, "") : "";

      // Try parsing ytInitialData
      const ytIdx = html.indexOf("var ytInitialData");
      if (ytIdx > -1) {
        const eqIdx = html.indexOf("=", ytIdx);
        const semiIdx = html.indexOf(";\n", eqIdx) > -1 ? html.indexOf(";\n", eqIdx) : html.indexOf(";", eqIdx);
        if (eqIdx > -1 && semiIdx > -1) {
          try {
            const jsonStr = html.substring(eqIdx + 1, semiIdx).trim();
            const data = JSON.parse(jsonStr);
            const meta = data?.metadata?.channelMetadataRenderer;
            if (meta?.externalId) {
              channelId = meta.externalId;
            }
          } catch {}
        }
      }

      // Fallback regex
      if (!channelId) {
        const m = html.match(/"externalId"\s*:\s*"(UC[\w-]+)"/);
        channelId = m ? m[1] : "";
      }

      if (channelId) {
        const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
        return [{ title: title || url, url: rssUrl }];
      }
    } catch {}
  }

  // Case 4: Already have channelId from case 1 or 2
  if (channelId) {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    return [{ title: url, url: rssUrl }];
  }

  // Fallback: try as-is
  return [{ title: url, url }];
}

export function htmlToMarkdown(html: string): string {
  const safe = html.replace(/<!\[CDATA\[|\]\]>/gi, "");
  const temp = document.createElement("div");
  temp.innerHTML = safe;
  const result = nodeToMarkdown(temp);
  return result.replace(/\n{3,}/g, "\n\n").trim();
}

function nodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const children = Array.from(el.childNodes).map(nodeToMarkdown).join("");

  switch (tag) {
    case "h1": return `# ${children}\n\n`;
    case "h2": return `## ${children}\n\n`;
    case "h3": return `### ${children}\n\n`;
    case "h4": return `#### ${children}\n\n`;
    case "h5": return `##### ${children}\n\n`;
    case "h6": return `###### ${children}\n\n`;
    case "p": return `${children}\n\n`;
    case "br": return `\n`;
    case "hr": return `---\n\n`;
    case "strong": case "b": return `**${children}**`;
    case "em": case "i": return `*${children}*`;
    case "del": case "s": case "strike": return `~~${children}~~`;
    case "a": {
      const href = el.getAttribute("href") || "#";
      const text = children || href;
      return `[${text}](${href})`;
    }
    case "img": {
      const src = el.getAttribute("src") || "";
      const alt = el.getAttribute("alt") || "";
      const title = el.getAttribute("title");
      const titlePart = title ? ` "${title}"` : "";
      return `![${alt}](${src}${titlePart})`;
    }
    case "ul": return `\n${children}\n`;
    case "ol": return `\n${children}\n`;
    case "li": {
      const parent = el.parentElement?.tagName.toLowerCase();
      const prefix = parent === "ol" ? "1. " : "- ";
      return `${prefix}${children}\n`;
    }
    case "blockquote": {
      const lines = children.split("\n");
      return `> ${lines.join("\n> ")}\n\n`;
    }
    case "code": {
      if (el.parentElement?.tagName.toLowerCase() === "pre") return children;
      return `\`${children}\``;
    }
    case "pre": return `\n\`\`\`\n${children}\n\`\`\`\n\n`;
    case "div": case "section": case "article":
    case "header": case "footer": case "main": case "nav":
    case "span": case "figure": case "figcaption":
    case "picture": case "video": case "audio":
      return children;
    case "sup": return `^${children}^`;
    case "sub": return `~${children}~`;
    default: return children;
  }
}

export function articleToMarkdown(article: ParsedArticle): string {
  const lines: string[] = [];
  lines.push(`# ${article.title}`);
  lines.push("");
  if (article.author) lines.push(`> 作者：${article.author}`);
  if (article.published) lines.push(`> 日期：${article.published}`);
  if (article.link) lines.push(`> 原文：[${article.link}](${article.link})`);
  lines.push("");

  if (article.content) {
    lines.push(htmlToMarkdown(article.content));
  } else if (article.summary) {
    lines.push(article.summary);
    lines.push("");
  }

  return lines.join("\n");
}

export function articleToSummary(article: ParsedArticle): string {
  const lines: string[] = [];
  if (article.link) {
    lines.push(`- [${article.title}](${article.link})`);
  } else {
    lines.push(`- ${article.title}`);
  }
  if (article.summary) {
    lines.push(`  ${article.summary.slice(0, 200)}`);
  }
  return lines.join("\n");
}

export interface OPMLOutline {
  text: string;
  title: string;
  type: string;
  xmlUrl: string;
  htmlUrl: string;
  children: OPMLOutline[];
}

export function parseOPML(xml: string): OPMLOutline[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");
  const body = doc.querySelector("body");
  if (!body) throw new Error("无效的 OPML 文件");
  return parseOutlines(body);
}

function parseOutlines(parent: Element): OPMLOutline[] {
  const outlines: OPMLOutline[] = [];
  const elements = parent.querySelectorAll(":scope > outline");
  elements.forEach((el) => {
    const outline: OPMLOutline = {
      text: el.getAttribute("text") || el.getAttribute("title") || "",
      title: el.getAttribute("title") || el.getAttribute("text") || "",
      type: el.getAttribute("type") || "",
      xmlUrl: el.getAttribute("xmlUrl") || "",
      htmlUrl: el.getAttribute("htmlUrl") || "",
      children: parseOutlines(el),
    };
    outlines.push(outline);
  });
  return outlines;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function generateOPML(data: { folders: { id: string; name: string; parentID: string | null }[]; feeds: { folderID: string | null; name: string; url: string }[] }): string {
  const feedsByFolder = new Map<string | null, { name: string; url: string }[]>();
  for (const feed of data.feeds) {
    const key = feed.folderID;
    if (!feedsByFolder.has(key)) feedsByFolder.set(key, []);
    feedsByFolder.get(key)!.push({ name: feed.name, url: feed.url });
  }

  // Build folder tree: folderId → { name, children folderIds }
  const folderMap = new Map<string, { name: string; children: string[] }>();
  const rootFolders: string[] = [];
  for (const f of data.folders) {
    folderMap.set(f.id, { name: f.name, children: [] });
    if (!f.parentID) {
      rootFolders.push(f.id);
    } else {
      const parent = folderMap.get(f.parentID);
      if (parent) parent.children.push(f.id);
    }
  }

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<opml version="2.0">\n`;
  xml += `  <head>\n    <title>RSS 订阅导出</title>\n    <dateCreated>${new Date().toISOString()}</dateCreated>\n  </head>\n`;
  xml += `  <body>\n`;

  // Export root folders (with their feeds)
  for (const fid of rootFolders) {
    const folder = folderMap.get(fid)!;
    const feeds = feedsByFolder.get(fid) || [];
    if (feeds.length === 0 && folder.children.length === 0) continue;

    xml += `    <outline text="${escapeXml(folder.name)}" title="${escapeXml(folder.name)}">\n`;
    for (const feed of feeds) {
      xml += `      <outline text="${escapeXml(feed.name)}" title="${escapeXml(feed.name)}" type="rss" xmlUrl="${escapeXml(feed.url)}"/>\n`;
    }
    xml += `    </outline>\n`;
  }

  // Export ungrouped feeds
  const ungroupedFeeds = feedsByFolder.get(null) || [];
  for (const feed of ungroupedFeeds) {
    xml += `    <outline text="${escapeXml(feed.name)}" title="${escapeXml(feed.name)}" type="rss" xmlUrl="${escapeXml(feed.url)}"/>\n`;
  }

  xml += `  </body>\n</opml>\n`;
  return xml;
}
