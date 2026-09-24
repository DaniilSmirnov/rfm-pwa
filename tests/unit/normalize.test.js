import { describe, expect, it } from 'vitest';
import { hashId, collectGeoJson, normalizePackage, geometryBounds } from '../../src/normalize.js';

describe('normalize',()=>{
  it('hash is deterministic',()=>expect(hashId('abc')).toBe(hashId('abc')));
  it('hash changes with input',()=>expect(hashId('abc')).not.toBe(hashId('abd')));
  it('collects a FeatureCollection',()=>{
    const f={type:'Feature',properties:{},geometry:{type:'Point',coordinates:[1,2]}};
    expect(collectGeoJson({type:'FeatureCollection',features:[f]}).features).toEqual([f]);
  });
  it('wraps bare geometry into Feature',()=>expect(collectGeoJson({type:'Point',coordinates:[1,2]}).features[0].type).toBe('Feature'));
  it('finds nested geometries',()=>expect(collectGeoJson({a:{b:{type:'Point',coordinates:[1,2]}}}).features).toHaveLength(1));
  it('ignores unsupported geometries',()=>expect(collectGeoJson({type:'GeometryCollection',geometries:[]}).features).toHaveLength(0));
  it('uses package name from input',()=>expect(normalizePackage({name:'Rally',type:'Point',coordinates:[1,2]}).name).toBe('Rally'));
  it('uses feature name when root name absent',()=>expect(normalizePackage({type:'Feature',properties:{name:'Point'},geometry:{type:'Point',coordinates:[1,2]}}).name).toBe('Point'));
  it('falls back to imported package name',()=>expect(normalizePackage({foo:'bar'}).name).toBe('Импортированный пакет'));
  it('calculates mixed-geometry bounds',()=>{
    const fc={features:[
      {geometry:{type:'Point',coordinates:[10,20]}},
      {geometry:{type:'LineString',coordinates:[[5,30],[15,10]]}}
    ]};
    expect(geometryBounds(fc)).toEqual({minLon:5,minLat:10,maxLon:15,maxLat:30});
  });
  it('returns null bounds for empty collection',()=>expect(geometryBounds({features:[]})).toBeNull());
});
