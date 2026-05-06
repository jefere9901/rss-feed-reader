import { readFileSync } from 'fs';
import { DOMParser } from 'xmldom';

const opmlContent = readFileSync('D:/demo/rss_siyuan/Reeder.opml', 'utf-8');
const parser = new DOMParser();
const doc = parser.parseFromString(opmlContent, 'text/xml');
const body = doc.getElementsByTagName('body')[0];
if (!body) {
  console.error('No body element found');
  process.exit(1);
}

function parseOutlines(parent) {
  const outlines = [];
  const elements = parent.childNodes;
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (el.nodeName !== 'outline') continue;
    const outline = {
      text: el.getAttribute('text') || el.getAttribute('title') || '',
      title: el.getAttribute('title') || el.getAttribute('text') || '',
      type: el.getAttribute('type') || '',
      xmlUrl: el.getAttribute('xmlUrl') || '',
      htmlUrl: el.getAttribute('htmlUrl') || '',
      children: parseOutlines(el)
    };
    outlines.push(outline);
  }
  return outlines;
}

const outlines = parseOutlines(body);
console.log(`Found ${outlines.length} root outlines`);

const feeds = [];
const folders = [];
let articleCount = 0;

async function processOutlines(items, parentFolder) {
  for (const item of items) {
    if (item.xmlUrl) {
      const feedID = `feed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      feeds.push({
        id: feedID,
        folderID: parentFolder,
        name: item.text || item.title || item.xmlUrl,
        url: item.xmlUrl,
        icon: '📡',
        lastFetchTime: '',
        docID: '',
        articleIDs: [],
      });
    }
    if (item.children && item.children.length > 0) {
      let folderID = null;
      if (item.text || item.title) {
        folderID = `folder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        folders.push({
          id: folderID,
          name: item.text || item.title || '未命名',
          parentID: parentFolder,
        });
      }
      await processOutlines(item.children, folderID || parentFolder);
    }
  }
}

await processOutlines(outlines, null);

const data = {
  folders,
  feeds,
  articles: [],
  settings: {
    targetNotebook: '',
    targetNotebookName: 'RSS 订阅',
    newArticlePosition: 'top',
    autoRefreshMinutes: 0,
  }
};

console.log(`Parsed: ${feeds.length} feeds, ${folders.length} folders`);
console.log('Folders:', folders.map(f => f.name).join(', '));
console.log('\nFirst 5 feeds:');
feeds.slice(0, 5).forEach(f => console.log(`  - ${f.name} (${f.url})`));

// Save to file for inspection
const jsonStr = JSON.stringify(data, null, 2);
const outputPath = 'D:/demo/rss_siyuan/scripts/opml-parsed-data.json';
writeFileSync(outputPath, jsonStr, 'utf-8');
console.log(`\nData saved to ${outputPath}`);
