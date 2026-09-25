// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { elevationGridStep, elevationGridLevels, profileSvg } from '../../src/app/stage-panel.js';

describe('stage elevation chart',()=>{
  it('uses 25 metre grid for ordinary stage elevation spans',()=>{
    expect(elevationGridStep(83,217)).toBe(25);
    expect(elevationGridLevels(83,217)).toEqual([75,100,125,150,175,200,225]);
  });

  it('uses wider grid steps for extreme elevation spans',()=>{
    expect(elevationGridStep(100,450)).toBe(50);
    expect(elevationGridStep(100,800)).toBe(100);
  });

  it('renders labelled horizontal grid lines behind the profile',()=>{
    const svg=profileSvg({
      min:83,max:117,distance:2500,
      points:[
        {distance:0,elevation:90},
        {distance:1250,elevation:115},
        {distance:2500,elevation:100}
      ]
    });
    expect(svg).toContain('75 м');
    expect(svg).toContain('100 м');
    expect(svg).toContain('125 м');
    expect(svg).toContain('elevation-grid-row');
    expect(svg).toContain('2.5 км');
  });
});
