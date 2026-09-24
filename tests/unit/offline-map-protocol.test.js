// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/db.js',()=>({
  saveMapTile:vi.fn(),
  deleteMapTiles:vi.fn(),
  getMapTile:vi.fn()
}));

import { getMapTile } from '../../src/db.js';
import { registerOfflineMapProtocol } from '../../src/offline-map.js';

afterEach(()=>{
  delete window.maplibregl;
  vi.clearAllMocks();
});

describe('offline vector tile protocol',()=>{
  it('reads persisted tiles by revision id and safely represents missing tiles',async()=>{
    const bytes=new Uint8Array([1,2,3]).buffer;
    getMapTile.mockResolvedValueOnce({data:bytes,bytes:3}).mockResolvedValueOnce(null);
    let handler;
    window.maplibregl={
      addProtocol:vi.fn((name,fn)=>{
        expect(name).toBe('rfmoffline');
        handler=fn;
      })
    };

    registerOfflineMapProtocol();
    expect(handler).toBeTypeOf('function');

    const hit=await handler({url:'rfmoffline://race-901%40map/14/9588/4599'});
    expect(getMapTile).toHaveBeenNthCalledWith(1,'race-901@map',14,9588,4599);
    expect(new Uint8Array(hit.data)).toEqual(new Uint8Array([1,2,3]));

    const miss=await handler({url:'rfmoffline://race-901%40map/14/9588/4600'});
    expect(getMapTile).toHaveBeenNthCalledWith(2,'race-901@map',14,9588,4600);
    expect(miss.data).toBeInstanceOf(ArrayBuffer);
    expect(miss.data.byteLength).toBe(0);
  });
});
