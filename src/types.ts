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
}

export interface AppSettings {
  targetNotebook: string;
  targetNotebookName: string;
  newArticlePosition: "top" | "bottom";
  autoRefreshMinutes: number;
}

export interface PluginData {
  folders: FeedFolder[];
  feeds: Feed[];
  articles: Article[];
  settings: AppSettings;
}
