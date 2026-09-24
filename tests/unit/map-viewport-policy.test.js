import { describe, expect, it, vi } from 'vitest';
import {
  applyOfflineViewportConstraints,
  minimumZoomForBounds,
  offlineMapBounds,
  offlineViewportOptions
} from '../../src/map/viewport-policy.js';

const meta={
  ready:true,
  minZoom:6,
  maxZoom:14,
  bounds:{minLon:20,minLat:50,maxLon:21,maxLat:51}
};

describe('offline map viewport policy',()=>{
  it('uses downloaded bounds as MapLibre maxBounds',()=>{
    expect(offlineMapBounds(meta)).toEqual([[20,50],[21,51]]);
    expect(offlineViewportOptions(meta)).toEqual({maxBounds:[[20,50],[21,51]],minZoom:6});
  });

  it('does not constrain online or invalid map metadata',()=>{
    expect(offlineMapBounds({...meta,ready:false})).toBeNull();
    expect(offlineMapBounds({...meta,bounds:{minLon:20,minLat:50,maxLon:20,maxLat:51}})).toBeNull();
    expect(offlineViewportOptions({ready:false})).toEqual({});
  });

  it('raises minimum zoom when viewport would be wider than downloaded coverage',()=>{
    const bounds=[[20,50],[20.1,50.1]];
    const small=minimumZoomForBounds(bounds,{width:320,height:480});
    const wide=minimumZoomForBounds(bounds,{width:1200,height:800});
    expect(wide).toBeGreaterThan(small);
  });

  it('applies pan bounds and prevents zoom-out beyond visible downloaded coverage',()=>{
    const setMaxBounds=vi.fn();
    const setMinZoom=vi.fn();
    const setZoom=vi.fn();
    const map={
      setMaxBounds,
      setMinZoom,
      setZoom,
      getContainer:()=>({clientWidth:1200,clientHeight:800}),
      getMaxZoom:()=>24,
      getZoom:()=>5
    };

    const result=applyOfflineViewportConstraints(map,meta);
    expect(setMaxBounds).toHaveBeenCalledWith([[20,50],[21,51]]);
    expect(result.minZoom).toBeGreaterThanOrEqual(6);
    expect(setMinZoom).toHaveBeenCalledWith(result.minZoom);
    expect(setZoom).toHaveBeenCalledWith(result.minZoom);
  });

  it('keeps current zoom when it already satisfies the offline limit',()=>{
    const setZoom=vi.fn();
    const map={
      setMaxBounds:vi.fn(),
      setMinZoom:vi.fn(),
      setZoom,
      getContainer:()=>({clientWidth:360,clientHeight:640}),
      getMaxZoom:()=>24,
      getZoom:()=>18
    };
    applyOfflineViewportConstraints(map,meta);
    expect(setZoom).not.toHaveBeenCalled();
  });
});
