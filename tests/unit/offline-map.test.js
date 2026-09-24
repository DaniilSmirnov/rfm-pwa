import { describe, expect, it } from 'vitest';
import { buildDownloadPlan, offlineVectorSource } from '../../src/offline-map.js';

const fc=coords=>({type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:coords}}]});

describe('offline map planning',()=>{
  it('rejects empty geometry',()=>expect(()=>buildDownloadPlan({features:[]})).toThrow(/нет геометрии/i));
  it('uses zoom 6 as minimum',()=>expect(buildDownloadPlan(fc([[30,60],[30.01,60.01]])).minZoom).toBe(6));
  it('never plans above zoom 14',()=>expect(buildDownloadPlan(fc([[30,60],[30.01,60.01]])).maxZoom).toBeLessThanOrEqual(14));
  it('keeps tile count within budget',()=>expect(buildDownloadPlan(fc([[20,50],[40,65]])).tiles.length).toBeLessThanOrEqual(2200));
  it('contains only tiles at or below advertised max zoom',()=>{
    const plan=buildDownloadPlan(fc([[20,50],[40,65]]));
    expect(Math.max(...plan.tiles.map(t=>t.z))).toBe(plan.maxZoom);
  });
  it('contains no tiles below minimum zoom',()=>{
    const plan=buildDownloadPlan(fc([[30,60],[30.1,60.1]]));
    expect(Math.min(...plan.tiles.map(t=>t.z))).toBe(6);
  });
  it('creates vector source with encoded revision ID',()=>{
    const source=offlineVectorSource('race-1@rev',{minZoom:6,maxZoom:14,bounds:{minLon:1,minLat:2,maxLon:3,maxLat:4}});
    expect(source.tiles[0]).toContain('race-1%40rev');
    expect(source.bounds).toEqual([1,2,3,4]);
  });
  it('defaults vector max zoom to 14',()=>expect(offlineVectorSource('r',{}).maxzoom).toBe(14));
});
