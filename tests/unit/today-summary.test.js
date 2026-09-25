import {describe,it,expect} from 'vitest';
import {todaySummary} from '../../src/app/today-summary.js';

describe('today summary',()=>{
  it('shows the current day while it still has scheduled events',()=>{
    const pkg={timezone:'UTC',summary:{dates:'25.09.2026'},original:{schedule:[{date:'25.09.2026',location:'СУ 3',events:[{time:'22:00',text:'Старт'}]},{date:'26.09.2026',location:'СУ 4',events:[{time:'10:00',text:'Старт'}]}]}};
    const summary=todaySummary(pkg,new Date('2026-09-25T21:00:00Z'));
    expect(summary.schedule).toHaveLength(1);
    expect(summary.scheduleLabel).toBe('ПРОГРАММА НА СЕГОДНЯ');
  });

  it('switches to tomorrow after the last timed event has ended',()=>{
    const pkg={timezone:'UTC',summary:{dates:'25.09.2026'},original:{schedule:[{date:'25.09.2026',location:'СУ 3',events:[{time:'10:00',text:'Старт'}]},{date:'26.09.2026',location:'СУ 4',events:[{time:'10:00',text:'Старт'}]}]}};
    const summary=todaySummary(pkg,new Date('2026-09-25T11:00:00Z'));
    expect(summary.schedule[0].location).toBe('СУ 4');
    expect(summary.scheduleLabel).toBe('ПРОГРАММА НА ЗАВТРА');
  });
});
