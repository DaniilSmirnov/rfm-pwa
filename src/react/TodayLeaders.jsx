import React, { useEffect, useState } from 'react';
import { crewName, crewResultClasses, filterCrewResultsByClass, overallCrewResults } from '../app/crew-results.js';

export default function TodayLeaders({pkg}){
  const [snapshot,setSnapshot]=useState(pkg.crewResults);
  useEffect(()=>{
    setSnapshot(pkg.crewResults);
    const update=event=>{
      if(event.detail?.packageId===pkg.id) setSnapshot(event.detail.results);
    };
    window.addEventListener('rfm:crew-results-updated',update);
    return()=>window.removeEventListener('rfm:crew-results-updated',update);
  },[pkg]);
  const results=overallCrewResults(snapshot?.eventResults)
    .filter(result=>!result.goingOff&&!result.goingOffAfterSu&&result.time>0);
  const classes=crewResultClasses(results);
  return <section className="today-card today-leaders">
    <div className="block-title">ЛИДЕРЫ КЛАССОВ</div>
    <p className="muted small">По общему результату пройденных СУ</p>
    {classes.length?classes.map(className=>{
      const leader=filterCrewResultsByClass(results,className)[0];
      return <article className="today-stage" key={className}>
        <strong>{className} · 1 место</strong>
        <span>№ {leader.crew?.number||'—'} · {crewName(leader.crew)||'Экипаж'}</span>
        <span>{leader.crew?.car} · {leader.formattedTime}</span>
      </article>;
    }):<p className="muted">Результаты пока не загружены или нет финишировавших экипажей.</p>}
  </section>;
}
