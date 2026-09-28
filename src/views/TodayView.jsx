import './TodayView.css';
import React, { useEffect, useState } from 'react';
import Button from '../components/Button.jsx';
import { assetUrl } from '../rallyfans.js';
import { todaySummary } from '../app/today-summary.js';
import { distanceFromTodayDays, nextUpcomingRace } from '../app/catalog-dates.js';
import TodayLeaders from '../components/TodayLeaders.jsx';
import ScheduleList from '../components/ScheduleList.jsx';
import Notice from '../components/Notice.jsx';
import { raceHasFinished } from '../app/today-summary.js';

function packageRaceId(pkg){return Number(pkg?.raceId||pkg?.original?.id||pkg?.original?.raceId||pkg?.id);}
function raceImage(race){return race?.original?.image||race?.image||'';}
function overlaps(race){const value=race?.original?.overlap_schedule||race?.overlap_schedule;return Array.isArray(value)?value.filter(Boolean):value?[value]:[];}

export default function TodayView({app,onMap,onResults}){
  const [now,setNow]=useState(()=>new Date());
  useEffect(()=>{
    const update=()=>setNow(new Date());
    const timer=setInterval(update,30000);
    document.addEventListener('visibilitychange',update);
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',update);};
  },[]);
  const current=app.catalog.find(race=>distanceFromTodayDays(race)===0)||null;
  const upcoming=nextUpcomingRace(app.catalog);
  const finishedPackage=app.currentPackage&&raceHasFinished(app.currentPackage,now)&&distanceFromTodayDays(app.currentPackage,now)===1?app.currentPackage:null;
  const target=current||upcoming||finishedPackage;
  const todayPackage=target?app.packages.find(item=>packageRaceId(item)===Number(target.id))||null:null;
  const previousPackage=target&&app.packages.find(item=>
    packageRaceId(item)!==Number(target.id)&&raceHasFinished(item,now)
  );
  const storageRecommendation=previousPackage&&<Notice as="aside" variant="warning" className="today-storage-recommendation" aria-label="Рекомендация по хранилищу">
    <strong>Освободи место</strong>
    <span>У тебя скачан предыдущий Rally Pack «{previousPackage.name}». Если он больше не нужен офлайн, удали его, чтобы освободить место.</span>
  </Notice>;
  const summary=todaySummary(todayPackage,now);
  if(!todayPackage&&target){
    const date=target.dates||target.date_race||'';
    const isToday=target===current;
    const raceId=Number(target.id);
    return <section className="today-screen"><article className="today-race-card" style={{'--race-bg':`url('${assetUrl(raceImage(target))}')`}}><div className="today-race-shade"/><div className="today-race-copy"><div className="eyebrow">{isToday?'ГОНКА СЕГОДНЯ':'СЛЕДУЮЩАЯ ГОНКА'}</div><h2>{target.name||`Ралли #${raceId}`}</h2><p>{[date,target.city_race_details,target.city_race].filter(Boolean).join(' · ')}</p><p>Гонка будет проходить по расписанию на сайте RallyFansMap.</p></div><Button className="button primary" onClick={()=>app.downloadRace(raceId)}>{app.raceProgress[raceId]||'Скачать Rally Pack'}</Button></article>{storageRecommendation}<section className="today-card"><div className="block-title">РАСПИСАНИЕ</div><p className="muted">Скачай Rally Pack, чтобы сохранить программу, карту и памятку по безопасности.</p></section></section>;
  }
  if(!todayPackage)return <section className="today-empty"><div className="block-title">Сегодня</div><p className="muted">Нет гонки сегодня. Следующая гонка появится здесь, когда будет опубликована на RallyFansMap.</p></section>;
  const raceId=packageRaceId(todayPackage);
  const image=raceImage(todayPackage);
  const refreshProgress=app.raceProgress[raceId];
  const hasSavedPack=app.downloadedIds.has(raceId);
  const overlapImages=overlaps(todayPackage.original||todayPackage);
  const raceFinished=summary.raceFinished||raceHasFinished(todayPackage,now);
  const finishedYesterday=distanceFromTodayDays(todayPackage,now)===1;
  const isUpcoming=packageRaceId(todayPackage)===Number(upcoming?.id);
  return <section className="today-screen"><article className="today-race-card" style={{'--race-bg':`url('${assetUrl(image)}')`}}><div className="today-race-shade"/><div className="today-race-copy"><div className="eyebrow">{raceFinished?'ГОНКА ЗАВЕРШЕНА':current?'ГОНКА СЕГОДНЯ':isUpcoming?'СЛЕДУЮЩАЯ ГОНКА':'сохранённая гонка'}</div><h2>{todayPackage.name}</h2><p>{todayPackage.summary?.dates||'Расписание сохранено офлайн'}</p></div>{!raceFinished&&<Button className="button primary" onClick={()=>app.downloadRace(raceId)} disabled={!Number.isFinite(raceId)}>{refreshProgress||(hasSavedPack?'Обновить Rally Pack':'Скачать Rally Pack')}</Button>}</article>{storageRecommendation}{raceFinished?<section className="today-card"><div className="block-title">ГОНКА ЗАВЕРШЕНА</div><p className="muted">{finishedYesterday?'Гонка завершилась вчера.':'Эта гонка уже завершилась.'}</p></section>:<section className="today-card"><div className="block-title">{summary.scheduleLabel}</div><ScheduleList pkg={todayPackage} schedule={summary.schedule} onStageSelect={onMap}/></section>}{overlapImages.length>0&&<section className="today-card today-overlap"><div className="block-title">ГРАФИК ПЕРЕКРЫТИЙ</div>{overlapImages.map((name,index)=><img key={`${name}-${index}`} src={assetUrl(name)} alt={`График перекрытий ${index+1}`} loading="lazy"/>)}</section>}{!raceFinished?<TodayLeaders key={todayPackage.id} pkg={todayPackage} onResults={onResults}/>:todayPackage.crewResults?.eventResults?.length>0&&<TodayLeaders key={todayPackage.id} pkg={todayPackage}/>}</section>;
}
