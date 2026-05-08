import type { AISettings } from "./types";

function buildHeaders(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
  };
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function chatCompletion(
  settings: AISettings,
  messages: ChatMessage[],
  maxTokens = 1024
): Promise<{ content: string; tokens: number }> {
  const body = JSON.stringify({
    model: settings.model,
    messages,
    max_tokens: maxTokens,
    temperature: 0.3,
  });

  const res = await fetch(settings.apiEndpoint, {
    method: "POST",
    headers: buildHeaders(settings.apiKey),
    body,
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 100)}`);
  }

  const data = await res.json().catch(() => ({}));
  if (data.error) {
    throw new Error(data.error.message || "AI API 错误");
  }

  const content = data.choices?.[0]?.message?.content || "";
  const tokens = data.usage?.total_tokens || 0;

  return { content, tokens };
}

const SUMMARY_PROMPT = `你是一个专业的文章摘要助手。请用中文总结以下文章的核心内容。

要求：
1. 用 3-5 个要点概括主要观点（每条 1-2 句）
2. 最后用一句话总结全文
3. 格式：每条要点以"• "开头
4. 不要添加"这篇文章"等冗余开头

文章内容：
{content}

标题：{title}`;

const TRANSLATE_PROMPT = `请将以下内容翻译成{targetLang}。

要求：
1. 保持原文的格式和结构
2. 专业术语翻译准确
3. 语气自然流畅
4. 只输出翻译结果，不要添加任何解释

原文内容：
{content}`;

const TAG_PROMPT = `请为以下文章打标签。从预设标签库中选择最相关的标签。

预设标签：{presets}

要求：
1. 最多选择 {maxTags} 个标签
2. 只输出标签名称，用逗号分隔
3. 不要输出其他内容

标题：{title}
摘要：{summary}`;

const FILTER_PROMPT = `请判断以下文章是否与用户的兴趣相关。

用户兴趣关键词：{keywords}
排除关键词：{exclude}

只回答"相关"或"不相关"，不要输出其他内容。

标题：{title}
摘要：{summary}`;

const DIGEST_PROMPT = `你是一个专业的新闻简报编辑。请为以下文章生成一份阅读摘要。

要求：
1. 筛选出最重要的 {count} 篇文章
2. 每篇文章用 2-3 句话概括要点
3. 最后用一句话总结今日/本周的整体趋势
4. 用 Markdown 格式输出

格式：
# {title}

{文章列表}

## 总结
（一句话趋势）

文章列表：
{articles}`;

export async function aiSummarize(
  settings: AISettings,
  title: string,
  content: string
): Promise<{ result: string; tokens: number }> {
  const text = (content || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const truncated = text.length > 8000 ? text.slice(0, 8000) + "..." : text;

  const prompt = SUMMARY_PROMPT
    .replace("{title}", title)
    .replace("{content}", truncated);

  const { content: result, tokens } = await chatCompletion(settings, [
    { role: "user", content: prompt },
  ]);

  return { result, tokens };
}

export async function aiTranslate(
  settings: AISettings,
  content: string,
  targetLang = "中文"
): Promise<{ result: string; tokens: number }> {
  const text = (content || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const truncated = text.length > 6000 ? text.slice(0, 6000) + "..." : text;

  const prompt = TRANSLATE_PROMPT
    .replace("{targetLang}", targetLang)
    .replace("{content}", truncated);

  const { content: result, tokens } = await chatCompletion(settings, [
    { role: "user", content: prompt },
  ]);

  return { result, tokens };
}

export async function aiTagArticle(
  settings: AISettings,
  title: string,
  summary: string
): Promise<{ tags: string[]; tokens: number }> {
  const text = (summary || title || "").replace(/<[^>]+>/g, " ").slice(0, 2000);
  const presets = settings.taggingPresetLabels.join("、");

  const prompt = TAG_PROMPT
    .replace("{presets}", presets)
    .replace("{maxTags}", String(settings.taggingMaxTags))
    .replace("{title}", title)
    .replace("{summary}", text);

  const { content: result, tokens } = await chatCompletion(settings, [
    { role: "user", content: prompt },
  ], 256);

  const tags = result
    .split(/[,，、]/)
    .map(t => t.trim())
    .filter(t => t && !t.includes("标签") && t.length < 20);

  return { tags, tokens };
}

export async function aiFilterArticle(
  settings: AISettings,
  title: string,
  summary: string
): Promise<{ relevant: boolean; tokens: number }> {
  const text = (summary || title || "").replace(/<[^>]+>/g, " ").slice(0, 1500);

  const prompt = FILTER_PROMPT
    .replace("{keywords}", settings.filterKeywords)
    .replace("{exclude}", settings.filterExcludeKeywords)
    .replace("{title}", title)
    .replace("{summary}", text);

  const { content: result, tokens } = await chatCompletion(settings, [
    { role: "user", content: prompt },
  ], 32);

  return { relevant: result.includes("相关"), tokens };
}

export async function aiGenerateDigest(
  settings: AISettings,
  articles: { title: string; summary: string }[]
): Promise<{ result: string; tokens: number }> {
  const articleList = articles
    .slice(0, settings.digestArticleCount)
    .map((a, i) => `${i + 1}. **${a.title}**\n   ${(a.summary || "").replace(/<[^>]+>/g, "").slice(0, 200)}`)
    .join("\n\n");

  const freqLabel = settings.digestFrequency === "daily" ? "今日" : "本周";
  const prompt = DIGEST_PROMPT
    .replace("{count}", String(Math.min(settings.digestArticleCount, articles.length)))
    .replace("{title}", `${freqLabel} RSS 阅读摘要`)
    .replace("{articles}", articleList);

  const { content: result, tokens } = await chatCompletion(settings, [
    { role: "user", content: prompt },
  ], 2048);

  return { result, tokens };
}

export async function aiChat(
  settings: AISettings,
  articleContent: string,
  question: string,
  history: { role: "user" | "assistant"; content: string }[] = []
): Promise<{ result: string; tokens: number }> {
  const context = (articleContent || "").replace(/<[^>]+>/g, " ").slice(0, 4000);

  const messages: ChatMessage[] = [
    { role: "system", content: "你是一个基于文章内容的问答助手。请根据提供的文章内容回答用户问题。如果文章中没有相关信息，请如实说明。" },
    { role: "user", content: `以下是一篇文章的内容：\n\n${context}\n\n请根据以上内容回答后续问题。` },
    ...history.map(h => ({ role: h.role as "user" | "assistant", content: h.content })),
    { role: "user", content: question },
  ];

  const { content: result, tokens } = await chatCompletion(settings, messages, 1024);

  return { result, tokens };
}

export async function testConnection(settings: AISettings): Promise<boolean> {
  try {
    await chatCompletion(settings, [
      { role: "user", content: "Ping" },
    ], 16);
    return true;
  } catch {
    return false;
  }
}
