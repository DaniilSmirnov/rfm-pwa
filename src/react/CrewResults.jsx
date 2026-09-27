import React, { useEffect, useMemo, useRef, useState } from 'react';
import { deleteCrewSubscription, getCrewSubscriptions, saveCrewSubscription, savePackage } from '../db.js';
import { requestCrewResultsBackgroundRefresh } from '../app/runtime.js';
import { crewResultClasses, crewResultViews, fetchAsmgResults, filterCrewResultsByClass, visibleCrewResults } from '../app/crew-results.js';

const resultLabel=result=>[
  [result?.crew?.pilot?.lastName,result?.crew?.pilot?.firstName].filter(Boolean).join(' '),
  [result?.crew?.navigator?.lastName,result?.crew?.navigator?.firstName].filter(Boolean).join(' ')
].filter(Boolean).join(' / ')||`Экипаж № ${result?.crew?.number||'—'}`;
const subscriptionKey=(raceId,crewId)=>`${raceId}:${crewId}`;

export default function CrewResults({pkg,open=false,onOpen,onClose}){
  const dialog=useRef(null);
  const searchRef=useRef(null);
  const asmgRaceId=String(pkg?.asmgRaceId??pkg?.original?.asmg_id??pkg?.original?.asmgId??'55');
  const [raceId,setRaceId]=useState(asmgRaceId);
  const [data,setData]=useState(()=>pkg?.crewResults?.eventResults?{eventId:pkg.crewResults.eventId||asmgRaceId,eventResults:pkg.crewResults.eventResults,tournamentTitle:pkg.crewResults.tournamentTitle||''}:null);
  const [status,setStatus]=useState(()=>pkg?.crewResults?.eventResults?'Показана сохранённая версия результатов.':'Загружаю результаты…');
  const [busy,setBusy]=useState(false);
  const [subscriptions,setSubscriptions]=useState([]);
  const [stageKey,setStageKey]=useState('overall');
  const [className,setClassName]=useState('');
  const [query,setQuery]=useState('');
  const views=useMemo(()=>crewResultViews(data?.eventResults),[data]);
  const activeView=views.find(view=>view.key===stageKey)||views[0];
  const classes=useMemo(()=>crewResultClasses(activeView?.results),[activeView]);
  const visible=useMemo(()=>visibleCrewResults(activeView?.results,query,{className,limitToTopThree:false}),[activeView,query,className]);

  useEffect(()=>{setRaceId(asmgRaceId);},[asmgRaceId]);
  useEffect(()=>{
    const node=dialog.current;
    if(!node)return;
    if(open&&!node.open){node.showModal();requestAnimationFrame(()=>searchRef.current?.focus());}
    else if(!open&&node.open)node.close();
  },[open]);

  useEffect(()=>{
    let cancelled=false;
    const saved=pkg?.crewResults;
    setData(Array.isArray(saved?.eventResults)?{eventId:saved.eventId||asmgRaceId,eventResults:saved.eventResults,tournamentTitle:saved.tournamentTitle||''}:null);
    setStageKey('overall');setClassName('');setQuery('');
    if(saved?.eventResults)setStatus(`Показана сохранённая версия результатов${saved.updatedAt?` · ${new Date(saved.updatedAt).toLocaleString()}`:''}.`);
    else setStatus(asmgRaceId?'Загружаю результаты…':'Введи номер гонки на asmg.ru.');
    getCrewSubscriptions().then(items=>{if(!cancelled)setSubscriptions(items);}).catch(()=>{});
    const update=event=>{
      if(event.detail?.scope&&event.detail.scope!=='crew-results')return;
      if(asmgRaceId)void loadResults(asmgRaceId,{automatic:true});
    };
    window.addEventListener('rfm:periodic-update',update);
    if(asmgRaceId)void loadResults(asmgRaceId,{automatic:true});
    return()=>{cancelled=true;window.removeEventListener('rfm:periodic-update',update);};
  },[pkg?.id]);

  async function loadResults(id,{automatic=false}={}){
    if(!id)return;
    if(!automatic)setBusy(true);
    if(!automatic)setStatus('Загружаю результаты АСМГ…');
    try{
      const next=await fetchAsmgResults(id);
      const snapshot={eventId:next.eventId,eventResults:next.eventResults,tournamentTitle:next.tournamentTitle||''};
      const updatedPackage={...pkg,asmgRaceId:id,crewResults:{...snapshot,updatedAt:next.updatedAt||new Date().toISOString()}};
      await savePackage(updatedPackage);
      setRaceId(id);setData(snapshot);setStageKey('overall');setClassName('');setQuery('');
      setStatus(`${next.tournamentTitle?`${next.tournamentTitle} · `:''}${next.eventResults.length} спецучастка · сохранено для офлайн-доступа.`);
      window.dispatchEvent(new CustomEvent('rfm:crew-results-updated',{detail:{packageId:pkg.id,results:updatedPackage.crewResults}}));
    }catch(error){
      setStatus(automatic?`Нет новых данных. ${error.message||error} Если результаты уже загружались, проверь, что для этой гонки сохранена последняя версия приложения.`:`${error.message||error} Проверь номер гонки и подключение.`);
    }finally{if(!automatic)setBusy(false);}
  }

  async function toggleSubscription(result){
    const crewId=String(result?.crew?.id||result?.crew?.number||resultLabel(result));
    const name=resultLabel(result);
    const key=subscriptionKey(data.eventId,crewId);
    try{
      if(subscriptions.some(item=>item.key===key)){
        await deleteCrewSubscription(key);setSubscriptions(items=>items.filter(item=>item.key!==key));
        setStatus(`Подписка на экипаж ${name} отключена.`);
      }else{
        const subscription={key,asmgRaceId:String(data.eventId),crewId,name,raceId:String(pkg.raceId??pkg.id),raceName:pkg.name,addedAt:new Date().toISOString()};
        await saveCrewSubscription(subscription);setSubscriptions(items=>[...items,subscription]);
        setStatus(`Экипаж ${name} добавлен. Результаты будут обновляться при периодической синхронизации и сохраняться офлайн.`);
      }
      requestCrewResultsBackgroundRefresh(await navigator.serviceWorker?.ready?.catch?.(()=>null));
    }catch(error){setStatus(`Не удалось изменить подписку: ${error.message||error}`);}
  }

  if(!pkg)return null;
  const selectedClassResults=filterCrewResultsByClass(activeView?.results,className);
  return <section className="crew-results-section" aria-labelledby="crewResultsTitle">
    <div className="section-head"><div><div id="crewResultsTitle" className="block-title">РЕЗУЛЬТАТЫ ЭКИПАЖЕЙ</div><p className="muted small">Открой таблицу, когда захочешь посмотреть результаты.</p></div><button className="button primary" id="crewResultsOpen" type="button" hidden={!data} onClick={onOpen}>Открыть результаты</button></div>
    {data&&<div className="crew-results-class-filter" id="crewResultsClassFilter"><label htmlFor="crewResultsClass">Класс</label><select id="crewResultsClass" className="crew-results-stage" value={className} onChange={event=>setClassName(event.target.value)}><option value="">Все классы</option>{classes.map(name=><option key={name} value={name}>{name}</option>)}</select></div>}
    <form className="crew-results-controls" onSubmit={event=>{event.preventDefault();void loadResults(raceId);}}><label htmlFor="asmgRaceId">Номер гонки на АСМГ</label><div className="crew-results-load"><input id="asmgRaceId" inputMode="numeric" pattern="[0-9]*" value={raceId} onChange={event=>setRaceId(event.target.value)} aria-label="Номер гонки на АСМГ"/><button className="button compact primary" type="submit" disabled={busy}>{busy?'Загрузка…':data?'Обновить':'Загрузить результаты'}</button></div></form>
    <p className="muted small crew-results-status" aria-live="polite">{status}</p>
    <dialog ref={dialog} className="crew-results-dialog" aria-labelledby="crewResultsDialogTitle" onClose={onClose}>
      <header className="crew-results-dialog-head"><div><h2 id="crewResultsDialogTitle">Результаты экипажей</h2><p className="muted small">Выбери класс, чтобы увидеть весь его состав.</p></div><button className="button crew-results-close" type="button" aria-label="Закрыть результаты" onClick={()=>dialog.current?.close()}>×</button></header>
      <div className="crew-results-toolbar"><label className="sr-only" htmlFor="crewResultsStage">Спецучасток</label><select id="crewResultsStage" className="crew-results-stage" value={activeView?.key||''} onChange={event=>{setStageKey(event.target.value);setClassName('');}}>{views.map(view=><option key={view.key} value={view.key}>{view.name}</option>)}</select><label className="sr-only" htmlFor="crewResultsDialogClass">Класс</label><select id="crewResultsDialogClass" className="crew-results-stage" value={className} onChange={event=>setClassName(event.target.value)}><option value="">Все классы</option>{classes.map(name=><option key={name} value={name}>{name}</option>)}</select><input ref={searchRef} id="crewResultsSearch" className="search" placeholder="Поиск по экипажу, номеру или машине…" aria-label="Поиск экипажа" value={query} onChange={event=>setQuery(event.target.value)}/></div>
      <div className="crew-results-table-wrap"><table className="crew-results-table"><thead><tr><th scope="col">Место</th><th scope="col">Экипаж</th><th scope="col">Автомобиль / зачёт</th><th scope="col" id="crewResultsTimeHeading">{activeView?.name||'Время'}</th><th scope="col"><span className="sr-only">Подписка</span></th></tr></thead><tbody className="crew-results-body">
        {visible.length?visible.map(result=>{
          const crew=result?.crew||{};
          const id=String(crew.id||crew.number||resultLabel(result));
          const subscribed=subscriptions.some(item=>item.key===subscriptionKey(data.eventId,id));
          const place=selectedClassResults.indexOf(result)+1;
          const retired=result.goingOff||result.goingOffAfterSu;
          return <tr data-crew-row data-search={`${crew.number||''} ${resultLabel(result)} ${crew.car||''} ${result?.discipline?.name||''}`.toLocaleLowerCase('ru')} key={id}><td className="crew-results-place">{retired?'—':place}</td><td className="crew-results-name"><strong>{resultLabel(result)}</strong><small>№ {crew.number||'—'}</small></td><td>{crew.car||'Автомобиль не указан'}<small>{result?.discipline?.name||'Зачёт не указан'}</small></td><td className="crew-results-time">{retired?(result.reasonGoingOff||(result.goingOff?'Сход':'Сход после финиша')):(result.formattedTime||'Время пока недоступно')}{result.formattedTimePenalty&&<small>Штраф {result.formattedTimePenalty}</small>}</td><td><button className={`button compact crew-subscribe-button ${subscribed?'downloaded':''}`} type="button" data-subscribe={id} data-name={resultLabel(result)} aria-label={`${subscribed?'Отписаться от экипажа':'Следить за экипажем'}: ${resultLabel(result)}`} onClick={()=>void toggleSubscription(result)}>{subscribed?'Отписаться':'Подписаться'}</button></td></tr>;
        }):<tr><td colSpan="5" className="crew-results-empty">Экипажи по этому запросу не найдены.</td></tr>}
      </tbody></table></div>
    </dialog>
  </section>;
}
