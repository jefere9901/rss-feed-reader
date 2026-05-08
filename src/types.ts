export interface SiYuanResponse<T = unknown> {
  code: number;
  msg: string;
  data: T;
}

export interface Notebook {
  id: string;
  name: string;
  icon: string;
  sort: number;
  closed: boolean;
}

export type AIProvider = "deepseek" | "openai" | "anthropic" | "custom";

export interface AISettings {
  enabled: boolean;
  provider: AIProvider;
  apiKey: string;
  apiEndpoint: string;
  model: string;
  monthlyCallLimit: number;
  summaryEnabled: boolean;
  translateEnabled: boolean;
  translateTargetLang: string;
  autoTranslate: boolean;
  taggingEnabled: boolean;
  taggingMaxTags: number;
  taggingPresetLabels: string[];
  digestEnabled: boolean;
  digestFrequency: "daily" | "weekly";
  digestHour: number;
  digestArticleCount: number;
  digestNotebookPath: string;
  qaEnabled: boolean;
  filterEnabled: boolean;
  filterKeywords: string;
  filterExcludeKeywords: string;
}

export function defaultAISettings(): AISettings {
  return {
    enabled: false,
    provider: "deepseek",
    apiKey: "",
    apiEndpoint: "https://api.deepseek.com/v1/chat/completions",
    model: "deepseek-chat",
    monthlyCallLimit: 500,
    summaryEnabled: true,
    translateEnabled: true,
    translateTargetLang: "中文",
    autoTranslate: false,
    taggingEnabled: false,
    taggingMaxTags: 5,
    taggingPresetLabels: ["科技", "商业", "编程", "设计", "创业", "AI", "阅读", "生活"],
    digestEnabled: false,
    digestFrequency: "daily",
    digestHour: 8,
    digestArticleCount: 10,
    digestNotebookPath: "/RSS Digest",
    qaEnabled: true,
    filterEnabled: false,
    filterKeywords: "",
    filterExcludeKeywords: "",
  };
}

export interface AIUsageStats {
  month: string;
  calls: number;
  tokens: number;
  cost: number;
}

export interface AICacheEntry {
  articleID: string;
  type: "summary" | "translate" | "tags";
  result: string;
  createdAt: string;
}

export interface FeedFolder {
  id: string;
  name: string;
  parentID: string | null;
}

export interface Feed {
  id: string;
  folderID: string | null;
  name: string;
  url: string;
  icon: string;
  lastFetchTime: string;
  lastFetchError: string;
  docID: string;
  articleIDs: string[];
}

export interface Article {
  id: string;
  feedID: string;
  title: string;
  link: string;
  summary: string;
  content: string;
  published: string;
  author: string;
  read: boolean;
  downloadedDocID?: string;
  aiSummary?: string;
  aiTags?: string[];
  aiTranslated?: string;
}

export interface AppSettings {
  targetNotebook: string;
  targetNotebookName: string;
  newArticlePosition: "top" | "bottom";
  autoRefreshMinutes: number;
  bypassPaywall: boolean;
}

export interface PluginData {
  folders: FeedFolder[];
  feeds: Feed[];
  articles: Article[];
  settings: AppSettings;
  aiSettings: AISettings;
  aiUsage: AIUsageStats;
  aiCache: AICacheEntry[];
}
