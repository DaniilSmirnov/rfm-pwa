import {describe,it,expect} from 'vitest';
import {safetyLeafletUrl,safetyLeafletValue} from '../../src/app/safety-leaflet.js';

describe('safety leaflet links',()=>{
  it('reads the leaflet from the race payload or package root',()=>{
    expect(safetyLeafletValue({original:{safety_leaflet:' leaflet.jpg '}})).toBe('leaflet.jpg');
    expect(safetyLeafletValue({safety_leaflet:'leaflet.jpg'})).toBe('leaflet.jpg');
    expect(safetyLeafletValue({original:{safety_leaflet:'  '}})).toBeNull();
  });

  it('supports asset names, public paths and absolute URLs',()=>{
    expect(safetyLeafletUrl('leaflet #1.jpg')).toBe('/api/rallyfans/public/leaflet%20%231.jpg');
    expect(safetyLeafletUrl('/public/leaflet.jpg')).toBe('/api/rallyfans/public/leaflet.jpg');
    expect(safetyLeafletUrl('https://cdn.example/leaflet.jpg')).toBe('https://cdn.example/leaflet.jpg');
    expect(safetyLeafletUrl(null)).toBeNull();
  });
});
