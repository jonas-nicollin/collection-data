import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {joinLocations} from '../scripts/lib/location-source.mjs';
const context = {};
vm.runInNewContext(readFileSync(new URL('../scripts/build-location-json.mjs', import.meta.url),'utf8')
  .replace(/^import .*$/gm,'').split('async function main()')[0], context);
const row = {Location:'Gallery', Address:'Street 1', 'Google Place ID':'ChIJ_verified'};
test('Place IDs are opt-in and empty cells preserve the legacy payload',()=>{
  const legacy=context.normalizeLocation(row,{});
  assert.equal(legacy.placeId,undefined);
  const options={columns:{placeId:['Google Place ID']}};
  assert.equal(context.normalizeLocation(row,options).placeId,'ChIJ_verified');
  assert.equal(JSON.stringify(context.normalizeLocation({...row,'Google Place ID':''},options)),
    JSON.stringify(legacy));
  assert.throws(()=>context.normalizeLocation({...row,'Google Place ID':'https://maps.app.goo.gl/example'},options));
});
test('joined identity follows the resolved venue and is removed when the source no longer supplies it',()=>{
  const native={addressLine1:'Native address'};
  const item={title:'Gallery',location:native};
  const place={title:'Gallery',slug:'gallery',placeId:'ChIJ_verified'};
  const options={matchField:'title'};
  const [joined]=joinLocations([item],[place],options);
  assert.equal(joined.location,native);
  assert.equal(joined.venue.location.placeId,place.placeId);
  const [cleared]=joinLocations([joined],[{...place,placeId:''}],options);
  assert.equal(cleared.venue.location.placeId,undefined);
  assert.equal(joinLocations([item],[place],null)[0],item);
});
