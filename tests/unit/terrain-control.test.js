// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { TerrainModeControl, applyTerrainMode } from '../../src/map/terrain-control.js';

function mapStub(){
  return {
    getLayer:vi.fn(id=>id==='terrain-hillshade'?{id}:null),
    setLayoutProperty:vi.fn(),
    setTerrain:vi.fn(),
    easeTo:vi.fn()
  };
}

describe('terrain mode control',()=>{
  it('switches from hillshade to true 3D terrain',()=>{
    const map=mapStub();
    expect(applyTerrainMode(map,'3d')).toBe('3d');
    expect(map.setLayoutProperty).toHaveBeenCalledWith('terrain-hillshade','visibility','none');
    expect(map.setTerrain).toHaveBeenCalledWith({source:'offline-terrain',exaggeration:1});
    expect(map.easeTo).toHaveBeenCalledWith(expect.objectContaining({pitch:58}));
  });

  it('switches back to hillshade and flattens camera',()=>{
    const map=mapStub();
    expect(applyTerrainMode(map,'hillshade')).toBe('hillshade');
    expect(map.setTerrain).toHaveBeenCalledWith(null);
    expect(map.setLayoutProperty).toHaveBeenCalledWith('terrain-hillshade','visibility','visible');
    expect(map.easeTo).toHaveBeenCalledWith(expect.objectContaining({pitch:0}));
  });

  it('renders a mountain button and toggles modes on click',()=>{
    const map=mapStub();
    const control=new TerrainModeControl();
    const root=control.onAdd(map);
    const button=root.querySelector('button');
    expect(button).toBeTruthy();
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.querySelector('svg')).toBeTruthy();

    button.click();
    expect(button.dataset.mode).toBe('3d');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(map.setTerrain).toHaveBeenLastCalledWith({source:'offline-terrain',exaggeration:1});

    button.click();
    expect(button.dataset.mode).toBe('hillshade');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(map.setTerrain).toHaveBeenLastCalledWith(null);
  });
});
