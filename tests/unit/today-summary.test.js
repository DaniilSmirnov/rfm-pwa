import {describe,it,expect} from 'vitest';
import {todaySummary} from '../../src/app/today-summary.js';

const result=(name,className,time)=>({time,formattedTime:'00:10:00:0',crew:{id:name,pilot:{lastName:name}},discipline:{name:className}});

describe('today summary',()=>{
  it('keeps the daily schedule and top three per class in a local snapshot',()=>{
    const pkg={original:{schedule:[{date:'25.09.2026',location:'СУ 3',events:[{time:'10:00',text:'Старт'}]},{date:'24.09.2026',location:'СУ 2'}]},crewResults:{eventResults:[{specialStage:{name:'СУ 3',distance:10},results:[result('A','R5',600000),result('B','R5',610000),result('C','R5',620000),result('D','R5',630000),result('E','Абсолют',540000)]}]}};
    const summary=todaySummary(pkg,new Date(2026,8,25));
    expect(summary.schedule).toHaveLength(1);
    expect(summary.yesterday).toHaveLength(1);
    expect(summary.podiums.find(group=>group.className==='R5').results.map(item=>item.crew.pilot.lastName)).toEqual(['A','B','C']);
    expect(summary.podiums.find(group=>group.className==='Абсолют').results).toHaveLength(1);
  });
});
