import { describe, expect, it } from 'vitest';
import { terrariumElevation, terrainPixel, sampleRouteCoordinates } from '../../src/app/elevation.js';

describe('elevation helpers',()=>{
  it('decodes Terrarium RGB elevation',()=>{
    expect(terrariumElevation(128,0,0)).toBe(0);
    expect(terrariumElevation(128,100,128)).toBeCloseTo(100.5,5);
  });
  it('maps coordinates into DEM tile pixels',()=>{
    const p=terrainPixel(0,0,6,512);
    expect(p).toMatchObject({z:6,x:32,y:32,px:0,py:0});
  });
  it('samples a route while preserving endpoints',()=>{
    const geometry={type:'LineString',coordinates:[[30,60],[30.02,60.01]]};
    const pts=sampleRouteCoordinates(geometry,16);
    expect(pts.length).toBeGreaterThan(2);
    expect(pts[0]).toMatchObject({lon:30,lat:60,distance:0});
    expect(pts.at(-1).lon).toBeCloseTo(30.02,6);
    expect(pts.at(-1).lat).toBeCloseTo(60.01,6);
  });
});
