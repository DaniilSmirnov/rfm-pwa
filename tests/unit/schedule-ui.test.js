// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderSchedule } from '../../src/app/schedule-ui.js';

const pkg={
  id:'race-1',
  original:{
    schedule:[
      {date:'10.10.2026',location:'СУ 3 Harlu',events:[{time:'09:30',text:'Закрытие дороги'}]},
      {date:'10.10.2026',location:'Торжественное открытие',events:[{time:'18:00',text:'Площадь'}]}
    ]
  }
};

describe('schedule stage selection UI',()=>{
  beforeEach(()=>{
    document.body.innerHTML='<div id="scheduleList"></div><p id="pushStatus"></p>';
    localStorage.clear();
  });

  it('marks the selected stage and opens it from click',()=>{
    const onStageSelect=vi.fn();
    renderSchedule(pkg,{selectedStageKey:'су-3',onStageSelect});
    const row=document.querySelector('[data-stage-row="су-3"]');
    expect(row).toBeTruthy();
    expect(row.classList.contains('selected-stage')).toBe(true);
    row.click();
    expect(onStageSelect).toHaveBeenCalledWith('су-3',{source:'schedule'});
  });

  it('opens a stage from keyboard but leaves non-stage rows non-interactive',()=>{
    const onStageSelect=vi.fn();
    renderSchedule(pkg,{onStageSelect});
    const row=document.querySelector('[data-stage-row="су-3"]');
    row.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
    expect(onStageSelect).toHaveBeenCalledWith('су-3',{source:'schedule'});
    expect(document.querySelectorAll('[data-stage-row]')).toHaveLength(1);
  });
});
