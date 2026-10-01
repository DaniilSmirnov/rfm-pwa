import { describe, expect, it } from 'vitest';
import { asmgRaceIdForPackage } from '../../src/app/asmg-race-map.js';

describe('temporary ASMG race mapping', () => {
  it.each([
    ['Ралли Сортавала 2026', '55'],
    ['Sortavala Rally', '55'],
    ['Ралли Альметьевск', '56'],
    ['Almetyevsk', '56'],
    ['Ралли Браслав', '57'],
    ['Braslav Rally', '57'],
  ])('maps %s to ASMG %s', (name, id) => {
    expect(asmgRaceIdForPackage({ name })).toBe(id);
  });

  it('keeps explicit metadata for unmapped rallies', () => {
    expect(asmgRaceIdForPackage({ name: 'Другая гонка', asmgRaceId: 99 })).toBe('99');
  });
});
