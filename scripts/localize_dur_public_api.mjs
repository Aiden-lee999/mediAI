import fs from 'node:fs/promises';
import path from 'node:path';

const key = process.env.DATA_GO_KR_SERVICE_KEY || 'a73d6c98ef59e73ed780ffb961f298b1cc9fecb40ad0fd0ffab923a67a02027d';
const root = process.cwd();
const pageSize = Number(process.argv.find((arg) => arg.startsWith('--page-size='))?.split('=')[1] || 100);
const maxPages = Number(process.argv.find((arg) => arg.startsWith('--max-pages='))?.split('=')[1] || 800);

const targets = [
  {
    serviceName: '식품의약품안전처_의약품안전사용서비스(DUR)성분정보',
    baseUrl: 'https://apis.data.go.kr/1471000/DURIrdntInfoService03',
    operations: [
      '/getUsjntTabooInfoList02',
      '/getSpcifyAgrdeTabooInfoList02',
      '/getPwnmTabooInfoList02',
      '/getCpctyAtentInfoList02',
      '/getMdctnPdAtentInfoList02',
      '/getOdsnAtentInfoList02',
      '/getEfcyDplctInfoList02',
    ],
  },
  {
    serviceName: '식품의약품안전처_의약품안전사용서비스(DUR)품목정보',
    baseUrl: 'https://apis.data.go.kr/1471000/DURPrdlstInfoService03',
    operations: [
      '/getDurPrdlstInfoList03',
      '/getEfcyDplctInfoList03',
      '/getSeobangjeongPartitnAtentInfoList03',
    ],
  },
];

function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') return [value];
  return [];
}

function extractItems(payload) {
  const candidates = [
    payload?.body?.items,
    payload?.response?.body?.items,
    payload?.body?.items?.item,
    payload?.response?.body?.items?.item,
    payload?.items,
    payload?.item,
  ];

  for (const candidate of candidates) {
    const arr = toArray(candidate?.item ?? candidate);
    if (arr.length > 0) return arr;
  }

  return [];
}

function extractTotalCount(payload) {
  const value = Number(payload?.body?.totalCount || payload?.response?.body?.totalCount || payload?.totalCount || 0);
  return Number.isFinite(value) ? value : 0;
}

function parseXmlPayload(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let itemMatch;
  while ((itemMatch = itemRegex.exec(xml)) !== null) {
    const block = itemMatch[1];
    const row = {};
    const fieldRegex = /<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g;
    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(block)) !== null) {
      row[fieldMatch[1]] = fieldMatch[2]
        .replace(/<!\[CDATA\[/g, '')
        .replace(/\]\]>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .trim();
    }
    if (Object.keys(row).length > 0) items.push(row);
  }

  const totalMatch = xml.match(/<totalCount>\s*(\d+)\s*<\/totalCount>/i);
  return {
    response: { body: { totalCount: totalMatch ? Number(totalMatch[1]) : 0, items: { item: items } } },
  };
}

async function fetchJson(baseUrl, operation, pageNo) {
  const params = new URLSearchParams({
    serviceKey: key,
    _type: 'json',
    numOfRows: String(pageSize),
    pageNo: String(pageNo),
  });
  const url = `${baseUrl}${operation}?${params.toString()}`;
  const res = await fetch(url, { cache: 'no-store' });
  const text = await res.text();
  if (!res.ok) throw new Error(`${operation} ${res.status}: ${text.slice(0, 180)}`);
  try {
    return JSON.parse(text);
  } catch (error) {
    if (text.trim().startsWith('<')) return parseXmlPayload(text);
    throw new Error(`${operation} JSON parse failed: ${text.slice(0, 180)}`);
  }
}

async function localizeTarget(target, operation) {
  const dumpDir = path.join(root, 'data', 'public_api_dumps', target.serviceName);
  await fs.mkdir(dumpDir, { recursive: true });

  const first = await fetchJson(target.baseUrl, operation, 1);
  const totalCount = extractTotalCount(first);
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 1;
  const cappedPages = Math.min(totalPages, maxPages);
  const items = extractItems(first);

  for (let page = 2; page <= cappedPages; page += 1) {
    const payload = await fetchJson(target.baseUrl, operation, page);
    const pageItems = extractItems(payload);
    if (pageItems.length === 0) break;
    items.push(...pageItems);
    if (page % 25 === 0 || page === cappedPages) {
      console.log(JSON.stringify({ operation, page, totalPages: cappedPages, items: items.length }));
    }
  }

  const fileName = `${operation.replace(/^\//, '')}.all.json`;
  const filePath = path.join(dumpDir, fileName);
  await fs.writeFile(filePath, JSON.stringify(items, null, 2), 'utf8');
  return { serviceName: target.serviceName, operation, totalCount, fetchedPages: cappedPages, fetchedItems: items.length, filePath };
}

const summary = [];
for (const target of targets) {
  for (const operation of target.operations) {
    try {
      const result = await localizeTarget(target, operation);
      summary.push(result);
      console.log(JSON.stringify({ ok: true, ...result }));
    } catch (error) {
      const result = { serviceName: target.serviceName, operation, error: String(error?.message || error) };
      summary.push(result);
      console.error(JSON.stringify({ ok: false, ...result }));
    }
  }
}

const summaryPath = path.join(root, 'data', 'public_api_dumps', 'dur_localize_summary.json');
await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
console.log(JSON.stringify({ done: true, summaryPath }));
