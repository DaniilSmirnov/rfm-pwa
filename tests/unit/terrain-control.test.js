// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { TerrainModeControl, applyTerrainMode, waitForTerrainReady } from '../../src/map/terrain-control.js';

function mapStub(){
  const listeners=new Map();
  return {
    getLayer:vi.fn(id=>id==='terrain-hillshade'?{id}:null),
    setLayoutProperty:vi.fn(),
    setTerrain:vi.fn(),
    easeTo:vi.fn(),
    redraw:vi.fn(),
    getCenter:vi.fn(()=>({lng:11.4,lat:47.2})),
    queryTerrainElevation:vi.fn(()=>742),
    isSourceLoaded:vi.fn(()=>true),
    on:vi.fn((name,fn)=>listeners.set(name,fn)),
    off:vi.fn((name)=>listeners.delete(name)),
    emit:name=>listeners.get(name)?.()
  };
}

describe('terrain mode control',()=>{
  it('detects a loaded DEM through queryTerrainElevation',async()=>{
    const map=mapStub();
    await expect(waitForTerrainReady(map)).resolves.toBe(742);
    expect(map.queryTerrainElevation).toHaveBeenCalled();
  });

  it('waits for DEM readiness before pitching into 3D',async()=>{
    const map=mapStub();
    map.isSourceLoaded.mockReturnValueOnce(false).mockReturnValue(true);
    const promise=applyTerrainMode(map,'3d');
    expect(map.setTerrain).toHaveBeenCalledWith({source:'offline-terrain-3d',exaggeration:1.15});
    expect(map.easeTo).not.toHaveBeenCalled();
    map.emit('sourcedata');
    await expect(promise).resolves.toBe('3d');
    expect(map.setLayoutProperty).toHaveBeenCalledWith('terrain-hillshade','visibility','none');
    expect(map.easeTo).toHaveBeenCalledWith(expect.objectContaining({pitch:68,bearing:-18}));
  });

  it('switches back to hillshade and flattens camera',async()=>{
    const map=mapStub();
    await expect(applyTerrainMode(map,'hillshade')).resolves.toBe('hillshade');
    expect(map.setTerrain).toHaveBeenCalledWith({source:'offline-terrain-3d',exaggeration:0});
    expect(map.setLayoutProperty).toHaveBeenCalledWith('terrain-hillshade','visibility','visible');
    expect(map.easeTo).toHaveBeenCalledWith(expect.objectContaining({pitch:0,bearing:0}));
  });

  it('renders a mountain button and toggles modes on click',async()=>{
    const map=mapStub();
    const control=new TerrainModeControl();
    const root=control.onAdd(map);
    const button=root.querySelector('button');
    expect(button).toBeTruthy();
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.querySelector('svg')).toBeTruthy();

    button.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(button.dataset.mode).toBe('3d');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(map.setTerrain).toHaveBeenLastCalledWith({source:'offline-terrain-3d',exaggeration:1.15});

    button.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(button.dataset.mode).toBe('hillshade');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(map.setTerrain).toHaveBeenLastCalledWith({source:'offline-terrain-3d',exaggeration:0});
  });
});
