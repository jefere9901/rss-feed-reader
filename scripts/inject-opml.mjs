import { readFileSync } from 'fs';
import { chromium } from 'playwright';

const jsonPath = 'D:\\demo\\rss_siyuan\\scripts\\opml-parsed-data.json';
const jsonData = readFileSync(jsonPath, 'utf-8');
const data = JSON.parse(jsonData);

console.log(`Read ${data.feeds.length} feeds, ${data.folders.length} folders`);

const browser = await chromium.connectOverCDP('http://localhost:30000');
const pages = browser.contexts()[0].pages();
const page = pages[0];

const result = await page.evaluate((injectedData) => {
  const plugins = window.siyuan.layout.leftDock.app.plugins;
  const plugin = plugins.find(p => p.name === 'rss-feed-reader');
  if (!plugin) return { error: 'plugin not found' };

  plugin.dockData = {
    folders: injectedData.folders,
    feeds: injectedData.feeds,
    articles: injectedData.articles || [],
    settings: injectedData.settings || {
      targetNotebook: '',
      targetNotebookName: 'RSS 订阅',
      newArticlePosition: 'top',
      autoRefreshMinutes: 0
    }
  };

  try {
    const saveKey = 'rss-feed-reader-data';
    plugin.saveData(saveKey, JSON.stringify(plugin.dockData));
  } catch (e) {
    return { error: 'saveData failed: ' + e.message };
  }

  return {
    success: true,
    folders: plugin.dockData.folders.length,
    feeds: plugin.dockData.feeds.length,
    articles: plugin.dockData.articles.length
  };
}, data);

console.log('Injection result:', JSON.stringify(result, null, 2));
await browser.close();
