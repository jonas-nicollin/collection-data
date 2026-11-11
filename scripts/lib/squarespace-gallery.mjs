import { imageDimensionsField } from './image-dimensions.mjs';

function decode(value) {
  return String(value || '').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));
}

function attributes(tag) {
  return Object.fromEntries(Array.from(tag.matchAll(
    /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
  ), match => [match[1].toLowerCase(), decode(match[2] ?? match[3])]));
}

// Only native gallery images in the supplied collection body. No extra requests.
export function extractSquarespaceGallery(body) {
  const html = String(body || '').replace(/<(noscript|script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  const stack = [], images = [], seen = new Set();
  for (const match of html.matchAll(/<\/?(?:div|img)\b[^>]*>/gi)) {
    const tag = match[0];
    if (/^<\/div/i.test(tag)) { stack.pop(); continue; }
    const attr = attributes(tag);
    if (/^<div/i.test(tag)) {
      stack.push(stack.at(-1) || /(?:^|\s)(?:sqs-block-gallery|gallery-block)(?:\s|$)/.test(attr.class || ''));
      continue;
    }
    if (!stack.at(-1)) continue;
    const assetUrl = attr['data-src'] || attr['data-image'] || attr.src;
    if (!assetUrl || !/^https?:\/\//.test(assetUrl) || seen.has(assetUrl)) continue;
    seen.add(assetUrl);
    const focal = (attr['data-image-focal-point'] || '0.5,0.5').split(',').map(Number);
    images.push({
      type: 'image', assetUrl,
      ...imageDimensionsField({ imageDimensions: attr['data-image-dimensions'] }),
      mediaFocalPoint: focal.length === 2 && focal.every(n => n >= 0 && n <= 1)
        ? { x: focal[0], y: focal[1] } : { x: 0.5, y: 0.5 },
      alt: attr.alt || ''
    });
  }
  return images;
}

export function withNativeGallery(output, source, enabled) {
  if (enabled !== true) return output;
  return { ...output, gallery: extractSquarespaceGallery(source?.body) };
}
