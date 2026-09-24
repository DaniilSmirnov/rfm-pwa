// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { extractYandexEmbedUrl, yandexFeaturesToGeoJson, mergeGeoJson } from '../../src/yandex.js';

describe('Yandex import helpers',()=>{
  it('extracts iframe URL and decodes ampersands',()=>{
    const url=extractYandexEmbedUrl('<iframe src="https://yandex.ru/map-widget/v1/?um=constructor%3Aabc&amp;source=constructor"></iframe>');
    expect(url).toContain('yandex.ru/map-widget/v1/');
    expect(url).toContain('source=constructor');
  });
  it('extracts a plain widget URL',()=>expect(extractYandexEmbedUrl('https://yandex.ru/map-widget/v1/?um=constructor%3Aabc')).toContain('constructor'));
  it('rejects non-Yandex host',()=>expect(extractYandexEmbedUrl('<iframe src="https://evil.test/map-widget/v1/?um=x"></iframe>')).toBeNull());
  it('rejects wrong Yandex path',()=>expect(extractYandexEmbedUrl('https://yandex.ru/maps/?um=x')).toBeNull());
  it('returns null for empty embed',()=>expect(extractYandexEmbedUrl('')).toBeNull());
  it('converts placemark',()=>{
    const fc=yandexFeaturesToGeoJson([{type:'placemark',coordinates:[30,60],title:'View'}]);
    expect(fc.features[0]).toMatchObject({properties:{kind:'yandex-point',source:'yandex-constructor',name:'View'},geometry:{type:'Point',coordinates:[30,60]}});
  });
  it('converts line geometry',()=>{
    const fc=yandexFeaturesToGeoJson([{type:'line',title:'Route',geometry:{type:'LineString',coordinates:[[1,2],[3,4]]}}]);
    expect(fc.features[0].geometry.type).toBe('LineString');
  });
  it('skips invalid placemark coordinates',()=>expect(yandexFeaturesToGeoJson([{type:'placemark',coordinates:['x',2]}]).features).toEqual([]));
  it('preserves style metadata',()=>{
    const f=yandexFeaturesToGeoJson([{type:'line',stroke:{color:'#f00'},content:{name:'star'},zIndex:3,geometry:{type:'LineString',coordinates:[[1,2],[3,4]]}}]).features[0];
    expect(f.properties).toMatchObject({color:'#f00',icon:'star',zIndex:3});
  });
  it('merges feature collections',()=>expect(mergeGeoJson({features:[{id:1}]},{features:[{id:2}]},{}).features.map(x=>x.id)).toEqual([1,2]));
});
