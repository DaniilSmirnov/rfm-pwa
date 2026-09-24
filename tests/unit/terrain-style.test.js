import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/terrain-offline.js',()=>({
  offlineTerrainSource:vi.fn(meta=>meta?.ready?{type:'raster-dem',tiles:['rfmterrain://x/{z}/{x}/{y}'],encoding:'terrarium',tileSize:512}:null),
  registerTerrainProtocol:vi.fn()
}));

import { terrainStyleParts } from '../../src/map/terrain.js';
import { registerTerrainProtocol } from '../../src/terrain-offline.js';

describe('terrain map style',()=>{
  it('returns no terrain when terrain data is unavailable',()=>{
    expect(terrainStyleParts(null)).toEqual({sources:{},layers:[],terrain:null});
  });

  it('builds hillshade mode without a 3d terrain root property',()=>{
    const parts=terrainStyleParts({ready:true},'hillshade');
    expect(parts.sources['offline-terrain-hillshade'].type).toBe('raster-dem');
    expect(parts.sources['offline-terrain-3d'].type).toBe('raster-dem');
    expect(parts.sources['offline-terrain-3d']).not.toBe(parts.sources['offline-terrain-hillshade']);
    expect(parts.terrain).toBeNull();
    expect(parts.layers).toHaveLength(1);
    expect(parts.layers[0]).toMatchObject({id:'terrain-hillshade',type:'hillshade',source:'offline-terrain-hillshade'});
    expect(registerTerrainProtocol).toHaveBeenCalled();
  });

  it('builds real 3d terrain into the initial style',()=>{
    const parts=terrainStyleParts({ready:true},'3d');
    expect(parts.terrain).toEqual({source:'offline-terrain-3d',exaggeration:1.35});
    expect(parts.layers).toEqual([]);
  });
});
