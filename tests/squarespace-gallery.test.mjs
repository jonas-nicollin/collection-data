import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSquarespaceGallery, withNativeGallery } from '../scripts/lib/squarespace-gallery.mjs';

test('native gallery preserves order and focal points without inline/noscript duplicates', () => {
  const body = `<img src="https://example.com/cover.jpg">
    <div class="sqs-block-gallery"><div><noscript><img src="https://example.com/one.jpg"></noscript>
    <img data-src="https://example.com/one.jpg" data-image-dimensions="1600x2000"
      data-image-focal-point="0.2,0.8" alt="A &amp; B"></div>
    <img data-src="https://example.com/two.jpg"><img data-src="https://example.com/one.jpg"></div>
    <img src="https://example.com/outside.jpg">`;
  const images = extractSquarespaceGallery(body);
  assert.deepEqual(images.map(i => i.assetUrl), ['https://example.com/one.jpg', 'https://example.com/two.jpg']);
  assert.deepEqual(images[0].mediaFocalPoint, { x: 0.2, y: 0.8 });
  assert.deepEqual(images[0].imageDimensions, { width: 1600, height: 2000 });
  assert.equal(images[0].alt, 'A & B');
});

test('disabled option leaves every existing field untouched', () => {
  const output = { assetUrl: 'cover', media: [{ type: 'video' }], tags: ['A'] };
  for (const setting of [undefined, false, 'true']) {
    assert.strictEqual(withNativeGallery(output, { body: '' }, setting), output);
  }
  const result = withNativeGallery(output, { body: '' }, true);
  assert.deepEqual(result, { ...output, gallery: [] });
  assert.deepEqual(output, { assetUrl: 'cover', media: [{ type: 'video' }], tags: ['A'] });
});
