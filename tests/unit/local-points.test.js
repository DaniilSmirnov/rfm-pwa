// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  FAVORITES_KEY, CAR_POINT_KEY, pointKey, favoritesForPackage, isFavoritePoint,
  setFavoritePoint, loadCarPoint, saveCarPoint, deleteCarPoint
} from '../../src/app/local-points.js';

beforeEach(()=>localStorage.clear());

describe('local points persistence',()=>{
  it('builds stable point key',()=>expect(pointKey({lat:1.2345678,lon:2.3456789,name:'A'})).toBe('1.234568:2.345679:A'));
  it('starts with no favorites',()=>expect(favoritesForPackage('race-1')).toEqual([]));
  it('adds a favorite',()=>{
    setFavoritePoint({lat:1,lon:2,name:'A'},true,'race-1');
    expect(favoritesForPackage('race-1')).toHaveLength(1);
    expect(isFavoritePoint({lat:1,lon:2,name:'A'},'race-1')).toBe(true);
  });
  it('does not duplicate a favorite',()=>{
    setFavoritePoint({lat:1,lon:2,name:'A'},true,'race-1');
    setFavoritePoint({lat:1,lon:2,name:'A'},true,'race-1');
    expect(favoritesForPackage('race-1')).toHaveLength(1);
  });
  it('separates favorites by package',()=>{
    setFavoritePoint({lat:1,lon:2,name:'A'},true,'race-1');
    expect(favoritesForPackage('race-2')).toEqual([]);
  });
  it('removes favorite and empty package bucket',()=>{
    setFavoritePoint({lat:1,lon:2,name:'A'},true,'race-1');
    setFavoritePoint({lat:1,lon:2,name:'A'},false,'race-1');
    expect(favoritesForPackage('race-1')).toEqual([]);
    expect(JSON.parse(localStorage.getItem(FAVORITES_KEY)||'{}')).toEqual({});
  });
  it('recovers from malformed favorites JSON',()=>{
    localStorage.setItem(FAVORITES_KEY,'{bad');
    expect(favoritesForPackage('race-1')).toEqual([]);
  });
  it('saves car point with canonical name',()=>{
    const point=saveCarPoint({latitude:1,longitude:2,name:'ignored'});
    expect(point).toMatchObject({lat:1,lon:2,name:'Машина'});
    expect(loadCarPoint()).toMatchObject({lat:1,lon:2,name:'Машина'});
  });
  it('returns null for malformed car point',()=>{
    localStorage.setItem(CAR_POINT_KEY,JSON.stringify({lat:'x',lon:2}));
    expect(loadCarPoint()).toBeNull();
  });
  it('deletes car point',()=>{
    saveCarPoint({lat:1,lon:2});
    deleteCarPoint();
    expect(loadCarPoint()).toBeNull();
  });
});
