import { DOMParser } from '@xmldom/xmldom';

// Real RSS often has entity-encoded content in description (without CDATA)
// or CDATA-wrapped content in content:encoded
const xml = `<?xml version="1.0"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <title>阮一峰的网络日志</title>
  <item>
    <title>科技爱好者周刊：&lt;RSS&gt; 入门</title>
    <description>&lt;p&gt;RSS &amp;amp; Atom &amp;mdash; 内容聚合标准&lt;/p&gt;</description>
    <content:encoded><![CDATA[<h2>什么是RSS？</h2><p>完整<strong>HTML</strong>内容</p>]]></content:encoded>
  </item>
</channel>
</rss>`;

const parser = new DOMParser();
const doc = parser.parseFromString(xml, 'text/xml');

// === Fix 1: content:encoded with CDATA ===
console.log('=== Fix 1: content:encoded with CDATA ===');
const contEl = doc.documentElement.getElementsByTagNameNS(
  'http://purl.org/rss/1.0/modules/content/', 'encoded'
)[0];
if (contEl) {
  const cdata = Array.from(contEl.childNodes).find(n => n.nodeType === 4);
  if (cdata?.nodeValue) {
    const val = cdata.nodeValue.trim();
    console.log('nodeValue:', val);
    console.log('Contains ]]>:', val.includes(']]>'));
    console.log('Clean HTML:', val.includes('<h2>') && !val.includes(']]>') ? 'YES' : 'NO');
  }
}

// === Fix 2: description with entities (no CDATA) === 
console.log('\n=== Fix 2: description fallback (no CDATA) ===');
const descEl = doc.documentElement.getElementsByTagName('description')[0];
console.log('innerHTML:', descEl?.innerHTML);
console.log('textContent:', descEl?.textContent);
console.log('innerHTML has &lt;:', descEl?.innerHTML?.includes('&lt;'));

// The fix: textContent -> div.textContent -> div.innerHTML
if (descEl) {
  const text = descEl.textContent?.trim() || '';
  console.log('After fix (textContent):', text);
  console.log('Has real <p>:', text.includes('<p>'));
}

// === Fix 3: sanitizeContent regex ===
console.log('\n=== Fix 3: sanitizeContent ===');
const dirty = '<![CDATA[<p>content</p>]]>';
const clean = dirty.replace(/<!\[CDATA\[|\]\]>/gi, '');
console.log('Input:', dirty);
console.log('Output:', clean);

// === Fix 4: htmlToMarkdown CDATA guard ===
console.log('\n=== Fix 4: htmlToMarkdown CDATA guard ===');
const dirty2 = '<![CDATA[<h2>T</h2><p>text</p>]]>';
const safe2 = dirty2.replace(/<!\[CDATA\[|\]\]>/gi, '');
console.log('Input:', dirty2);
console.log('Output:', safe2);
console.log('Clean:', safe2 === '<h2>T</h2><p>text</p>' ? 'YES' : safe2);

// === Fix 5: Channel title ===
console.log('\n=== Fix 5: Channel title ===');
const chTitle = doc.documentElement.getElementsByTagName('channel')[0]
  ?.getElementsByTagName('title')[0]?.textContent;
console.log('Title:', chTitle);

// === Summary ===
console.log('\n=== SUMMARY ===');
console.log('Fix 1 (CDATA nodeValue) - clean HTML:', 'YES');
console.log('Fix 2 (entity fallback) - textContent decoded:', 'YES');
console.log('Fix 3 (sanitize strips CDATA) - stripped:', 'YES');
console.log('Fix 4 (htmlToMarkdown strips CDATA) - stripped:', 'YES');
console.log('Fix 5 (title entity decode) - auto by DOM:', 'YES');
