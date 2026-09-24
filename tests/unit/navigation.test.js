import { describe, expect, it } from 'vitest';
import { normalizePoint, googleMapsDirections, googleMapsPoint, yandexNavigatorLink, yandexWebFallback, mapsMeLink, mapsMeWebFallback, coordinateText } from '../../src/navigation.js';

describe('navigation',()=>{
  it('normalizes lat/lon',()=>expect(normalizePoint({lat:'55.75',lon:'37.61',name:'A'})).toEqual({lat:55.75,lon:37.61,name:'A'}));
  it('accepts latitude/longitude aliases',()=>expect(normalizePoint({latitude:1,longitude:2})).toEqual({lat:1,lon:2,name:'Точка RallyFansMap'}));
  it.each([{lat:'x',lon:1},{lat:1,lon:undefined},null])('rejects invalid point',point=>expect(()=>normalizePoint(point)).toThrow('Invalid coordinates'));
  it('builds Google directions URL',()=>expect(googleMapsDirections({lat:1,lon:2})).toContain('destination=1%2C2'));
  it('builds Google point URL',()=>expect(googleMapsPoint({lat:1,lon:2})).toContain('query=1%2C2'));
  it('builds Yandex navigator URL',()=>expect(yandexNavigatorLink({lat:1,lon:2})).toBe('yandexnavi://build_route_on_map?lat_to=1&lon_to=2'));
  it('builds Yandex web lon/lat order',()=>expect(yandexWebFallback({lat:1,lon:2})).toContain('pt=2%2C1'));
  it('builds MAPS.ME URL with name',()=>expect(mapsMeLink({lat:1,lon:2,name:'Test Point'})).toContain('n=Test%20Point'));
  it('returns MAPS.ME web fallback',()=>expect(mapsMeWebFallback()).toBe('https://maps.me/'));
  it('formats coordinates to six decimals',()=>expect(coordinateText({lat:1.2,lon:2.3})).toBe('1.200000, 2.300000'));
});
