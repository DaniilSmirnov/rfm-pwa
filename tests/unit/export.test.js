import { describe, expect, it } from 'vitest';
import { xmlEsc, safeFileName, geoJsonToGpx } from '../../src/app/export.js';

describe('export helpers',()=>{
  it('escapes XML special characters',()=>expect(xmlEsc('<a x="1">&\'')).toBe('&lt;a x=&quot;1&quot;&gt;&amp;&apos;'));
  it.each([
    ['Rally Karelia 2026','rally-karelia-2026'],
    ['  Сортовала / Ралли  ','сортовала-ралли'],
    ['***','rally'],
    ['AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa']
  ])('creates safe filename',(input,expected)=>expect(safeFileName(input)).toBe(expected));

  it('exports point as waypoint',()=>{
    const gpx=geoJsonToGpx({features:[{type:'Feature',properties:{name:'Viewpoint'},geometry:{type:'Point',coordinates:[30.1,60.2]}}]},'Race');
    expect(gpx).toContain('<wpt lat="60.2" lon="30.1"><name>Viewpoint</name></wpt>');
  });
  it('exports line as track',()=>{
    const gpx=geoJsonToGpx({features:[{type:'Feature',properties:{name:'SS1'},geometry:{type:'LineString',coordinates:[[30,60],[31,61]]}}]});
    expect(gpx).toContain('<trk><name>SS1</name><trkseg>');
    expect((gpx.match(/<trkpt/g)||[]).length).toBe(2);
  });
  it('exports every MultiLineString part',()=>{
    const gpx=geoJsonToGpx({features:[{type:'Feature',properties:{name:'Route'},geometry:{type:'MultiLineString',coordinates:[[[1,2],[3,4]],[[5,6],[7,8]]]}}]});
    expect(gpx).toContain('<name>Route 1</name>');
    expect(gpx).toContain('<name>Route 2</name>');
  });
  it('exports polygon rings as tracks',()=>{
    const gpx=geoJsonToGpx({features:[{type:'Feature',properties:{name:'Zone'},geometry:{type:'Polygon',coordinates:[[[1,2],[3,4],[1,2]]]}}]});
    expect(gpx).toContain('<name>Zone 1</name>');
  });
  it('exports multipolygon rings with stable suffixes',()=>{
    const gpx=geoJsonToGpx({features:[{type:'Feature',properties:{name:'Area'},geometry:{type:'MultiPolygon',coordinates:[[[[1,2],[3,4],[1,2]]]]}}]});
    expect(gpx).toContain('<name>Area 1.1</name>');
  });
  it('escapes feature names in GPX',()=>{
    const gpx=geoJsonToGpx({features:[{type:'Feature',properties:{name:'A & B'},geometry:{type:'Point',coordinates:[1,2]}}]});
    expect(gpx).toContain('<name>A &amp; B</name>');
  });
  it('ignores malformed point coordinates',()=>{
    const gpx=geoJsonToGpx({features:[{type:'Feature',properties:{name:'Bad'},geometry:{type:'Point',coordinates:['x','y']}}]});
    expect(gpx).not.toContain('<wpt');
  });
});
