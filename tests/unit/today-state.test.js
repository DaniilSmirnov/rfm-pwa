import { describe, expect, it } from 'vitest';
import { calendarKey, getTodayState } from '../../src/views/TodayView/logic/today-state.js';

const pkg = dates => ({ dates, summary: { dates }, original: { dates } });

describe('Today state', () => {
  it('keeps a selected race before its first calendar day', () => {
    expect(
      getTodayState(pkg('10.10.2026 - 12.10.2026'), new Date('2026-10-09T12:00:00Z')).state,
    ).toBe('before');
  });

  it('uses the race timezone for calendar keys', () => {
    expect(
      calendarKey(new Date('2026-10-10T21:30:00Z'), {
        original: { timezone: 'Europe/Moscow' },
      }),
    ).toBe('2026-10-11');
  });

  it('does not finish the last day from a status string alone', () => {
    const value = getTodayState(
      {
        ...pkg('10.10.2026 - 10.10.2026'),
        original: { dates: '10.10.2026 - 10.10.2026', status_race: 'finished' },
      },
      new Date('2026-10-10T18:00:00Z'),
    );
    expect(value.state).toBe('running');
  });

  it('distinguishes a published final protocol from the following day', () => {
    const finished = {
      ...pkg('10.10.2026 - 10.10.2026'),
      original: { dates: '10.10.2026 - 10.10.2026', final_protocol: true },
    };
    expect(getTodayState(finished, new Date('2026-10-10T12:00:00Z')).state).toBe('finished-today');
    expect(getTodayState(finished, new Date('2026-10-11T12:00:00Z')).state).toBe('after-finish');
  });
});
