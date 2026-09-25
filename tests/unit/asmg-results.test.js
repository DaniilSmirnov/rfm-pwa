import { describe, expect, it } from 'vitest';
import { parseAsmgResultsHtml } from '../../src/worker/asmg.js';
import { crewResultViews, overallCrewResults, sortCrewResults, visibleCrewResults } from '../../src/app/crew-results.js';

function flightPage(data){
  const chunk=`1:${JSON.stringify(data)}`;
  return `<html><script>self.__next_f.push(${JSON.stringify([1,chunk])})</script></html>`;
}

describe('ASMG results adapter',()=>{
  it('extracts and normalizes stage standings from the server rendered payload',()=>{
    const html=flightPage({tournamentTitle:'ЧР',eventId:55,allStages:[],disciplines:[],eventResults:[{
      specialStage:{id:12,name:'СУ 1 · Лесной',distance:7},results:[{
        id:99,time:255100,speed:98.8,goingOff:false,goingOffAfterSu:false,reasonGoingOff:'',
        crew:{id:2274,number:1,car:'Skoda Fabia',pilot:{firstName:'Клим',lastName:'Гаврилов'},navigator:{firstName:'Кирилл',lastName:'Еникеев'}},
        discipline:{name:'Абсолют'},formattedTime:'00:04:15:1',formattedTimePenalty:'00:00:00:0',formattedFromLeader:'00:00:00:0',formattedTimeFromPrevious:'00:00:00:0'
      }]
    }]});
    expect(parseAsmgResultsHtml(html,55)).toMatchObject({eventId:'55',tournamentTitle:'ЧР',eventResults:[{
      specialStage:{id:'12',name:'СУ 1 · Лесной',distance:'7'},results:[{
        crew:{id:'2274',number:'1',car:'Skoda Fabia',pilot:{firstName:'Клим',lastName:'Гаврилов'}},
        discipline:{name:'Абсолют'},formattedTime:'00:04:15:1',speed:98.8
      }]
    }]});
  });

  it('rejects an HTML page without structured ASMG results',()=>{
    expect(()=>parseAsmgResultsHtml('<html>maintenance</html>',55)).toThrow('ASMG results data was not found');
  });

  it('rejects invalid or oversized source documents',()=>{
    expect(()=>parseAsmgResultsHtml('x'.repeat(5_000_001),55)).toThrow('unavailable or too large');
  });

  it('shows three leading crews by default and filters the rest by crew details',()=>{
    const results=[1,2,3,4].map((number,index)=>({crew:{number,car:`Car ${number}`,pilot:{firstName:'Driver',lastName:`Name${number}`}}}));
    expect(visibleCrewResults(results)).toEqual(results.slice(0,3));
    expect(visibleCrewResults(results,'4')).toEqual([results[3]]);
    expect(visibleCrewResults(results,'car 2')).toEqual([results[1]]);
  });

  it('keeps retired crews after finishers when assigning places',()=>{
    const dnf={goingOff:true,time:0,crew:{number:1}};
    const second={time:20,crew:{number:2}};
    const first={time:10,crew:{number:3}};
    expect(sortCrewResults([dnf,second,first])).toEqual([first,second,dnf]);
  });

  it('builds the cumulative leaderboard from stage times and uses it as the default view',()=>{
    const crew=(id,number)=>({id,number,pilot:{lastName:`Crew${number}`}});
    const stages=[
      {specialStage:{name:'СУ 1',distance:'7'},results:[
        {time:255100,timePenalty:0,crew:crew(1,1),discipline:{name:'Абсолют'}},
        {time:256000,timePenalty:0,crew:crew(2,2),discipline:{name:'Абсолют'}}
      ]},
      {specialStage:{name:'СУ 2',distance:'20.93'},results:[
        {time:626200,timePenalty:0,crew:crew(1,1),discipline:{name:'Абсолют'}},
        {time:626200,timePenalty:0,crew:crew(2,2),discipline:{name:'Абсолют'}}
      ]}
    ];
    const leaderboard=overallCrewResults(stages);
    expect(leaderboard[0]).toMatchObject({crew:{number:1},formattedTime:'00:14:41:3',formattedFromLeader:'00:00:00:0'});
    expect(leaderboard[1].formattedTime).toBe('00:14:42:2');
    expect(crewResultViews(stages)[0]).toMatchObject({key:'overall',name:'Общий итог после СУ 2',results:leaderboard});
  });
});
