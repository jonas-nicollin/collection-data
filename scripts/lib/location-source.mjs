// Optional metadata join. No network requests or site-specific terminology.
export function locationKey(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function coordinate(value, limit) {
  if (value == null || String(value).trim() === '') return null;
  // Google Sheets CSV uses the sheet locale for decimal separators.
  const number = Number(String(value).trim().replace(',', '.'));
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
}
export function joinLocations(items, locations, options) {
  if (!options) return items;
  const index = new Map();
  for (const place of locations) {
    const names = [place.title, place.slug, place.matchKey,
      ...(Array.isArray(place.aliases) ? place.aliases : [])];
    for (const key of new Set(names.map(locationKey))) {
      if (!key) continue;
      const matches = index.get(key) || [];
      matches.push(place); index.set(key, matches);
    }
  }
  return items.map(item => {
    // Rejoining must not retain a stale successful or unsuccessful match.
    const {venue: previousVenue, venueMatch: previousMatch, ...sourceItem} = item;
    let values = [], matchedBy = options.matchField || '';
    if (options.matchField) values = [item[options.matchField]].filter(Boolean);
    else for (const prefix of options.tagPrefixes || []) {
      values = (item.tags || []).filter(tag =>
        locationKey(tag.split(':')[0]) === locationKey(prefix))
        .map(tag => tag.slice(tag.indexOf(':') + 1).trim()).filter(Boolean);
      if (values.length) { matchedBy = prefix; break; }
    }
    values = [...new Set(values.map(locationKey))];
    const matches = values.length === 1 ? index.get(values[0]) || [] : [];
    if (matches.length !== 1) return {...sourceItem, venueMatch: {
      status: values.length > 1 || matches.length > 1 ? 'ambiguous' : 'unresolved',
      matchedBy, values
    }};
    const place = matches[0];
    const latitude = coordinate(place.latitude, 90);
    const longitude = coordinate(place.longitude, 180);
    const location = {
      addressTitle: place.title || '', addressLine1: place.address1 || '',
      addressLine2: place.address2 || '', addressCountry: place.address3 || ''
    };
    if (latitude !== null && longitude !== null) {
      location.mapLat = latitude; location.mapLng = longitude;
    }
    const venue = {key: place.matchKey || place.slug, title: place.title,
      matchedBy, location, openingHours: place.openingHours || {weekly:{}, dates:{}}};
    return {...sourceItem, ...(options.replaceLocation ? {location} : {}), venue};
  });
}
