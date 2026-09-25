import { deleteCrewSubscription, getCrewSubscriptions, saveCrewSubscription, savePackage } from '../db.js';
import { requestCrewResultsBackgroundRefresh } from './runtime.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const crewName=crew=>[
  [crew?.pilot?.lastName,crew?.pilot?.firstName].filter(Boolean).join(' '),
  [crew?.navigator?.lastName,crew?.navigator?.firstName].filter(Boolean).join(' ')
].filter(Boolean).join(' / ');
const subscriptionKey=(asmgRaceId,crewId)=>`${asmgRaceId}:${crewId}`;

export async function fetchAsmgResults(asmgRaceId,fetcher=fetch){
  const id=String(asmgRaceId??'').trim();
  if(!/^\d+$/.test(id))throw new Error('Укажи номер гонки на asmg.ru.');
  const response=await fetcher(`/api/asmg/race/${encodeURIComponent(id)}/results`,{cache:'no-store'});
  if(!response.ok)throw new Error(`АСМГ ответил с ошибкой (${response.status}).`);
  const data=await response.json();
  if(!Array.isArray(data?.eventResults))throw new Error('АСМГ не вернул таблицу результатов.');
  return data;
}

function resultName(result){return crewName(result?.crew)||`Экипаж № ${result?.crew?.number||'—'}`;}
function resultSearchText(result){
  return [result?.crew?.number,resultName(result),result?.crew?.car,result?.discipline?.name].join(' ').toLocaleLowerCase('ru');
}

export function crewResultClasses(results){
  return [...new Set((Array.isArray(results)?results:[])
    .map(result=>String(result?.discipline?.name||'').trim())
    .filter(Boolean))].sort((left,right)=>left.localeCompare(right,'ru'));
}

export function filterCrewResultsByClass(results,className=''){
  const source=Array.isArray(results)?results:[];
  return className?source.filter(result=>String(result?.discipline?.name||'').trim()===className):source;
}

export function visibleCrewResults(results,query='',{className='',limitToTopThree=true}={}){
  const source=filterCrewResultsByClass(results,className);
  const normalized=String(query).trim().toLocaleLowerCase('ru');
  const matching=normalized?source.filter(result=>resultSearchText(result).includes(normalized)):source;
  return !normalized&&limitToTopThree?matching.slice(0,3):matching;
}

export function sortCrewResults(results){
  return (Array.isArray(results)?results:[]).slice().sort((left,right)=>{
    const leftRetired=left?.goingOff||left?.goingOffAfterSu?1:0;
    const rightRetired=right?.goingOff||right?.goingOffAfterSu?1:0;
    return leftRetired-rightRetired||(Number(left?.time)||Infinity)-(Number(right?.time)||Infinity);
  });
}

function formatRallyTime(milliseconds){
  const tenths=Math.max(0,Math.round((Number(milliseconds)||0)/100));
  const hours=Math.floor(tenths/36000);
  const minutes=Math.floor(tenths%36000/600);
  const seconds=Math.floor(tenths%600/10);
  return `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}:${tenths%10}`;
}

export function overallCrewResults(stages){
  const crews=new Map();
  let distance=0;
  for(const stage of Array.isArray(stages)?stages:[]){
    distance+=Number(stage?.specialStage?.distance)||0;
    for(const result of Array.isArray(stage?.results)?stage.results:[]){
      const crew=result?.crew||{};
      const key=String(crew.id||crew.number||result.id||'');
      if(!key)continue;
      const row=crews.get(key)||{crew,discipline:result.discipline,time:0,timePenalty:0,goingOff:false,goingOffAfterSu:false,reasonGoingOff:''};
      row.crew=crew;
      row.discipline=result.discipline||row.discipline;
      if(!result.goingOff){
        row.time+=Number(result.time)||0;
        row.timePenalty+=Number(result.timePenalty)||0;
      }
      if(result.goingOff||result.goingOffAfterSu){
        row.goingOff=row.goingOff||Boolean(result.goingOff);
        row.goingOffAfterSu=row.goingOffAfterSu||Boolean(result.goingOffAfterSu);
        row.reasonGoingOff=result.reasonGoingOff||row.reasonGoingOff;
      }
      crews.set(key,row);
    }
  }
  const results=[...crews.values()].filter(result=>result.time>0||result.goingOff).map(result=>{
    const time=result.time+result.timePenalty;
    return {...result,time,formattedTime:formatRallyTime(time),formattedTimePenalty:formatRallyTime(result.timePenalty),distance};
  });
  const ordered=sortCrewResults(results);
  let leaderTime=null,previousTime=null;
  for(const result of ordered){
    if(result.goingOff){
      result.formattedFromLeader='—';
      result.formattedTimeFromPrevious='—';
      result.speed=0;
      continue;
    }
    leaderTime??=result.time;
    result.formattedFromLeader=formatRallyTime(result.time-leaderTime);
    result.formattedTimeFromPrevious=formatRallyTime(previousTime==null?0:result.time-previousTime);
    result.speed=result.time>0?Math.round(distance*3_600_000/result.time*10)/10:0;
    previousTime=result.time;
  }
  return ordered;
}

export function crewResultViews(eventResults){
  const stages=Array.isArray(eventResults)?eventResults:[];
  const lastName=stages.at(-1)?.specialStage?.name||'последнего СУ';
  return [
    {key:'overall',name:`Общий итог после ${lastName}`,results:overallCrewResults(stages)},
    ...stages.map((stage,index)=>({key:String(index),name:stage?.specialStage?.name||`Спецучасток ${index+1}`,results:sortCrewResults(stage?.results?.filter(result=>Number(result?.time)>0||result?.goingOff||result?.goingOffAfterSu))}))
  ];
}

function resultRow(result,index,stage,subscribed){
  const crew=result?.crew||{};
  const name=resultName(result);
  const id=String(crew.id||crew.number||name);
  const status=result.goingOff?'Сход':result.goingOffAfterSu?'Сход после финиша':'';
  const time=status?(result.reasonGoingOff||status):(result.formattedTime||'Время пока недоступно');
  const place=result.goingOff||result.goingOffAfterSu?'—':index+1;
  return `<tr data-crew-row data-search="${esc(resultSearchText(result))}">
    <td class="crew-results-place">${place}</td>
    <td class="crew-results-name"><strong>${esc(name)}</strong><small>№ ${esc(crew.number||'—')}</small></td>
    <td>${esc(crew.car||'Автомобиль не указан')}<small>${esc(result?.discipline?.name||'Зачёт не указан')}</small></td>
    <td class="crew-results-time">${esc(time)}${result.formattedTimePenalty?`<small>Штраф ${esc(result.formattedTimePenalty)}</small>`:''}</td>
    <td><button class="button compact crew-subscribe-button ${subscribed?'downloaded':''}" type="button" data-subscribe="${esc(id)}" data-name="${esc(name)}" aria-label="${subscribed?'Отписаться от экипажа':'Следить за экипажем'}: ${esc(name)}">${subscribed?'Отписаться':'Подписаться'}</button></td>
  </tr>`;
}

export async function renderCrewResults(pkg,root=document.getElementById('crewResults')){
  if(!root)return;
  const asmgRaceId=String(pkg?.asmgRaceId??pkg?.original?.asmg_id??pkg?.original?.asmgId??pkg?.raceId??pkg?.original?.id??'');
  root.innerHTML=`<section class="crew-results-section" aria-labelledby="crewResultsTitle">
    <div class="section-head"><div><div id="crewResultsTitle" class="block-title">РЕЗУЛЬТАТЫ ЭКИПАЖЕЙ</div><p class="muted small">Открой таблицу, когда захочешь посмотреть результаты.</p></div><button class="button primary" id="crewResultsOpen" type="button" hidden>Открыть результаты</button></div>
    <div class="crew-results-class-filter" id="crewResultsClassFilter" hidden><label for="crewResultsClass">Класс</label><select id="crewResultsClass" class="crew-results-stage"><option value="">Все классы</option></select></div>
    <form class="crew-results-controls"><label for="asmgRaceId">Номер гонки на АСМГ</label><div class="crew-results-load"><input id="asmgRaceId" inputmode="numeric" pattern="[0-9]*" value="${esc(asmgRaceId)}" aria-label="Номер гонки на АСМГ"/><button class="button compact primary" type="submit">${pkg?.crewResults?'Обновить':'Загрузить результаты'}</button></div></form>
    <p class="muted small crew-results-status" aria-live="polite">${asmgRaceId?'Загружаю результаты…':'Введи номер гонки на asmg.ru, если он отличается от номера Rally Fans Map.'}</p>
    <dialog class="crew-results-dialog" aria-labelledby="crewResultsDialogTitle"><header class="crew-results-dialog-head"><div><h2 id="crewResultsDialogTitle">Результаты экипажей</h2><p class="muted small">Выбери класс, чтобы увидеть весь его состав.</p></div><button class="button crew-results-close" type="button" aria-label="Закрыть результаты">×</button></header><div class="crew-results-toolbar"><label class="sr-only" for="crewResultsStage">Спецучасток</label><select id="crewResultsStage" class="crew-results-stage"></select><label class="sr-only" for="crewResultsDialogClass">Класс</label><select id="crewResultsDialogClass" class="crew-results-stage"><option value="">Все классы</option></select><input id="crewResultsSearch" class="search" placeholder="Поиск по экипажу, номеру или машине…" aria-label="Поиск экипажа" /></div><div class="crew-results-table-wrap"><table class="crew-results-table"><thead><tr><th scope="col">Место</th><th scope="col">Экипаж</th><th scope="col">Автомобиль / зачёт</th><th scope="col" id="crewResultsTimeHeading">Время</th><th scope="col"><span class="sr-only">Подписка</span></th></tr></thead><tbody class="crew-results-body"></tbody></table></div></dialog>
  </section>`;
  const form=root.querySelector('form');
  const input=root.querySelector('#asmgRaceId');
  const status=root.querySelector('.crew-results-status');
  const openButton=root.querySelector('#crewResultsOpen');
  const dialog=root.querySelector('.crew-results-dialog');
  const stageSelect=root.querySelector('#crewResultsStage');
  const classFilter=root.querySelector('#crewResultsClass');
  const dialogClassFilter=root.querySelector('#crewResultsDialogClass');
  const classFilterPanel=root.querySelector('#crewResultsClassFilter');
  const search=root.querySelector('#crewResultsSearch');
  const tableBody=root.querySelector('.crew-results-body');
  const timeHeading=root.querySelector('#crewResultsTimeHeading');
  let data=null,resultViews=[],subscriptions=[];
  try{subscriptions=await getCrewSubscriptions();}catch{}

  const openResults=()=>{
    if(!dialog.open)dialog.showModal();
    search.focus();
  };
  openButton.addEventListener('click',openResults);
  root.querySelector('.crew-results-close').addEventListener('click',()=>dialog.close());

  const updateClassOptions=()=>{
    const stage=resultViews.find(view=>view.key===stageSelect.value)||resultViews[0];
    const names=crewResultClasses(stage?.results);
    const selected=classFilter.value||dialogClassFilter.value;
    const options='<option value="">Все классы</option>'+names.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('');
    classFilter.innerHTML=options;
    dialogClassFilter.innerHTML=options;
    if(names.includes(selected)){classFilter.value=selected;dialogClassFilter.value=selected;}
  };

  const draw=()=>{
    if(!data)return;
    const stage=resultViews.find(view=>view.key===stageSelect.value)||resultViews[0];
    const results=stage?.results||[];
    const query=search.value.trim();
    const className=dialogClassFilter.value;
    const visible=visibleCrewResults(results,query,{className,limitToTopThree:false});
    timeHeading.textContent=stage?.name||'Время';
    tableBody.innerHTML=visible.length?visible.map(result=>{
      const id=String(result?.crew?.id||result?.crew?.number||resultName(result));
      return resultRow(result,filterCrewResultsByClass(results,className).indexOf(result),stage,subscriptions.some(s=>s.key===subscriptionKey(data.eventId,id)));
    }).join():'<tr><td colspan="5" class="crew-results-empty">Экипажи по этому запросу не найдены.</td></tr>';
    tableBody.querySelectorAll('[data-subscribe]').forEach(button=>button.addEventListener('click',async event=>{
      event.preventDefault();event.stopPropagation();
      const crewId=button.dataset.subscribe,key=subscriptionKey(data.eventId,crewId);
      try{
        if(subscriptions.some(item=>item.key===key)){
          await deleteCrewSubscription(key);subscriptions=subscriptions.filter(item=>item.key!==key);
          status.textContent=`Подписка на экипаж ${button.dataset.name} отключена.`;
        }else{
          const subscription={key,asmgRaceId:String(data.eventId),crewId,name:button.dataset.name,raceId:String(pkg.raceId??pkg.id),raceName:pkg.name,addedAt:new Date().toISOString()};
          await saveCrewSubscription(subscription);subscriptions.push(subscription);
          status.textContent=`Экипаж ${button.dataset.name} добавлен. Результаты будут обновляться при периодической синхронизации и сохраняться офлайн.`;
        }
        requestCrewResultsBackgroundRefresh(await navigator.serviceWorker?.ready?.catch?.(()=>null));
        draw();
      }catch(error){status.textContent=`Не удалось изменить подписку: ${error.message||error}`;}
    }));
  };
  stageSelect.addEventListener('change',()=>{updateClassOptions();draw();});
  classFilter.addEventListener('change',()=>{dialogClassFilter.value=classFilter.value;draw();});
  dialogClassFilter.addEventListener('change',()=>{classFilter.value=dialogClassFilter.value;draw();});
  search.addEventListener('input',draw);
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const id=input.value.trim();status.textContent='Загружаю результаты АСМГ…';
    try{
      data=await fetchAsmgResults(id);
      resultViews=crewResultViews(data.eventResults);
      pkg.asmgRaceId=id;pkg.crewResults={eventId:data.eventId,updatedAt:data.updatedAt||new Date().toISOString()};
      await savePackage(pkg);
      stageSelect.innerHTML=resultViews.map(view=>`<option value="${view.key}">${esc(view.name)}</option>`).join('');
      stageSelect.value='overall';
      updateClassOptions();
      classFilterPanel.hidden=false;
      openButton.hidden=false;
      status.textContent=`${data.tournamentTitle?`${data.tournamentTitle} · `:''}${data.eventResults.length} спецучастка · сохранено для офлайн-доступа.`;
      draw();
    }catch(error){
      status.textContent=`${error.message||error} Проверь номер гонки и подключение.`;
    }
  });
  if(root.__crewResultsRefreshListener)window.removeEventListener('rfm:periodic-update',root.__crewResultsRefreshListener);
  root.__crewResultsRefreshListener=event=>{
    if(!root.isConnected||!input.value.trim())return;
    if(event.detail?.scope&&event.detail.scope!=='crew-results')return;
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  };
  window.addEventListener('rfm:periodic-update',root.__crewResultsRefreshListener);

  if(asmgRaceId){
    try{
      data=await fetchAsmgResults(asmgRaceId);
      resultViews=crewResultViews(data.eventResults);
      if(!root.isConnected)return;
      stageSelect.innerHTML=resultViews.map(view=>`<option value="${view.key}">${esc(view.name)}</option>`).join('');
      stageSelect.value='overall';
      updateClassOptions();
      classFilterPanel.hidden=false;
      openButton.hidden=false;
      const updatedAt=data.updatedAt||new Date().toISOString();
      pkg.crewResults={eventId:data.eventId,updatedAt};
      await savePackage(pkg);
      const stamp=new Date(updatedAt).toLocaleString();
      status.textContent=`${data.tournamentTitle?`${data.tournamentTitle} · `:''}обновлено ${stamp}. Результаты доступны офлайн.`;
      draw();
    }catch(error){
      status.textContent=`Нет новых данных. ${error.message||error} Если результаты уже загружались, проверь, что для этой гонки сохранена последняя версия приложения.`;
    }
  }
}
