import { describe, expect, it, vi } from 'vitest';
import schedule from '../../src/data/sortavala-overlap-schedule.json';
import {
  downloadOverlapSchedule,
  isSortavalaRace,
  timeToMinutes,
  validateOverlapSchedule,
} from '../../src/app/overlap-schedule.js';

describe('overlap schedule', () => {
  it('recognizes Sortavala races by Russian or Latin city and event name', () => {
    expect(isSortavalaRace({ city_race: 'Сортавала' })).toBe(true);
    expect(isSortavalaRace({ name: 'Sortavala Rally' })).toBe(true);
    expect(isSortavalaRace({ name: 'Белые Ночи' })).toBe(true);
    expect(isSortavalaRace({ name: 'Ралли Карелия' })).toBe(false);
  });

  it('validates the attached schedule and converts chart times', () => {
    expect(validateOverlapSchedule(schedule)).toBe(schedule);
    expect(schedule.stages).toHaveLength(8);
    expect(timeToMinutes('09:28')).toBe(568);
    expect(timeToMinutes('')).toBeNull();
    expect(() => validateOverlapSchedule({ stages: [] })).toThrow(/stages/);
    expect(() =>
      validateOverlapSchedule({ stages: [{ number: 1, name: 'СУ', first_crew_at: '9:00' }] }),
    ).toThrow(/время/);
  });

  it('downloads JSON from the prepared race API endpoint and validates it', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => schedule });
    await expect(downloadOverlapSchedule(55, { fetchImpl })).resolves.toBe(schedule);
    expect(fetchImpl).toHaveBeenCalledWith('/api/races/55/overlap-schedule', {
      headers: { Accept: 'application/json' },
    });
    await expect(
      downloadOverlapSchedule(55, {
        fetchImpl: vi.fn().mockResolvedValue({ ok: false, status: 503 }),
      }),
    ).rejects.toThrow('503');
  });
});
