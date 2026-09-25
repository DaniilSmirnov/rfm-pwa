import { describe, expect, it, vi } from 'vitest';
import { replaceOfflineRevision } from '../../src/app/offline-revision.js';

describe('offline revision commit', () => {
  it('stores the new revision before removing the old one', async () => {
    const order = [];
    const current = { id: 'race-1', offlineMap: { ready: true, storageId: 'old' } };
    const nextRevision = { ready: true, storageId: 'new' };
    const result = await replaceOfflineRevision({
      packageData: current,
      key: 'offlineMap',
      download: vi.fn(async () => nextRevision),
      savePackage: vi.fn(async pkg => order.push(`save:${pkg.offlineMap.storageId}`)),
      discardRevision: vi.fn(async old => order.push(`delete:${old.storageId}`)),
    });
    expect(result.offlineMap).toBe(nextRevision);
    expect(order).toEqual(['save:new', 'delete:old']);
    expect(current.offlineMap.storageId).toBe('old');
  });

  it('keeps the active revision and deletes staging data when the metadata write fails', async () => {
    const old = { ready: true, storageId: 'old' };
    const staged = { ready: true, storageId: 'staged' };
    const discardRevision = vi.fn(async () => {});
    await expect(replaceOfflineRevision({
      packageData: { id: 'race-1', terrain: old },
      key: 'terrain',
      download: vi.fn(async () => staged),
      savePackage: vi.fn(async () => { throw new Error('IDB transaction aborted'); }),
      discardRevision,
    })).rejects.toThrow('IDB transaction aborted');
    expect(discardRevision).toHaveBeenCalledTimes(1);
    expect(discardRevision).toHaveBeenCalledWith(staged, 'race-1');
    expect(old.storageId).toBe('old');
  });

  it('does not delete the previous revision if it is already the same storage ID', async () => {
    const current = { id: 'race-1', offlineMap: { ready: true, storageId: 'same' } };
    const discardRevision = vi.fn();
    await replaceOfflineRevision({
      packageData: current,
      key: 'offlineMap',
      download: vi.fn(async () => ({ ready: true, storageId: 'same' })),
      savePackage: vi.fn(async () => {}),
      discardRevision,
    });
    expect(discardRevision).not.toHaveBeenCalled();
  });
});
