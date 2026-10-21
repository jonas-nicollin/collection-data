import { imageDimensionsField } from './image-dimensions.mjs';

function decodeHtmlAttribute(value) {
  return String(value || '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function readJsonAttribute(tag, name) {
  const match = String(tag || '').match(new RegExp(`${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'));
  if (!match) return null;

  try {
    return JSON.parse(decodeHtmlAttribute(match[2]));
  } catch {
    return null;
  }
}

function playlistUrl(alexandriaUrl) {
  const value = String(alexandriaUrl || '').trim();
  if (!value) return '';
  return value.includes('{variant}')
    ? value.replace('{variant}', 'playlist.m3u8')
    : value;
}

export function extractSquarespaceNativeVideoMedia(body, fallback = {}) {
  const tags = String(body || '').match(/<div\b[^>]*\bsqs-native-video\b[^>]*>/gi) || [];

  return tags.map((tag) => {
    const video = readJsonAttribute(tag, 'data-config-video');
    const settings = readJsonAttribute(tag, 'data-config-settings') || {};
    const url = playlistUrl(video?.alexandriaUrl);
    if (!video || !url) return null;

    const aspectRatio = Number(video.aspectRatio);
    const durationSeconds = Number(video.durationSeconds);

    return {
      type: 'video',
      url,
      mimeType: 'application/vnd.apple.mpegurl',
      posterUrl: fallback.assetUrl || null,
      mediaFocalPoint: fallback.mediaFocalPoint || null,
      aspectRatio: Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : null,
      durationSeconds: Number.isFinite(durationSeconds) && durationSeconds >= 0 ? durationSeconds : null,
      autoplay: settings.autoPlay !== false,
      muted: settings.muted !== false,
      loop: settings.loop !== false,
      controls: settings.controls !== 'none' && settings.controls !== false,
      loading: settings.loading || 'lazy'
    };
  }).filter(Boolean);
}

export function normalizeSquarespaceIndexMedia(item) {
  const assetUrl = item?.assetUrl || item?.asset?.url || null;
  const mediaFocalPoint = item?.mediaFocalPoint || item?.asset?.mediaFocalPoint || null;
  const videos = extractSquarespaceNativeVideoMedia(item?.body, { assetUrl, mediaFocalPoint });
  const media = videos.slice();

  if (assetUrl) {
    media.push({
      type: 'image',
      assetUrl,
      ...imageDimensionsField(item),
      mediaFocalPoint,
      title: item?.title || item?.filename || ''
    });
  }

  return media;
}
