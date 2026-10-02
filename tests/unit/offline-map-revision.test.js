// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/db.js', () => ({
  saveMapTile: vi.fn(async () => {}),
  getMapTile: vi.fn(async () => null),
  deleteMapTiles: vi.fn(async () => {}),
}));

import { deleteMapTiles, getMapTile, saveMapTile } from '../../src/db.js';
import { downloadOfflineMap, mapSourceRevision } from '../../src/offline-map.js';

const fc = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { kind: 'race-route' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [30.69, 61.7],
          [30.7, 61.71],
        ],
      },
    },
  ],
};

function pkg() {
  return {
    id: 'race-1',
    geojson: fc,
    offlineMap: { ready: true, storageId: 'map-old' },
  };
}

function installPmtiles({ failAlways = false } = {}) {
  window.pmtiles = {
    PMTiles: class {
      async getHeader() {
        return { tileType: 1 };
      }
      async getMetadata() {
        return {
          name: 'test-map',
          version: '1',
          vector_layers: [{ id: 'roads', fields: { kind: 'String' } }],
        };
      }
      async getZxy() {
        if (failAlways) throw new Error('network interrupted');
        return { data: new Uint8Array([1, 2, 3, 4]).buffer };
      }
    },
  };
}

afterEach(() => {
  delete window.pmtiles;
  vi.clearAllMocks();
});

describe('offline map revision safety', () => {
  it('writes a successful download into a new revision without deleting the active old map', async () => {
    installPmtiles();

    const result = await downloadOfflineMap(pkg());

    expect(result.ready).toBe(true);
    expect(result.storageId).toMatch(/^race-1@[0-9a-f]{8}$/);
    expect(result.storageId).not.toBe('map-old');
    expect(result.sourceRevision).toBe(
      mapSourceRevision(
        { tileType: 1 },
        {
          name: 'test-map',
          version: '1',
          vector_layers: [{ id: 'roads', fields: { kind: 'String' } }],
        },
      ),
    );
    expect(result.tileCount).toBeGreaterThan(0);
    expect(saveMapTile).toHaveBeenCalled();
    expect(deleteMapTiles).not.toHaveBeenCalledWith('map-old');
  });

  it('keeps an incomplete staging revision so the next attempt can resume', async () => {
    installPmtiles({ failAlways: true });

    await expect(
      downloadOfflineMap(pkg(), () => {}, {
        previousMap: { ready: true, storageId: 'race-1@slot-a' },
      }),
    ).rejects.toThrow();

    expect(deleteMapTiles).not.toHaveBeenCalled();
    expect(saveMapTile).not.toHaveBeenCalled();
    expect(getMapTile).toHaveBeenCalled();
  });

  it('skips a repeated update when the PMTiles source is unchanged', async () => {
    installPmtiles();
    const sourceRevision = mapSourceRevision(
      { tileType: 1 },
      {
        name: 'test-map',
        version: '1',
        vector_layers: [{ id: 'roads', fields: { kind: 'String' } }],
      },
    );
    const previousMap = { ...pkg().offlineMap, sourceRevision };
    const result = await downloadOfflineMap(pkg(), () => {}, { previousMap });

    expect(result.sourceRevision).toBe(sourceRevision);
    expect(result.storageId).toBe('map-old');
    expect(getMapTile).not.toHaveBeenCalled();
    expect(saveMapTile).not.toHaveBeenCalled();
  });
  it('reuses tiles already present in the staging slot', async () => {
    installPmtiles();
    getMapTile.mockResolvedValue({ data: new Uint8Array([9, 9]).buffer });

    const result = await downloadOfflineMap(pkg(), () => {}, {
      previousMap: { ready: true, storageId: 'race-1@slot-a' },
    });

    expect(result.storageId).toMatch(/^race-1@[0-9a-f]{8}$/);
    expect(result.reused).toBe(result.requested);
    expect(saveMapTile).not.toHaveBeenCalled();
  });
});
