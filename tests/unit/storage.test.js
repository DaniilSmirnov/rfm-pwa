// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
  readJsonStorage,
  readStorage,
  removeStorage,
  writeJsonStorage,
  writeStorage,
} from '../../src/app/storage.js';

describe('safe local storage boundary', () => {
  it('reads and writes primitive values', () => {
    expect(writeStorage('key', 'value')).toBe(true);
    expect(readStorage('key')).toBe('value');
    expect(removeStorage('key')).toBe(true);
    expect(readStorage('key')).toBeNull();
  });

  it('round-trips JSON and uses the fallback for malformed values', () => {
    writeJsonStorage('json', { enabled: true });
    expect(readJsonStorage('json', {})).toEqual({ enabled: true });
    localStorage.setItem('json', '{bad');
    expect(readJsonStorage('json', { enabled: false })).toEqual({ enabled: false });
  });

  it('fails closed when storage operations throw', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readStorage('key', blocked)).toBeNull();
    expect(readJsonStorage('key', { safe: true }, blocked)).toEqual({ safe: true });
    expect(writeStorage('key', 'value', blocked)).toBe(false);
    expect(writeJsonStorage('key', {}, blocked)).toBe(false);
    expect(removeStorage('key', blocked)).toBe(false);
  });
});
