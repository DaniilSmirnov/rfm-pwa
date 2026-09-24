import { describe, expect, it, vi, afterEach } from 'vitest';
import { startOfLocalDay, parseDdMmYyyy, raceDateRange, distanceFromTodayDays, raceWithinWeek, pickDefaultRace } from '../../src/app/catalog-dates.js';

afterEach(()=>vi.useRealTimers());

describe('catalog date helpers',()=>{
  it.each([
    ['01.02.2026',2026,2,1],
    ['9/3/2026',2026,3,9],
    ['31-12-2026',2026,12,31]
  ])('parses supported date separators', (raw,y,m,d)=>{
    const date=parseDdMmYyyy(raw);
    expect([date.getFullYear(),date.getMonth()+1,date.getDate()]).toEqual([y,m,d]);
  });

  it.each(['','not a date','12.10','2026-10-12'])('rejects invalid or unsupported date forms',raw=>{
    expect(parseDdMmYyyy(raw)).toBeNull();
  });

  it('normalizes to local midnight',()=>{
    const d=startOfLocalDay(new Date(2026,8,24,18,42,13));
    expect([d.getHours(),d.getMinutes(),d.getSeconds(),d.getMilliseconds()]).toEqual([0,0,0,0]);
  });

  it('reads a single race date',()=>{
    const r=raceDateRange({dates:'10.10.2026'});
    expect(r.start.getTime()).toBe(r.end.getTime());
  });

  it('reads first and last dates from a range-like string',()=>{
    const r=raceDateRange({dates:'09.10.2026 — 11.10.2026'});
    expect(r.start.getDate()).toBe(9);
    expect(r.end.getDate()).toBe(11);
  });

  it('returns null when no date is present',()=>expect(raceDateRange({dates:'TBA'})).toBeNull());

  it('returns zero distance while race is in progress',()=>{
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026,9,10,14));
    expect(distanceFromTodayDays({dates:'09.10.2026 - 11.10.2026'})).toBe(0);
  });

  it('measures days before the race',()=>{
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026,9,1,14));
    expect(distanceFromTodayDays({dates:'04.10.2026'})).toBe(3);
  });

  it('measures days after the race',()=>{
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026,9,20,14));
    expect(distanceFromTodayDays({dates:'17.10.2026'})).toBe(3);
  });

  it('treats exactly seven days as within the week',()=>{
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026,9,1));
    expect(raceWithinWeek({dates:'08.10.2026'})).toBe(true);
  });

  it('rejects eight days as outside the week',()=>{
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026,9,1));
    expect(raceWithinWeek({dates:'09.10.2026'})).toBe(false);
  });

  it('picks the closest dated race',()=>{
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026,9,10));
    const rows=[{id:1,dates:'15.10.2026'},{id:2,dates:'11.10.2026'},{id:3,dates:'TBA'}];
    expect(pickDefaultRace(rows)?.id).toBe(2);
  });

  it('returns null when nothing has a date',()=>expect(pickDefaultRace([{dates:'TBA'}])).toBeNull());
});
