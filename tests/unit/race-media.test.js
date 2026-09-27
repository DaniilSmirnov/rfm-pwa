// @vitest-environment happy-dom
import {beforeEach,describe,it,expect} from 'vitest';
import {renderRaceMedia} from '../../src/app/race-media.js';

describe('race media sections',()=>{
  beforeEach(()=>{
    document.body.innerHTML='<div id="raceMedia"></div><div id="imageModalImg"></div><div id="imageModal"></div><button id="imageModalClose"></button>';
  });

  it('hides results after the race ends and leaves overlap chart for Today',()=>{
    renderRaceMedia({id:10,original:{status_race:'Завершена',results_race:'final-results.jpg',overlap_schedule:'overlap.jpg'}});
    const media=document.getElementById('raceMedia');
    expect(media.textContent).not.toContain('РЕЗУЛЬТАТЫ');
    expect(media.textContent).not.toContain('ГРАФИК ПЕРЕКРЫТИЙ');
    expect(media.textContent).toContain('ПАМЯТКА ПО БЕЗОПАСНОСТИ');
  });

  it('keeps the results section visible while the race is still active',()=>{
    renderRaceMedia({id:11,original:{status_race:'Скоро',results_race:'provisional-results.jpg'}});
    expect(document.getElementById('raceMedia').textContent).toContain('РЕЗУЛЬТАТЫ');
  });
});
