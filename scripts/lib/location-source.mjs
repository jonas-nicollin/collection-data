// Optional metadata join. No network requests or site-specific terminology.
export function locationKey(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function coordinate(value, limit) {
  if (value == null || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
}
export function joinLocations(items, locations, options) {
  if (!options) return items;
  const index = new Map();
  for (const place of locations) {
    for (const key of new Set([place.title, place.slug, place.matchKey].map(locationKey))) {
      if (!key) continue;
      const matches = index.get(key) || [];
      matches.push(place); index.set(key, matches);
    }
  }
  return items.map(item => {
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
    if (matches.length !== 1) return {...item, venueMatch: {
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
    return {...item, ...(options.replaceLocation ? {location} : {}), venue};
  });
}
