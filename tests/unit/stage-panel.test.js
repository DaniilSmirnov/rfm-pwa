import { describe, expect, it } from 'vitest';
import { elevationGridStep, elevationGridLevels, profileChartGeometry } from '../../src/app/elevation-chart.js';

describe('React elevation chart geometry',()=>{
  it('uses 25 metre grid for ordinary stage elevation spans',()=>{
    expect(elevationGridStep(83,217)).toBe(25);
    expect(elevationGridLevels(83,217)).toEqual([75,100,125,150,175,200,225]);
  });

  it('uses wider grid steps for extreme elevation spans',()=>{
    expect(elevationGridStep(100,450)).toBe(50);
    expect(elevationGridStep(100,800)).toBe(100);
  });

  it('returns coordinates and labels for React SVG rendering',()=>{
    const geometry=profileChartGeometry({
      min:83,max:117,distance:2500,
      points:[{distance:0,elevation:90},{distance:1250,elevation:115},{distance:2500,elevation:100}]
    });
    expect(geometry.levels.map(level=>level.value)).toEqual([75,100,125]);
    expect(geometry.points).toHaveLength(3);
    expect(geometry.points[0].x).toBe(58);
    expect(geometry.distanceLabel).toBe('2.5 км');
  });
});
