import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractSquarespaceNativeVideoMedia,
  normalizeSquarespaceIndexMedia
} from '../scripts/lib/squarespace-index-media.mjs';

const BODY = `
  <div class="sqs-native-video"
    data-config-settings="{&quot;muted&quot;:true,&quot;autoPlay&quot;:true,&quot;loop&quot;:true,&quot;controls&quot;:&quot;none&quot;,&quot;loading&quot;:&quot;lazy&quot;}"
    data-config-video="{&quot;alexandriaUrl&quot;:&quot;https://video.example.test/id/{variant}&quot;,&quot;durationSeconds&quot;:11.56,&quot;aspectRatio&quot;:0.8}">
  </div>`;

test('extracts a Squarespace native video as a public HLS playlist', () => {
  const [media] = extractSquarespaceNativeVideoMedia(BODY, {
    assetUrl: 'https://images.example.test/poster.jpg',
    mediaFocalPoint: { x: 0.4, y: 0.6 }
  });

  assert.equal(media.type, 'video');
  assert.equal(media.url, 'https://video.example.test/id/playlist.m3u8');
  assert.equal(media.mimeType, 'application/vnd.apple.mpegurl');
  assert.equal(media.posterUrl, 'https://images.example.test/poster.jpg');
  assert.equal(media.aspectRatio, 0.8);
  assert.equal(media.autoplay, true);
  assert.equal(media.muted, true);
  assert.equal(media.loop, true);
  assert.equal(media.controls, false);
});

test('keeps the item image as a fallback after the video', () => {
  const media = normalizeSquarespaceIndexMedia({
    title: 'Project',
    assetUrl: 'https://images.example.test/project.jpg',
    body: BODY
  });

  assert.deepEqual(media.map((entry) => entry.type), ['video', 'image']);
  assert.equal(media[1].assetUrl, 'https://images.example.test/project.jpg');
});

test('returns only the image when the item has no native video', () => {
  const media = normalizeSquarespaceIndexMedia({
    title: 'Still project',
    assetUrl: 'https://images.example.test/still.jpg',
    body: '<p>No video</p>'
  });

  assert.deepEqual(media.map((entry) => entry.type), ['image']);
});
