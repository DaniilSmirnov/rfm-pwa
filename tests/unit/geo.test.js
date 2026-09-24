import { describe, expect, it } from 'vitest';
import { distanceMeters, bearingDegrees, formatDistance, compassDirection } from '../../src/app/geo.js';

describe('geo helpers',()=>{
  it('distance to same point is zero',()=>expect(distanceMeters({lat:0,lon:0},{lat:0,lon:0})).toBe(0));
  it('one latitude degree is about 111 km',()=>expect(distanceMeters({lat:0,lon:0},{lat:1,lon:0})).toBeGreaterThan(110000));
  it('distance is symmetric',()=>{
    const a={lat:55.75,lon:37.61},b={lat:59.94,lon:30.31};
    expect(distanceMeters(a,b)).toBeCloseTo(distanceMeters(b,a),6);
  });
  it.each([
    [{lat:0,lon:0},{lat:1,lon:0},0],
    [{lat:0,lon:0},{lat:0,lon:1},90],
    [{lat:0,lon:0},{lat:-1,lon:0},180],
    [{lat:0,lon:0},{lat:0,lon:-1},270]
  ])('computes cardinal bearing', (a,b,expected)=>expect(bearingDegrees(a,b)).toBeCloseTo(expected,0));
  it.each([
    [0,'N'],[44,'NE'],[90,'E'],[135,'SE'],[180,'S'],[225,'SW'],[270,'W'],[315,'NW'],[359,'N'],[-1,'N'],[721,'N']
  ])('maps angle to compass sector',(deg,dir)=>expect(compassDirection(deg)).toBe(dir));
  it.each([
    [0,'0 м'],[12.4,'12 м'],[999.6,'1000 м'],[1000,'1.0 км'],[9500,'9.5 км'],[10000,'10 км']
  ])('formats distance',(meters,text)=>expect(formatDistance(meters)).toBe(text));
  it('formats non-finite distance as dash',()=>expect(formatDistance(NaN)).toBe('—'));
});
