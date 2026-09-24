import { describe, expect, it } from 'vitest';
import { buildTerrainDownloadPlan, offlineTerrainSource, terrainBounds } from '../../src/terrain-offline.js';

const fc=coords=>({type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:coords}}]});

describe('terrain offline planning',()=>{
  it('rejects empty geometry',()=>expect(()=>buildTerrainDownloadPlan({features:[]})).toThrow(/нет геометрии/i));
  it('uses a buffered race area',()=>{
    const bounds=terrainBounds(fc([[30,60],[30.1,60.1]]));
    expect(bounds.minLon).toBeLessThan(30);
    expect(bounds.maxLon).toBeGreaterThan(30.1);
  });
  it('plans DEM from z6 and never above z12',()=>{
    const plan=buildTerrainDownloadPlan(fc([[30,60],[30.05,60.05]]));
    expect(plan.minZoom).toBe(6);
    expect(plan.maxZoom).toBeLessThanOrEqual(12);
    expect(Math.min(...plan.tiles.map(t=>t.z))).toBe(6);
    expect(Math.max(...plan.tiles.map(t=>t.z))).toBe(plan.maxZoom);
  });
  it('keeps terrain tile count inside its independent budget',()=>{
    expect(buildTerrainDownloadPlan(fc([[20,50],[40,65]])).tiles.length).toBeLessThanOrEqual(1800);
  });
  it('creates a terrarium raster-dem source using the terrain namespace',()=>{
    const source=offlineTerrainSource({ready:true,storageId:'race-1@terrain@rev',minZoom:6,maxZoom:12,tileSize:512,encoding:'terrarium',bounds:{minLon:1,minLat:2,maxLon:3,maxLat:4}});
    expect(source.type).toBe('raster-dem');
    expect(source.encoding).toBe('terrarium');
    expect(source.tileSize).toBe(512);
    expect(source.tiles[0]).toContain('race-1%40terrain%40rev');
    expect(source.bounds).toEqual([1,2,3,4]);
  });
  it('does not expose a source before terrain is downloaded',()=>expect(offlineTerrainSource(null)).toBeNull());
});
