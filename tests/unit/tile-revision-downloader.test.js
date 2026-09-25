import { describe, expect, it, vi } from 'vitest';
import { downloadTileRevision } from '../../src/tile-revision-downloader.js';

const tiles = [{ z: 1, x: 0, y: 0 }, { z: 1, x: 0, y: 1 }];
const data = new Uint8Array([1, 2, 3]);

function setup(overrides = {}) {
  const getTile = vi.fn(async () => null);
  const fetchTile = vi.fn(async () => ({ data: data.buffer }));
  const saveTile = vi.fn(async () => {});
  const onProgress = vi.fn();
  return {
    getTile, fetchTile, saveTile, onProgress,
    options: { tiles, storageId: 'race@stage', getTile, fetchTile, saveTile, onProgress, ...overrides }
  };
}

describe('tile revision downloader', () => {
  it('saves every tile and reports aggregate progress', async () => {
    const ctx = setup({ concurrency: 1, maxZoom: 8 });
    await expect(downloadTileRevision(ctx.options)).resolves.toMatchObject({ done: 2, total: 2, saved: 2, bytes: 6, failed: 0 });
    expect(ctx.saveTile).toHaveBeenCalledTimes(2);
    expect(ctx.onProgress).toHaveBeenLastCalledWith(expect.objectContaining({ done: 2, saved: 2, bytes: 6, maxZoom: 8 }));
  });

  it('reuses existing tiles only when resume is enabled', async () => {
    const ctx = setup({ resume: true, getTile: vi.fn(async () => ({ data: data.buffer })) });
    const result = await downloadTileRevision(ctx.options);
    expect(result).toMatchObject({ reused: 2, saved: 2, bytes: 6 });
    expect(ctx.fetchTile).not.toHaveBeenCalled();
    expect(ctx.saveTile).not.toHaveBeenCalled();
  });

  it('retries failed fetches and eventually commits the tile', async () => {
    const fetchTile = vi.fn().mockRejectedValueOnce(new Error('temporary')).mockResolvedValue({ data: data.buffer });
    const ctx = setup({ tiles: [tiles[0]], fetchTile, retries: 2, retryDelayMs: 0 });
    await expect(downloadTileRevision(ctx.options)).resolves.toMatchObject({ saved: 1, failed: 0 });
    expect(fetchTile).toHaveBeenCalledTimes(2);
  });

  it('reports failures and removes the uncommitted revision when configured', async () => {
    const deleteRevision = vi.fn(async () => {});
    const ctx = setup({
      tiles: [tiles[0]], fetchTile: vi.fn(async () => { throw new Error('offline'); }),
      retries: 1, cleanupOnFailure: true, deleteRevision
    });
    await expect(downloadTileRevision(ctx.options)).rejects.toMatchObject({ stats: { failed: 1, total: 1 } });
    expect(deleteRevision).toHaveBeenCalledWith('race@stage');
  });

  it('preserves an incomplete revision when it is resumable', async () => {
    const deleteRevision = vi.fn();
    const ctx = setup({
      tiles: [tiles[0]], fetchTile: vi.fn(async () => { throw new Error('offline'); }),
      retries: 1, cleanupOnFailure: false, deleteRevision
    });
    await expect(downloadTileRevision(ctx.options)).rejects.toThrow(/Failed to download 1 of 1/);
    expect(deleteRevision).not.toHaveBeenCalled();
  });

  it('throttles progress callbacks during large downloads and always reports completion',async()=>{
    vi.spyOn(performance,'now').mockReturnValue(10);
    const ctx=setup({tiles:Array.from({length:20},(_,i)=>({z:1,x:0,y:i})),concurrency:1});
    await downloadTileRevision(ctx.options);
    expect(ctx.onProgress.mock.calls.length).toBeLessThanOrEqual(2);
    expect(ctx.onProgress).toHaveBeenLastCalledWith(expect.objectContaining({done:20,total:20}));
  });
});
