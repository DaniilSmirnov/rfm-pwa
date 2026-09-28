import { describe, expect, it } from 'vitest';
import { stageIdentity } from '../../src/app/schedule.js';

describe('schedule stage identity for React schedule rendering', () => {
  it('detects a stage from the schedule location', () => {
    expect(stageIdentity({ location: 'СУ 4 Лахденпохья', events: [] })?.key).toBe('су-4');
  });

  it('detects a stage from event text when the location is generic', () => {
    expect(
      stageIdentity({ location: 'Перекрытие', events: [{ text: 'Закрытие SS 2' }] })?.key,
    ).toBe('ss-2');
  });

  it('leaves non-stage schedule entries without stage controls', () => {
    expect(stageIdentity({ location: 'Торжественное открытие', events: [] })).toBeNull();
  });
});
