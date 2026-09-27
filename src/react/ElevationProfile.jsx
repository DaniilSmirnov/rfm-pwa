import React, { useEffect, useState } from 'react';
import { routeElevationData } from '../app/elevation-ui.js';
import { profileChartGeometry } from '../app/elevation-chart.js';

function ElevationChart({profile}){
  const chart=profileChartGeometry(profile);
  if(!chart)return null;
  const path=chart.points.map((point,index)=>`${index?'L':'M'}${point.x} ${point.y}`).join(' ');
  return <svg className="elevation-chart" viewBox={`0 0 ${chart.width} 240`} role="img" aria-label="Профиль высот">
    {chart.levels.map(level=><g className="elevation-grid-row" key={level.value}><line x1={chart.left} y1={level.y} x2={chart.right} y2={level.y}/><text x={chart.left-8} y={level.y+4} textAnchor="end">{Math.round(level.value)} м</text></g>)}
    <path className="elevation-profile-line" d={path} fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round"/>
    <text className="elevation-distance-label" x={chart.right} y={234} textAnchor="end">{chart.distanceLabel}</text>
  </svg>;
}

export default function ElevationProfile({route,terrain}){
  const [result,setResult]=useState(null);
  useEffect(()=>{
    if(!route){setResult(null);return undefined;}
    let cancelled=false;
    setResult({state:terrain?.ready?'loading':'unavailable',message:terrain?.ready?'Строю профиль по локальному DEM…':'Скачай рельеф, чтобы построить профиль высот.'});
    routeElevationData(terrain,route).then(value=>{if(!cancelled)setResult(value);});
    return()=>{cancelled=true;};
  },[route,terrain]);
  if(!route)return null;
  const profile=result?.profile;
  return <section id="elevationProfilePanel" className="elevation-profile-panel">
    <div className="block-title" id="elevationProfileTitle">{route.name||'ПРОФИЛЬ ВЫСОТ'}</div>
    {profile?<><div className="elevation-stats"><strong>{(profile.distance/1000).toFixed(1)} км</strong><span>мин. {Math.round(profile.min)} м</span><span>макс. {Math.round(profile.max)} м</span><span>набор +{Math.round(profile.gain)} м</span><span>сброс −{Math.round(profile.loss)} м</span></div><ElevationChart profile={profile}/></>:<p className="muted small">{result?.message||'Строю профиль по локальному DEM…'}</p>}
  </section>;
}
