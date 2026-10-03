import { describe, expect, it } from 'vitest';
import { nextRaceDownloadSuggestion } from '../../src/views/TodayView/logic/today-view-data.js';

describe('next race download suggestion', () => {
  const now = new Date(2026, 8, 30, 12, 0, 0);

  it('returns the next calendar race when the selected race has finished', () => {
    const currentPackage = {
      raceId: 55,
      original: { status_race: 'Завершена' },
    };
    const catalog = [
      { id: 55, dates: '27.09.2026' },
      { id: 56, name: 'Следующее ралли', dates: '10.10.2026' },
      { id: 57, name: 'Позднее ралли', dates: '24.10.2026' },
    ];

    expect(nextRaceDownloadSuggestion(currentPackage, catalog, now)?.id).toBe(56);
  });

  it('does not suggest another race while the selected race is still active', () => {
    const currentPackage = {
      raceId: 55,
      original: { status_race: 'Идёт' },
    };
    const catalog = [{ id: 56, dates: '10.10.2026' }];

    expect(nextRaceDownloadSuggestion(currentPackage, catalog, now)).toBeNull();
  });

  it('does not suggest the selected race itself', () => {
    const currentPackage = {
      raceId: 55,
      original: { status_race: 'Завершена' },
    };
    const catalog = [{ id: 55, dates: '10.10.2026' }];

    expect(nextRaceDownloadSuggestion(currentPackage, catalog, now)).toBeNull();
  });
});
