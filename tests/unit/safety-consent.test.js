import { describe, it, expect } from 'vitest';
import {
  hasSafetyConsent,
  saveSafetyConsent,
  safetyConsentKey,
} from '../../src/app/safety-consent.js';

function storage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
}

describe('local safety consent', () => {
  it('stores acceptance per race and leaflet', () => {
    const store = storage(),
      a = { id: 12, original: { safety_leaflet: 'safety-a.jpg' } },
      b = { id: 13, original: { safety_leaflet: 'safety-b.jpg' } };
    expect(hasSafetyConsent(a, store)).toBe(false);
    expect(saveSafetyConsent(a, store)).toBe(true);
    expect(hasSafetyConsent(a, store)).toBe(true);
    expect(hasSafetyConsent(b, store)).toBe(false);
    expect(safetyConsentKey(a)).not.toBe(safetyConsentKey(b));
  });

  it('fails closed if local storage is unavailable', () => {
    const broken = {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
    };
    expect(hasSafetyConsent({ id: 1 }, broken)).toBe(false);
    expect(saveSafetyConsent({ id: 1 }, broken)).toBe(false);
  });
});
