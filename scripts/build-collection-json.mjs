import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_CONFIG = 'sources/collections/pcc.json';
const DEFAULT_OUTPUT_DIR = 'public/data/collections';
const MAX_FETCH_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [1000, 3000];

const KEEP_FIELDS = [
  'id',
  'title',
  'fullUrl',
  'sourceUrl',
  'urlId',
  'assetUrl',
  'mediaFocalPoint',
  'media',
  'categories',
  'categoryOrder',
  'tags',
  'excerpt',
  'location',
  'displayIndex',
  'workflowState',
  'starred',
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

function collectNestedCategories(value, output = new Map()) {
  if (!value || typeof value !== 'object') return output;

  if (Array.isArray(value)) {
    value.forEach((entry) => collectNestedCategories(entry, output));
    return output;
  }

  if (value.id && value.displayName) {
    output.set(String(value.id), {
      id: String(value.id),
      displayName: String(value.displayName).trim(),
      fullUrl: value.fullUrl || null
    });
  }

  if (Array.isArray(value.categories)) {
    collectNestedCategories(value.categories, output);
  }

  if (Array.isArray(value.children)) {
    collectNestedCategories(value.children, output);
  }

  return output;
}

function normalizeProductMedia(item) {
  const media = Array.isArray(item?.items) ? item.items : [];
  const seen = new Set();

  return media
    .slice()
    .sort((a, b) => Number(a?.displayIndex || 0) - Number(b?.displayIndex || 0))
    .map((entry) => {
      const assetUrl = entry?.assetUrl || entry?.asset?.url || null;
      if (!assetUrl || seen.has(assetUrl)) return null;
      seen.add(assetUrl);

      return {
        assetUrl,
        mediaFocalPoint: entry.mediaFocalPoint || entry?.asset?.mediaFocalPoint || null,
        title: entry.title || entry.filename || ''
      };
    })
    .filter(Boolean);
}

function cloneEssentialItem(item, options = {}) {
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

  if (options.adapter === 'squarespace-products') {
    const categoryMap = options.categoryMap || new Map();
    const categoryIds = Array.isArray(item?.categoryIds) ? item.categoryIds : [];
    const categories = categoryIds
      .map((id) => categoryMap.get(String(id))?.displayName)
      .filter(Boolean);
    const media = normalizeProductMedia(item);

    output.categories = categories;
    output.media = media;
    output.sourceType = 'product';

    if (media.length) {
      output.assetUrl = media[0].assetUrl;
      output.mediaFocalPoint = media[0].mediaFocalPoint || output.mediaFocalPoint || null;
    }
  }

  return output;
}

function hashItems(items) {
  return createHash('sha256')
    .update(JSON.stringify(items))
    .digest('hex');
}

function stablePayload(data) {
  if (!data || typeof data !== 'object') return null;

  return {
    schemaVersion: data.schemaVersion,
    type: data.type,
    site: data.site,
    id: data.id,
    path: data.path,
    sourceUrl: data.sourceUrl,
    sourceHash: data.sourceHash,
    count: data.count,
    pages: data.pages,
    items: data.items
  };
}

function payloadIsUnchanged(existingPayload, nextPayload) {
  if (!existingPayload) return false;
  return JSON.stringify(stablePayload(existingPayload)) === JSON.stringify(nextPayload);
}

function mergeSetCookie(cookieHeader, cookies) {
  if (!cookieHeader) return cookies;

  String(cookieHeader)
    .split(/,(?=\s*[^;,=\s]+=[^;,]+)/)
    .forEach((part) => {
      const first = part.split(';')[0].trim();
      const eq = first.indexOf('=');
      if (eq > 0) {
        cookies.set(first.slice(0, eq), first.slice(eq + 1));
      }
    });

  return cookies;
}

function cookieHeader(cookies) {
  return Array.from(cookies.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
  return status === 429 || status >= 500;
}

async function waitBeforeRetry(url, attempt, reason) {
  const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
  console.warn(
    `Retrying ${url} in ${delay}ms ` +
    `(attempt ${attempt + 2}/${MAX_FETCH_ATTEMPTS}: ${reason})`
  );
  await wait(delay);
}

async function fetchJson(url, cookies) {
  for (let attempt = 0; attempt < MAX_FETCH_ATTEMPTS; attempt += 1) {
    const headers = {
      accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
      'accept-language': 'fr-CH,fr;q=0.9,en;q=0.8',
      'cache-control': 'no-cache',
      pragma: 'no-cache',
      referer: new URL(url).origin,
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
    };

    const cookie = cookieHeader(cookies);
    if (cookie) headers.cookie = cookie;

    let res;

    try {
      res = await fetch(url, {
        headers,
        redirect: 'follow'
      });
    } catch (error) {
      if (attempt >= MAX_FETCH_ATTEMPTS - 1) throw error;
      await waitBeforeRetry(url, attempt, error?.cause?.code || error?.message || 'network error');
      continue;
    }

    mergeSetCookie(res.headers.get('set-cookie'), cookies);

    if (res.ok) {
      return res.json();
    }

    if ((res.status === 401 || res.status === 403) && attempt === 0 && cookies.size) {
      continue;
    }

    if (isRetryableStatus(res.status) && attempt < MAX_FETCH_ATTEMPTS - 1) {
      await waitBeforeRetry(url, attempt, `HTTP ${res.status}`);
      continue;
    }

    throw new Error(`HTTP ${res.status} while fetching ${url}`);
  }

  throw new Error(`Unable to fetch ${url}`);
}

async function mapWithConcurrency(values, concurrency, worker) {
  const queue = values.slice();
  const results = [];
  const workerCount = Math.max(1, Math.min(Number(concurrency || 4), queue.length || 1));

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (queue.length) {
      const value = queue.shift();
      results.push(await worker(value));
    }
  }));

  return results;
}

async function fetchOrderedCategoryItems(category, collection, cookies) {
  if (!category?.fullUrl) return { category, ids: [] };

  let url = ensureJson(new URL(category.fullUrl, collection.url).toString());
  const ids = [];
  const visited = new Set();

  while (url && !visited.has(url)) {
    visited.add(url);
    const data = await fetchJson(url, cookies);
    extractItems(data).forEach((item) => {
      if (item?.id) ids.push(String(item.id));
    });
    url = extractNextUrl(data, url);
  }

  return { category, ids };
}

async function addCategoryOrder(items, categoryMap, collection, cookies) {
  const categoryOptions = collection.categoryOrder || {};
  if (categoryOptions.strategy !== 'category-pages') return items;

  const categories = Array.from(categoryMap.values()).filter((category) => category.fullUrl);
  const orderedCategories = await mapWithConcurrency(
    categories,
    categoryOptions.concurrency || 4,
    (category) => fetchOrderedCategoryItems(category, collection, cookies)
  );
  const itemById = new Map(items.map((item) => [String(item.id || ''), item]));

  orderedCategories.forEach(({ category, ids }) => {
    ids.forEach((id, index) => {
      const item = itemById.get(id);
      if (!item) return;
      if (!item.categoryOrder) item.categoryOrder = {};
      item.categoryOrder[category.displayName] = index;
    });
  });

  return items;
}

async function fetchAllCollectionItems(collection) {
  let url = ensureJson(collection.url);
  const rawItems = [];
  const visited = new Set();
  const cookies = new Map();
  const categoryMap = new Map();
  let pages = 0;

  while (url && !visited.has(url)) {
    visited.add(url);
    const data = await fetchJson(url, cookies);
    collectNestedCategories(data?.nestedCategories, categoryMap);
    rawItems.push(...extractItems(data));
    pages += 1;
    url = extractNextUrl(data, url);
  }

  const items = rawItems.map((item) => cloneEssentialItem(item, {
    adapter: collection.adapter,
    categoryMap
  }));

  await addCategoryOrder(items, categoryMap, collection, cookies);

  return { items, pages };
}

async function readExistingJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    if (error instanceof SyntaxError) {
      console.warn(`Existing output is invalid JSON and will be replaced: ${filePath}`);
      return null;
    }
    throw error;
  }
}

async function writeJson(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function listJsonFiles(directory) {
  let entries;

  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }

  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listJsonFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(entryPath);
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

async function buildManifest(outputRoot, manifestPath) {
  const files = {};
  const collectionFiles = await listJsonFiles(outputRoot);

  for (const filePath of collectionFiles) {
    const payload = await readExistingJson(filePath);
    if (payload?.type !== 'squarespace-collection' || !payload.sourceHash) continue;

    const relativePath = path.relative(outputRoot, filePath).split(path.sep).join('/');
    files[relativePath] = {
      sourceHash: payload.sourceHash,
      updatedAt: payload.updatedAt || null,
      count: Number(payload.count || 0),
      pages: Number(payload.pages || 0)
    };
  }

  const latestUpdatedAt = Object.values(files)
    .map((entry) => entry.updatedAt)
    .filter(Boolean)
    .sort()
    .at(-1) || null;
  const manifest = {
    schemaVersion: 1,
    type: 'collection-data-manifest',
    updatedAt: latestUpdatedAt,
    files
  };
  const existingManifest = await readExistingJson(manifestPath);

  if (JSON.stringify(existingManifest) === JSON.stringify(manifest)) {
    console.log(`Unchanged ${manifestPath} (${Object.keys(files).length} collections)`);
    return;
  }

  await writeJson(manifestPath, manifest);
  console.log(`Wrote ${manifestPath} (${Object.keys(files).length} collections)`);
}

async function main() {
  const configPath = process.argv.find((arg) => !arg.startsWith('--') && arg.endsWith('.json')) || DEFAULT_CONFIG;
  const outputRoot = argValue('--output', DEFAULT_OUTPUT_DIR);
  const manifestPath = argValue('--manifest', path.join(outputRoot, '..', 'manifest.json'));
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
    const nextPayload = {
      schemaVersion: 1,
      type: 'squarespace-collection',
      site,
      id: collection.id,
      path: collection.path || null,
      sourceUrl: collection.url,
      sourceHash,
      count: result.items.length,
      pages: result.pages,
      items: result.items
    };

    const outputPath = path.join(outputRoot, site, `${collection.id}.json`);
    const existingPayload = await readExistingJson(outputPath);
    const unchanged = payloadIsUnchanged(existingPayload, nextPayload);
    const status = unchanged ? 'unchanged' : existingPayload ? 'changed' : 'new';

    if (dryRun) {
      console.log(`${collection.id}: ${status}, ${nextPayload.count} items, ${nextPayload.pages} pages, ${sourceHash.slice(0, 12)}`);
      continue;
    }

    if (unchanged) {
      console.log(`Unchanged ${outputPath} (${nextPayload.count} items, ${nextPayload.pages} pages)`);
      continue;
    }

    const payload = {
      schemaVersion: nextPayload.schemaVersion,
      type: nextPayload.type,
      site: nextPayload.site,
      id: nextPayload.id,
      path: nextPayload.path,
      sourceUrl: nextPayload.sourceUrl,
      updatedAt: new Date().toISOString(),
      sourceHash: nextPayload.sourceHash,
      count: nextPayload.count,
      pages: nextPayload.pages,
      items: nextPayload.items
    };

    await writeJson(outputPath, payload);
    console.log(`Wrote ${outputPath} (${payload.count} items, ${payload.pages} pages)`);
  }

  if (!dryRun) {
    await buildManifest(outputRoot, manifestPath);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
