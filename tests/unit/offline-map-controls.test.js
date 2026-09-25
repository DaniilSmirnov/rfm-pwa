// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOfflineMapControls } from '../../src/app/offline-map-controls.js';

function mount() {
  document.body.innerHTML = `
    <button id="downloadMapBtn"></button><button id="downloadMapBtnTop"></button>
    <button id="deleteMapBtn"></button><button id="deleteMapBtnTop"></button>
    <span id="offlineMapStatus"></span><span id="offlineMapStatusTop"></span>`;
}

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

describe('offline map controls', () => {
  it('commits new package metadata before deleting the old revision', async () => {
    mount();
    const order = [];
    const pkg = { id: 'race-1', geojson: {}, offlineMap: { ready: true, storageId: 'old' } };
    const next = { ready: true, storageId: 'new', tileCount: 2, bytes: 10, minZoom: 6, maxZoom: 8, vectorLayers: [] };
    const controls = createOfflineMapControls({
      getCurrentPackageId: () => pkg.id,
      getPackage: vi.fn(async () => pkg),
      savePackage: vi.fn(async value => { order.push(`save:${value.offlineMap.storageId}`); }),
      downloadOfflineMap: vi.fn(async (_value, _progress, options) => {
        expect(options.previousMap.storageId).toBe('old');
        return next;
      }),
      removeOfflineMap: vi.fn(),
      discardOfflineMapRevision: vi.fn(async old => { order.push(`delete:${old.storageId}`); }),
      buildDownloadPlan: () => ({ tiles: [], minZoom: 6, maxZoom: 8 }),
      formatBytes: value => `${value} B`,
      selectPackage: vi.fn(async () => {}),
      refreshList: vi.fn(async () => {}),
    });

    await controls.download();
    expect(order).toEqual(['save:new', 'delete:old']);
    expect(pkg.offlineMap).toBe(next);
    expect(document.getElementById('downloadMapBtn').disabled).toBe(false);
  });

  it('retains the existing package revision when the staging download fails', async () => {
    mount();
    const old = { ready: true, storageId: 'old' };
    const pkg = { id: 'race-1', geojson: {}, offlineMap: old };
    const controls = createOfflineMapControls({
      getCurrentPackageId: () => pkg.id,
      getPackage: vi.fn(async () => pkg),
      savePackage: vi.fn(),
      downloadOfflineMap: vi.fn(async () => { throw new Error('offline'); }),
      removeOfflineMap: vi.fn(),
      discardOfflineMapRevision: vi.fn(),
      buildDownloadPlan: () => ({ tiles: [], minZoom: 6, maxZoom: 8 }),
      formatBytes: value => `${value} B`,
      selectPackage: vi.fn(),
      refreshList: vi.fn(),
    });
    vi.stubGlobal('alert', vi.fn());

    await controls.download();
    expect(pkg.offlineMap).toBe(old);
    expect(document.getElementById('offlineMapStatus').textContent).toContain('offline');
  });
});
