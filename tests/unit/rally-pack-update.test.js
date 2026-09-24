import { describe, expect, it } from 'vitest';
import { rallyPackDiff, updateCompatibility, mergeSafeRaceUpdate } from '../../src/app/rally-pack-update.js';

function pkg(overrides={}){
  return {
    id:'race-1',raceId:1,savedAt:'old',
    original:{schedule:[],coordinates:[],results:[],lists:[],how_it_was:''},
    summary:{status:'old'},assetNames:['a.jpg'],yandexMapEmbed:'same',
    geojson:{type:'FeatureCollection',features:[{type:'Feature',properties:{kind:'race-point'},geometry:{type:'Point',coordinates:[30,60]}}]},
    offlineMap:{ready:true,storageId:'map'},terrain:{ready:true,storageId:'dem'},
    ...overrides
  };
}

describe('smart Rally Pack updates',()=>{
  it('reports user-facing change groups',()=>{
    const current=pkg();
    const fresh=pkg({original:{...current.original,schedule:[{date:'1.1'}]},summary:{status:'new'},assetNames:['a.jpg','b.jpg']});
    expect(rallyPackDiff(current,fresh).map(x=>x.key)).toEqual(expect.arrayContaining(['schedule','materials','info']));
  });
  it('requires full update when race geometry changes',()=>{
    const current=pkg();
    const fresh=pkg({geojson:{type:'FeatureCollection',features:[{type:'Feature',properties:{kind:'race-point'},geometry:{type:'Point',coordinates:[31,60]}}]}});
    expect(updateCompatibility(current,fresh)).toEqual({safe:false,reason:'geometry'});
  });
  it('preserves downloaded map terrain and yandex snapshot for safe data update',()=>{
    const current=pkg({geojson:{type:'FeatureCollection',features:[
      {type:'Feature',properties:{kind:'race-point'},geometry:{type:'Point',coordinates:[30,60]}},
      {type:'Feature',properties:{source:'yandex-constructor'},geometry:{type:'Point',coordinates:[30.1,60.1]}}
    ]}});
    const fresh=pkg({summary:{status:'new'}});
    const merged=mergeSafeRaceUpdate(current,fresh,[{key:'info',label:'Информация'}],new Date('2026-09-24T00:00:00Z'));
    expect(merged.offlineMap.storageId).toBe('map');
    expect(merged.terrain.storageId).toBe('dem');
    expect(merged.geojson.features.some(f=>f.properties?.source==='yandex-constructor')).toBe(true);
    expect(merged.lastSmartUpdate.changes).toHaveLength(1);
  });
});
