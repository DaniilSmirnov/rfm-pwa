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
  it('reads a persisted tile by revision id after protocol registration',async()=>{
    const bytes=new Uint8Array([1,2,3]).buffer;
    getMapTile.mockResolvedValue({data:bytes,bytes:3});
    let handler;
    window.maplibregl={
      addProtocol:vi.fn((name,fn)=>{
        expect(name).toBe('rfmoffline');
        handler=fn;
      })
    };

    registerOfflineMapProtocol();
    expect(handler).toBeTypeOf('function');

    const response=await handler({url:'rfmoffline://race-901%40map/14/9588/4599'});

    expect(getMapTile).toHaveBeenCalledWith('race-901@map',14,9588,4599);
    expect(new Uint8Array(response.data)).toEqual(new Uint8Array([1,2,3]));
  });

  it('returns a valid empty ArrayBuffer when the requested offline tile is absent',async()=>{
    getMapTile.mockResolvedValue(null);
    let handler;
    window.maplibregl={addProtocol:vi.fn((name,fn)=>{handler=fn;})};

    registerOfflineMapProtocol();
    const response=await handler({url:'rfmoffline://race-901%40map/14/9588/4600'});

    expect(response.data).toBeInstanceOf(ArrayBuffer);
    expect(response.data.byteLength).toBe(0);
  });
});
