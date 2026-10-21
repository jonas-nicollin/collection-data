import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imageDimensions, imageDimensionsField } from '../scripts/lib/image-dimensions.mjs';
import { normalizeSquarespaceIndexMedia } from '../scripts/lib/squarespace-index-media.mjs';
test('reads native and normalized metadata without fetching images', () => {
 for(const source of [{originalSize:'1500x2262'}, {asset:{originalSize:'1500x2262'}}, {imageDimensions:{width:1500,height:2262}}])
  assert.deepEqual(imageDimensions(source),{width:1500,height:2262});
});
test('missing, invalid and unsafe dimensions are omitted', () => {
 for(const originalSize of [null,'0x120','300x-40','300.5x400','x200','9007199254740992x20'])
  assert.deepEqual(imageDimensionsField({originalSize}),{});
 assert.equal(imageDimensions({imageDimensions:{width:100,height:Infinity}}),null);
});
test('index images retain intrinsic size without changing the video contract', () => {
 const media=normalizeSquarespaceIndexMedia({assetUrl:'https://example.com/a.jpg', originalSize:'900x600',title:'A'});
 assert.deepEqual(media[0].imageDimensions,{width:900,height:600});
 assert.equal(media[0].type,'image');
 assert.equal(media[0].assetUrl,'https://example.com/a.jpg');
});
