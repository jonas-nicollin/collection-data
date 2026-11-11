const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');
const file = process.env.LOCATION_BUILDER || path.join(__dirname,'../scripts/build-location-json.mjs');
const context = {};
vm.runInNewContext(fs.readFileSync(file,'utf8').replace(/^import .*$/gm,'')
  .split('async function main()')[0],context);
test('Structured hours opt in without changing legacy fields', () => {
  const row = {Location:'Example',Monday:'11h–18h',Horaires:'lundi: 12h–19h',
    'Edition hours':'2026-09-20: Fermé'};
  const legacy = context.normalizeLocation(row,{});
  assert.equal(legacy.lundi,'11h–18h');
  assert(!legacy.openingHours);
  const current = context.normalizeLocation(row,{columns:{hours:['Horaires'],
    datedHours:['Edition hours']}});
  assert.equal(current.lundi,legacy.lundi);
  assert.equal(current.openingHours.weekly.lundi,'12h–19h');
  assert.equal(current.openingHours.dates['2026-09-20'],'Fermé');
  assert.equal(current.openingHours.weekly.mardi,undefined);
});
test('Empty optional columns leave existing records unchanged', () => {
  const row = {Location:'Example',Horaires:'','Edition hours':''};
  assert.equal(JSON.stringify(context.normalizeLocation(row,{})),
    JSON.stringify(context.normalizeLocation(row,{columns:{hours:['Horaires'],
      datedHours:['Edition hours']}})));
});
test('Malformed, duplicate and impossible dates fail instead of publishing', () => {
  for (const value of ['2026-02-30: Fermé','bad: 12h–18h',
    '2026-09-20: Fermé\n2026-09-20: 11h–18h'])
    assert.throws(()=>context.parseHoursLines(value,true));
  assert.throws(()=>context.parseHoursLines('lundi: Fermé\nlundi: 11h–18h',false));
});
