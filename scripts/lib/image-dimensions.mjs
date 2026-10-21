// Metadata only: never download an image to discover its size.
export function imageDimensions(source) {
  if (!source || typeof source !== 'object') return null;
  const candidates = [source.imageDimensions, source.originalSize,
    source.asset?.imageDimensions, source.asset?.originalSize];
  for (const candidate of candidates) {
    const pair = typeof candidate === 'string'
      ? candidate.trim().match(/^(\d+)\s*[x×]\s*(\d+)$/i)?.slice(1)
      : candidate && [candidate.width, candidate.height];
    if (!pair) continue;
    const [width, height] = pair.map(Number);
    if (Number.isSafeInteger(width) && width > 0 &&
        Number.isSafeInteger(height) && height > 0) return { width, height };
  }
  return null;
}

export function imageDimensionsField(source) {
  const dimensions = imageDimensions(source);
  return dimensions ? { imageDimensions: dimensions } : {};
}
