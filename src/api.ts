import type { SiYuanResponse, Notebook } from "./types";

const BASE_URL = "http://127.0.0.1:6806";

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = (window as any).siyuan?.config?.token;
  if (token) {
    headers["Authorization"] = `Token ${token}`;
  }
  return headers;
}

async function post<T>(
  url: string,
  body?: Record<string, unknown>
): Promise<SiYuanResponse<T>> {
  const res = await fetch(`${BASE_URL}${url}`, {
    method: "POST",
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export async function lsNotebooks(): Promise<Notebook[]> {
  const res = await post<{ notebooks: Notebook[] }>(
    "/api/notebook/lsNotebooks"
  );
  if (res.code !== 0) throw new Error(res.msg);
  return res.data.notebooks;
}

export async function createNotebook(
  name: string
): Promise<Notebook> {
  const res = await post<{ notebook: Notebook }>(
    "/api/notebook/createNotebook",
    { name }
  );
  if (res.code !== 0) throw new Error(res.msg);
  return res.data.notebook;
}

export async function createDocWithMd(
  notebook: string,
  path: string,
  markdown: string
): Promise<string> {
  const res = await post<{ data: string }>(
    "/api/filetree/createDocWithMd",
    { notebook, path, markdown }
  );
  if (res.code !== 0) throw new Error(res.msg);
  return res.data as unknown as string;
}

export async function appendBlock(
  parentID: string,
  data: string,
  dataType: "markdown" | "dom" = "markdown"
): Promise<void> {
  await post("/api/block/appendBlock", {
    parentID,
    data,
    dataType,
  });
}

export async function prependBlock(
  parentID: string,
  data: string,
  dataType: "markdown" | "dom" = "markdown"
): Promise<void> {
  await post("/api/block/prependBlock", {
    parentID,
    data,
    dataType,
  });
}

export async function pushMsg(msg: string, timeout = 7000): Promise<void> {
  await post("/api/notification/pushMsg", { msg, timeout });
}

export async function pushErrMsg(msg: string, timeout = 7000): Promise<void> {
  await post("/api/notification/pushErrMsg", { msg, timeout });
}

export async function sql(query: string): Promise<any[]> {
  const res = await post<unknown[]>("/api/query/sql", { stmt: query });
  if (res.code !== 0) throw new Error(res.msg);
  return res.data as any[];
}

export async function uploadAsset(
  file: File,
  assetsDirPath = "/assets/"
): Promise<Record<string, string>> {
  const form = new FormData();
  form.append("assetsDirPath", assetsDirPath);
  form.append("file[]", file);
  const token = (window as any).siyuan?.config?.token;
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Token ${token}`;
  const res = await fetch(`${BASE_URL}/api/asset/upload`, {
    method: "POST",
    headers,
    body: form,
  });
  const json: SiYuanResponse<{ errFiles: string[]; succMap: Record<string, string> }> = await res.json();
  if (json.code !== 0) throw new Error(json.msg);
  return json.data.succMap;
}

export async function getBlockKramdown(id: string): Promise<string> {
  const res = await post<{ id: string; kramdown: string }>(
    "/api/block/getBlockKramdown",
    { id }
  );
  if (res.code !== 0) throw new Error(res.msg);
  return res.data.kramdown;
}

export async function getChildBlocks(id: string): Promise<any[]> {
  const res = await post<any[]>("/api/block/getChildBlocks", { id });
  if (res.code !== 0) throw new Error(res.msg);
  return res.data;
}

export async function updateBlock(
  id: string,
  data: string,
  dataType: "markdown" | "dom" = "markdown"
): Promise<void> {
  await post("/api/block/updateBlock", { id, data, dataType });
}

export async function deleteBlock(id: string): Promise<void> {
  await post("/api/block/deleteBlock", { id });
}

export async function forwardProxy(
  url: string,
  method = "GET",
  headers: { name: string; value: string }[] = [],
  contentType = "text/xml"
): Promise<string> {
  const res = await post<{ body: string; bodyEncoding: string; contentType: string; status: number }>(
    "/api/network/forwardProxy",
    {
      url,
      method,
      timeout: 15000,
      contentType,
      headers,
      payload: {},
      payloadEncoding: "text",
      responseEncoding: "text",
    }
  );
  if (res.code !== 0) throw new Error(res.msg);
  if (res.data.status < 200 || res.data.status >= 400) {
    throw new Error(`HTTP ${res.data.status}: ${url}`);
  }
  return res.data.body;
}

export function openDoc(id: string): void {
  window.open(`siyuan://blocks/${id}`);
}
