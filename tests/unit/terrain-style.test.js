import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/terrain-offline.js',()=>({
  offlineTerrainSource:vi.fn(meta=>meta?.ready?{type:'raster-dem',tiles:['rfmterrain://x/{z}/{x}/{y}'],encoding:'terrarium',tileSize:512}:null),
  registerTerrainProtocol:vi.fn()
}));

import { terrainStyleParts } from '../../src/map/terrain.js';
import { registerTerrainProtocol } from '../../src/terrain-offline.js';

describe('terrain map style',()=>{
  it('returns no layers when terrain is unavailable',()=>{
    expect(terrainStyleParts(null)).toEqual({sources:{},layers:[]});
  });

  it('adds a raster-dem source and hillshade layer',()=>{
    const parts=terrainStyleParts({ready:true});
    expect(parts.sources['offline-terrain'].type).toBe('raster-dem');
    expect(parts.layers[0]).toMatchObject({id:'terrain-hillshade',type:'hillshade',source:'offline-terrain'});
    expect(registerTerrainProtocol).toHaveBeenCalled();
  });
});
