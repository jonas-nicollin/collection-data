import {test} from 'node:test';
import assert from 'node:assert/strict';
import {joinLocations} from './location-source.mjs';
const places=[{title:'Member',matchKey:'member',latitude:46,longitude:6,openingHours:{weekly:{},dates:{}}},{title:'Venue',matchKey:'venue',latitude:47,longitude:7}];
const cfg={tagPrefixes:['Lieu','Membre']};
test('Explicit venue wins over organizer; absent venue falls back to member',()=>{
 const [a,b]=joinLocations([{tags:['Membre: Member','Lieu: Venue']},{tags:['Membre: Member']}],places,cfg);
 assert.equal(a.venue.key,'venue');assert.equal(b.venue.key,'member');
});
test('Unknown or multiple venues never fall back to member',()=>{
 for(const tags of [['Lieu: Unknown','Membre: Member'],['Lieu: Venue','Lieu: Other','Membre: Member']]){
 const [a]=joinLocations([{tags}],places,cfg);assert(!a.venue);assert(a.venueMatch);
 }
});
test('Opt-in enrichment preserves untouched consumers and rejects duplicate matches',()=>{
 const a=[{title:'Member',location:{mapLat:1,mapLng:2}}];assert.equal(joinLocations(a,places),a);
 const [b]=joinLocations(a,places,{matchField:'title',replaceLocation:true});assert.equal(b.location.mapLat,46);assert.equal(a[0].location.mapLat,1);
 assert(!joinLocations(a,[...places,places[0]],{matchField:'title'})[0].venue);
});
test('Missing coordinates never inherit an old conflicting point',()=>{
 const [a]=joinLocations([{title:'Venue',location:{mapLat:1,mapLng:2}}],[{title:'Venue'}],{matchField:'title',replaceLocation:true});assert.equal(a.location.mapLat,undefined);
});
