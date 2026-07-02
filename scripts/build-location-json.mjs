import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const DAY_FIELD_TO_OUTPUT = {
  monday: 'lundi',
  tuesday: 'mardi',
  wednesday: 'mercredi',
  thursday: 'jeudi',
  friday: 'vendredi',
  saturday: 'samedi',
  sunday: 'dimanche'
};

const DEFAULT_COLUMNS = {
  title: ['Location', 'Lieu', 'Title', 'Name', 'Nom'],
  zone: ['Zone', 'Area'],
  address1: ['Address', 'Adresse'],
  address2: ['Address 2', 'Adresse 2'],
  postalCode: ['Postal Code', 'Code postal', 'Postcode', 'ZIP'],
  city: ['City', 'Ville'],
  country: ['Country', 'Pays'],
  phone: ['Phone', 'Téléphone', 'Telephone'],
  website: ['Website', 'Site internet'],
  email: ['Email', 'Adresse électronique', 'Adresse electronique'],
  mapUrl: ['Google Maps URL', 'Lien: Google Maps', 'Google Maps'],
  latitude: ['Latitude', 'Lat'],
  longitude: ['Longitude', 'Lng', 'Long'],
  instagram: ['Instagram'],
  facebook: ['Facebook'],
  x: ['X', 'Twitter'],
  youtube: ['Youtube', 'YouTube'],
  linkedin: ['Linkedin', 'LinkedIn'],
  vimeo: ['Vimeo'],
  artsy: ['Artsy'],
  monday: ['Monday', 'Lundi'],
  tuesday: ['Tuesday', 'Mardi'],
  wednesday: ['Wednesday', 'Mercredi'],
  thursday: ['Thursday', 'Jeudi'],
  friday: ['Friday', 'Vendredi'],
  saturday: ['Saturday', 'Samedi'],
  sunday: ['Sunday', 'Dimanche'],
  slug: ['Slug', 'Key', 'ID'],
  image: ['Image', 'Image URL', 'Photo'],
  imagePosition: ['Image Position', 'Image position', 'Focal Point']
};

function toSlug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normHeader(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function parseCSVRows(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (ch === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => String(c || '').trim()));
}

function parseCSV(text) {
  const rows = parseCSVRows(text);
  if (!rows.length) return [];
  const headers = rows[0].map((h) => String(h || '').trim());

  return rows.slice(1).map((values) => {
    const row = {};
    values.forEach((value, index) => {
      row[headers[index] ?? String(index)] = String(value || '').trim();
    });
    return row;
  });
}

function getByColumn(row, columns) {
  const names = Array.isArray(columns) ? columns : [columns].filter(Boolean);
  const normalized = {};

  Object.keys(row || {}).forEach((key) => {
    normalized[normHeader(key)] = key;
  });

  for (const name of names) {
    if (row[name] != null && String(row[name]).trim() !== '') {
      return String(row[name]).trim();
    }

    const normalizedKey = normalized[normHeader(name)];
    if (normalizedKey && row[normalizedKey] != null && String(row[normalizedKey]).trim() !== '') {
      return String(row[normalizedKey]).trim();
    }
  }

  return '';
}

function getField(row, columns, field) {
  return getByColumn(row, columns[field]);
}

function normalizeLocation(row, config) {
  const columns = { ...DEFAULT_COLUMNS, ...(config.columns || {}) };
  const title = getField(row, columns, 'title');
  const postalCode = getField(row, columns, 'postalCode');
  const city = getField(row, columns, 'city');
  const address2 = getField(row, columns, 'address2') || [postalCode, city].filter(Boolean).join(' ');
  const dataField = config.match?.dataField || 'title';

  const location = {
    slug: '',
    matchKey: '',
    title,
    zone: getField(row, columns, 'zone'),
    address1: getField(row, columns, 'address1'),
    address2,
    address3: getField(row, columns, 'country') || config.fallbackCountry || '',
    mapUrl: getField(row, columns, 'mapUrl'),
    latitude: getField(row, columns, 'latitude'),
    longitude: getField(row, columns, 'longitude'),
    phone: getField(row, columns, 'phone'),
    email: getField(row, columns, 'email'),
    website: getField(row, columns, 'website'),
    instagram: getField(row, columns, 'instagram'),
    facebook: getField(row, columns, 'facebook'),
    x: getField(row, columns, 'x'),
    youtube: getField(row, columns, 'youtube'),
    linkedin: getField(row, columns, 'linkedin'),
    vimeo: getField(row, columns, 'vimeo'),
    artsy: getField(row, columns, 'artsy'),
    image: getField(row, columns, 'image'),
    imagePosition: getField(row, columns, 'imagePosition')
  };

  Object.entries(DAY_FIELD_TO_OUTPUT).forEach(([field, output]) => {
    location[output] = getField(row, columns, field) || '-';
  });

  const matchValue = location[dataField] || title;
  location.matchKey = toSlug(matchValue);
  location.slug = toSlug(getField(row, columns, 'slug') || matchValue);

  return location;
}

function stableStringify(value) {
  return JSON.stringify(value, Object.keys(value).sort());
}

function hashItems(items) {
  return createHash('sha256').update(JSON.stringify(items)).digest('hex');
}

async function readExistingJson(outputPath) {
  try {
    return JSON.parse(await readFile(outputPath, 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  const configPath = process.argv[2];
  if (!configPath) {
    throw new Error('Usage: node scripts/build-location-json.mjs sources/pcc-locations.config.json');
  }

  const config = JSON.parse(await readFile(configPath, 'utf8'));
  if (!config.sourceUrl) throw new Error('Missing config.sourceUrl');
  if (!config.output) throw new Error('Missing config.output');

  const response = await fetch(config.sourceUrl);
  if (!response.ok) {
    throw new Error(`Could not fetch CSV: ${response.status} ${response.statusText}`);
  }

  const csv = await response.text();
  const rows = parseCSV(csv);
  const items = rows
    .map((row) => normalizeLocation(row, config))
    .filter((item) => item.title || item.matchKey);

  const sourceHash = hashItems(items);
  const outputPath = resolve(config.output);
  const existing = await readExistingJson(outputPath);

  if (existing?.sourceHash === sourceHash) {
    console.log(`No changes for ${config.output}. ${items.length} items.`);
    return;
  }

  const payload = {
    schemaVersion: 1,
    type: config.type || 'locations',
    site: config.site || '',
    id: config.id || '',
    updatedAt: new Date().toISOString(),
    sourceHash,
    count: items.length,
    items
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Wrote ${config.output}. ${items.length} items.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
