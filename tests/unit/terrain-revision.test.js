// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/db.js',()=>({
  saveMapTile:vi.fn(async()=>{}),
  getMapTile:vi.fn(async()=>null),
  deleteMapTiles:vi.fn(async()=>{})
}));

import { deleteMapTiles, saveMapTile } from '../../src/db.js';
import { downloadTerrain } from '../../src/terrain-offline.js';

const originalFetch=globalThis.fetch;

const fc={
  type:'FeatureCollection',
  features:[{
    type:'Feature',
    properties:{kind:'race-route'},
    geometry:{type:'LineString',coordinates:[[30.69,61.70],[30.70,61.71]]}
  }]
};

function pkg(){
  return {
    id:'race-1',
    geojson:fc,
    terrain:{ready:true,storageId:'terrain-old'}
  };
}

function installFetch({failFirst=false}={}){
  let calls=0;
  globalThis.fetch=vi.fn(async()=>{
    calls++;
    if(failFirst && calls===1) return new Response('failed',{status:503});
    return new Response(new Uint8Array([1,2,3,4]),{status:200});
  });
}

afterEach(()=>{
  globalThis.fetch=originalFetch;
  vi.clearAllMocks();
});

describe('terrain revision safety',()=>{
  it('writes a successful terrain download into a new revision without deleting the active terrain',async()=>{
    installFetch();

    const result=await downloadTerrain(pkg());

    expect(result.ready).toBe(true);
    expect(result.storageId).toMatch(/^race-1@terrain@/);
    expect(result.storageId).not.toBe('terrain-old');
    expect(result.tileCount).toBeGreaterThan(0);
    expect(saveMapTile).toHaveBeenCalled();
    expect(deleteMapTiles).not.toHaveBeenCalledWith('terrain-old');
  });

  it('removes only the incomplete terrain revision after an interrupted download',async()=>{
    installFetch({failFirst:true});

    await expect(downloadTerrain(pkg())).rejects.toThrow();

    expect(deleteMapTiles).toHaveBeenCalledTimes(2);
    const createdRevision=deleteMapTiles.mock.calls[0][0];
    expect(createdRevision).toMatch(/^race-1@terrain@/);
    expect(deleteMapTiles.mock.calls[1][0]).toBe(createdRevision);
    expect(deleteMapTiles).not.toHaveBeenCalledWith('terrain-old');
  });
});
