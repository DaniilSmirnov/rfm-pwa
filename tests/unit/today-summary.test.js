import { describe, it, expect } from 'vitest';
import { todaySummary, raceHasFinished } from '../../src/views/TodayView/logic/today-summary.js';
import almetyevsk from '../fixtures/almetyevsk-program.json';

describe('today summary', () => {
  it('retains all Almetyevsk locations with inherited dates through the evening program', () => {
    const summary = todaySummary(almetyevsk, new Date('2026-10-09T14:00:00Z'));
    expect(summary.scheduleLabel).toBe('ПРОГРАММА НА СЕГОДНЯ');
    expect(summary.schedule).toHaveLength(3);
    expect(summary.schedule.flatMap(item => item.events)).toHaveLength(15);
    expect(summary.schedule[1].location).toContain('пл. Ленина');
    expect(summary.schedule[2].events.at(-1)).toEqual({
      time: '20:13',
      text: 'Финиш 1-го дня ралли',
    });
    expect(summary.schedule.every(item => item.date === '9 ОКТ, ПТ')).toBe(true);
    expect(almetyevsk.original.schedule[3].date).toBe('');
    expect(raceHasFinished(almetyevsk, new Date('2026-10-10T13:00:00Z'))).toBe(false);
  });

  it('switches Almetyevsk to the next day only after the final inherited-date event', () => {
    const summary = todaySummary(almetyevsk, new Date('2026-10-09T17:14:00Z'));
    expect(summary.scheduleLabel).toBe('ПРОГРАММА НА ЗАВТРА');
    expect(summary.schedule).toHaveLength(1);
    expect(summary.schedule[0].date).toBe('10 ОКТ, СБ');
    expect(summary.schedule[0].events).toHaveLength(12);
  });

  it('does not infer a date for a leading undated block', () => {
    const pkg = {
      ...almetyevsk,
      original: {
        schedule: [
          { date: '', events: [{ time: '10:00', text: 'Без даты' }] },
          { date: '9 ОКТ, ПТ', events: [{ time: '20:00', text: 'Сегодня' }] },
          { date: '10 ОКТ, СБ', events: [{ time: '20:00', text: 'Завтра' }] },
        ],
      },
    };
    expect(todaySummary(pkg, new Date('2026-10-09T14:00:00Z')).schedule).toHaveLength(1);
  });
  it('shows the current day while it still has scheduled events', () => {
    const pkg = {
      timezone: 'UTC',
      summary: { dates: '25.09.2026' },
      original: {
        schedule: [
          { date: '25.09.2026', location: 'СУ 3', events: [{ time: '22:00', text: 'Старт' }] },
          { date: '26.09.2026', location: 'СУ 4', events: [{ time: '10:00', text: 'Старт' }] },
        ],
      },
    };
    const summary = todaySummary(pkg, new Date('2026-09-25T21:00:00Z'));
    expect(summary.schedule).toHaveLength(1);
    expect(summary.scheduleLabel).toBe('ПРОГРАММА НА СЕГОДНЯ');
  });

  it('switches to tomorrow after the last timed event has ended', () => {
    const pkg = {
      timezone: 'UTC',
      summary: { dates: '25.09.2026' },
      original: {
        schedule: [
          { date: '25.09.2026', location: 'СУ 3', events: [{ time: '10:00', text: 'Старт' }] },
          { date: '26.09.2026', location: 'СУ 4', events: [{ time: '10:00', text: 'Старт' }] },
        ],
      },
    };
    const summary = todaySummary(pkg, new Date('2026-09-25T11:00:00Z'));
    expect(summary.schedule[0].location).toBe('СУ 4');
    expect(summary.scheduleLabel).toBe('ПРОГРАММА НА ЗАВТРА');
  });

  it('finds the next scheduled day when there is a gap in the program', () => {
    const pkg = {
      timezone: 'UTC',
      original: {
        schedule: [
          { date: '28.09.2026', location: 'СУ 4', events: [{ time: '10:00', text: 'Старт' }] },
        ],
      },
    };
    const summary = todaySummary(pkg, new Date('2026-09-26T11:00:00Z'));
    expect(summary.schedule[0].location).toBe('СУ 4');
    expect(summary.scheduleLabel).toBe('ПРОГРАММА БЛИЖАЙШЕГО ДНЯ');
  });

  it('marks a race finished from its status or completed schedule', () => {
    expect(raceHasFinished({ original: { status_race: 'Завершена' } })).toBe(true);
    const pkg = {
      timezone: 'UTC',
      original: { schedule: [{ date: '26.09.2026', events: [{ time: '10:00' }] }] },
    };
    expect(raceHasFinished(pkg, new Date('2026-09-26T11:00:00Z'))).toBe(true);
    expect(raceHasFinished(pkg, new Date('2026-09-26T09:00:00Z'))).toBe(false);
  });
});
