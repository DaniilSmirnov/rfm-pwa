import { describe, expect, it } from 'vitest';
import {
  loadSelectedRallyId,
  saveSelectedRallyId,
  selectedPackage,
} from '../../src/app/rally-context.js';

describe('global rally context', () => {
  it('stores and restores the selected rally id safely', () => {
    const values = new Map();
    const storage = {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    };
    expect(loadSelectedRallyId(storage)).toBeNull();
    expect(saveSelectedRallyId(12, storage)).toBe(true);
    expect(loadSelectedRallyId(storage)).toBe('12');
    expect(saveSelectedRallyId(null, storage)).toBe(false);
  });

  it('handles storage failures and preserves the original package id type', () => {
    const unavailable = {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
    };
    expect(loadSelectedRallyId(unavailable)).toBeNull();
    expect(saveSelectedRallyId(1, unavailable)).toBe(false);
    const pkg = { id: 7 };
    expect(selectedPackage([pkg], '7')).toBe(pkg);
    expect(selectedPackage([pkg], 'missing')).toBeNull();
  });
});
