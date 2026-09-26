import React, { useEffect, useState } from 'react';
import { assetUrl } from '../rallyfans.js';
import { todaySummary } from '../app/today-summary.js';
import { distanceFromTodayDays } from '../app/catalog-dates.js';
import TodayLeaders from './TodayLeaders.jsx';

export default function TodayTab({app,onMap}){
  const current=app.catalog.find(race=>distanceFromTodayDays(race)===0)||null;
  const downloaded=Boolean(current&&app.downloadedIds.has(Number(current.id)));
  const todayPackage=app.currentPackage||app.packages.find(item=>distanceFromTodayDays(item.original||item.summary||item)===0)||null;
  const [now,setNow]=useState(()=>new Date());
  useEffect(()=>{
    const update=()=>setNow(new Date());
    const timer=setInterval(update,30000);
    document.addEventListener('visibilitychange',update);
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',update);};
  },[]);
  const summary=todaySummary(todayPackage,now);
  if(!todayPackage&&current&&!downloaded)return <section className="today-empty"><div className="block-title">Сегодня</div><strong>{current.name}</strong><p className="muted">Гонка проходит сегодня. Скачай Rally Pack сейчас, чтобы карта, программа и результаты работали без связи.</p><button className="button primary" onClick={()=>app.downloadRace(Number(current.id))}>Скачать Rally Pack</button></section>;
  if(!todayPackage)return <section className="today-empty"><div className="block-title">Сегодня</div><p className="muted">Нет сохранённой гонки на сегодня.</p></section>;
  const raceId=Number(todayPackage.raceId||todayPackage.original?.id||todayPackage.original?.raceId||todayPackage.id);
  const image=todayPackage.original?.image||todayPackage.image;
  const refreshProgress=app.raceProgress[raceId];
  const hasSavedPack=app.downloadedIds.has(raceId);
  return <section className="today-screen"><article className="today-race-card" style={{'--race-bg':`url('${assetUrl(image||'')}')`}}><div className="today-race-shade"/><div className="today-race-copy"><div className="eyebrow">сохранённая гонка</div><h2>{todayPackage.name}</h2><p>{todayPackage.summary?.dates||'Расписание сохранено офлайн'}</p></div><button className="button primary" onClick={()=>app.downloadRace(raceId)} disabled={!Number.isFinite(raceId)}>{refreshProgress||(hasSavedPack?'Обновить Rally Pack':'Скачать Rally Pack')}</button></article><section className="today-card"><div className="block-title">{summary.scheduleLabel}</div>{summary.schedule.length?summary.schedule.map((item,index)=><button className="today-stage" key={index} onClick={onMap}><strong>{item.location||'Событие'}</strong><span>{(item.events||[]).map(event=>`${event.time||''} ${event.text||''}`.trim()).join(' · ')||'Открыть на карте'}</span></button>):<p className="muted">В расписании нет событий.</p>}</section><TodayLeaders key={todayPackage.id} pkg={todayPackage}/><button className="button primary today-map-button" onClick={onMap}>Открыть карту</button></section>;
}
