import { describe, expect, it } from 'vitest';
import { chooseVisiblePackages } from '../../src/app/package-selection.js';

const packages = [
  { id: 'one', name: 'Rally One', summary: { city: 'Псков' } },
  { id: 'two', name: 'Rally Two', summary: { city: 'Карелия' } },
];

describe('package selection', () => {
  it('filters across package summary fields', () => {
    expect(chooseVisiblePackages(packages, 'карел')).toEqual([packages[1]]);
  });

  it('returns a stable first package when no query matches a nearby race', () => {
    expect(chooseVisiblePackages(packages, '')).toEqual([packages[0]]);
  });

  it('returns no packages for an empty collection', () => {
    expect(chooseVisiblePackages([], '')).toEqual([]);
  });
});
