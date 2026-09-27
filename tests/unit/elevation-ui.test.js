// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/app/elevation.js',()=>({
  elevationAt:vi.fn(),
  elevationProfile:vi.fn()
}));
vi.mock('../../src/app/elevation-chart.js',()=>({
  profileSvg:vi.fn(()=>'<svg data-testid="elevation-chart"></svg>')
}));

import { elevationAt, elevationProfile } from '../../src/app/elevation.js';
import { showPointElevation, showRouteElevationProfile } from '../../src/app/elevation-ui.js';

beforeEach(()=>{
  document.body.innerHTML=`
    <p id="pointElevation"></p>
    <section id="elevationProfilePanel" hidden>
      <h2 id="elevationProfileTitle"></h2>
      <div id="elevationProfileBody"></div>
    </section>
  `;
  vi.clearAllMocks();
});

describe('elevation UI',()=>{
  it('explains that point elevation needs an offline terrain package',async()=>{
    await showPointElevation(null,{lat:61,lon:30});
    expect(document.querySelector('#pointElevation').textContent).toContain('рельеф не скачан');
    expect(elevationAt).not.toHaveBeenCalled();
  });

  it('renders a sampled elevation for a selected point',async()=>{
    elevationAt.mockResolvedValue(154.6);
    await showPointElevation({ready:true},{lat:61,lon:30});
    expect(document.querySelector('#pointElevation').textContent).toBe('Высота: 155 м');
  });

  it('shows a helpful explanation when a route profile is opened without terrain',async()=>{
    await showRouteElevationProfile(null,{name:'СУ 1',geometry:{type:'LineString',coordinates:[]}});
    expect(document.querySelector('#elevationProfilePanel').hidden).toBe(false);
    expect(document.querySelector('#elevationProfileTitle').textContent).toBe('СУ 1');
    expect(document.querySelector('#elevationProfileBody').textContent).toContain('Скачай рельеф');
  });

  it('renders distance, elevation range and chart for a valid route profile',async()=>{
    elevationProfile.mockResolvedValue({distance:12345,min:90,max:240,gain:180,loss:130,points:[{},{}]});
    await showRouteElevationProfile({ready:true},{name:'СУ 2',geometry:{type:'LineString',coordinates:[[30,60],[30.1,60.1]]}});
    const body=document.querySelector('#elevationProfileBody');
    expect(body.textContent).toContain('12.3 км');
    expect(body.textContent).toContain('мин. 90 м');
    expect(body.textContent).toContain('макс. 240 м');
    expect(body.textContent).toContain('набор +180 м');
    expect(body.querySelector('svg[data-testid="elevation-chart"]')).not.toBeNull();
    expect(document.querySelector('#elevationProfilePanel').hidden).toBe(false);
  });

  it('escapes errors before rendering them into the route profile',async()=>{
    elevationProfile.mockRejectedValue(new Error('<img src=x onerror=alert(1)>'));
    await showRouteElevationProfile({ready:true},{name:'СУ 3',geometry:{type:'LineString',coordinates:[]}});
    const body=document.querySelector('#elevationProfileBody');
    expect(body.querySelector('img')).toBeNull();
    expect(body.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});
