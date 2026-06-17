import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_CONFIG = 'sources/collections/pcc.json';
const DEFAULT_OUTPUT_DIR = 'public/data/collections';

const KEEP_FIELDS = [
  'id',
  'title',
  'fullUrl',
  'urlId',
  'assetUrl',
  'mediaFocalPoint',
  'categories',
  'tags',
  'excerpt',
  'location',
  'displayIndex',
  'workflowState',
  'startDate',
  'publishOn',
  'addedOn',
  'updatedOn'
];

function argValue(name, fallback = null) {
  const prefix = `${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function ensureJson(url) {
  if (!url) return url;
  if (url.includes('format=json')) return url;
  return url.includes('?') ? `${url}&format=json` : `${url}?format=json`;
}

function absoluteNextUrl(nextUrl, currentUrl) {
  if (!nextUrl) return null;
  return new URL(nextUrl, currentUrl).toString();
}

function nextOffsetUrl(offset, currentUrl) {
  if (offset == null) return null;
  const url = new URL(currentUrl);
  url.searchParams.set('format', 'json');
  url.searchParams.set('offset', String(offset));
  return url.toString();
}

function extractItems(data) {
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.itemList)) return data.itemList;
  if (Array.isArray(data?.collection?.items)) return data.collection.items;
  return [];
}

function extractNextUrl(data, currentUrl) {
  const pagination = data?.pagination || null;
  if (!pagination) return null;
  if (pagination.nextPageUrl) return ensureJson(absoluteNextUrl(pagination.nextPageUrl, currentUrl));
  if (pagination.nextPage && pagination.nextPageOffset != null) {
    return nextOffsetUrl(pagination.nextPageOffset, currentUrl);
  }
  return null;
}

function cloneEssentialItem(item) {
  const output = {};

  KEEP_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(item, field)) {
      output[field] = item[field];
    }
  });

  if (!output.assetUrl && item?.asset?.url) {
    output.assetUrl = item.asset.url;
  }

  if (!output.mediaFocalPoint && item?.asset?.mediaFocalPoint) {
    output.mediaFocalPoint = item.asset.mediaFocalPoint;
  }

  return output;
}

function hashItems(items) {
  return createHash('sha256')
    .update(JSON.stringify(items))
    .digest('hex');
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      accept: 'application/json'
    }
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} while fetching ${url}`);
  }

  return res.json();
}

async function fetchAllCollectionItems(collection) {
  let url = ensureJson(collection.url);
  const items = [];
  const visited = new Set();
  let pages = 0;

  while (url && !visited.has(url)) {
    visited.add(url);
    const data = await fetchJson(url);
    const batch = extractItems(data).map(cloneEssentialItem);
    items.push(...batch);
    pages += 1;
    url = extractNextUrl(data, url);
  }

  return { items, pages };
}

async function writeJson(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function main() {
  const configPath = process.argv.find((arg) => !arg.startsWith('--') && arg.endsWith('.json')) || DEFAULT_CONFIG;
  const outputRoot = argValue('--output', DEFAULT_OUTPUT_DIR);
  const dryRun = process.argv.includes('--dry-run');

  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const site = config.site || 'site';
  const collections = Array.isArray(config.collections) ? config.collections : [];

  if (!collections.length) {
    throw new Error(`No collections found in ${configPath}`);
  }

  for (const collection of collections) {
    if (!collection.id || !collection.url) {
      throw new Error('Each collection needs at least id and url.');
    }

    const result = await fetchAllCollectionItems(collection);
    const sourceHash = hashItems(result.items);
    const payload = {
      schemaVersion: 1,
      type: 'squarespace-collection',
      site,
      id: collection.id,
      path: collection.path || null,
      sourceUrl: collection.url,
      updatedAt: new Date().toISOString(),
      sourceHash,
      count: result.items.length,
      pages: result.pages,
      items: result.items
    };

    const outputPath = path.join(outputRoot, site, `${collection.id}.json`);

    if (dryRun) {
      console.log(`${collection.id}: ${payload.count} items, ${payload.pages} pages, ${sourceHash.slice(0, 12)}`);
      continue;
    }

    await writeJson(outputPath, payload);
    console.log(`Wrote ${outputPath} (${payload.count} items, ${payload.pages} pages)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
