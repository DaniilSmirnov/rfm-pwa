import './CompassReadout.css';
import React,{useMemo,useSyncExternalStore} from 'react';
import {bearingDegrees,compassDirection,distanceMeters} from '../app/geo.js';
import {normalizePoint} from '../navigation.js';
import {getCompassHeading,subscribeCompassHeading} from '../hooks/compass-heading.js';
import {formatDistance} from '../app/geo.js';
export default function CompassReadout({point,userPos}){
  const heading=useSyncExternalStore(subscribeCompassHeading,getCompassHeading,getCompassHeading);
  const compass=useMemo(()=>{
    if(!point||!userPos)return null;
    try{
      const target=normalizePoint(point),here={lat:Number(userPos.latitude),lon:Number(userPos.longitude)};
      const bearing=bearingDegrees(here,target),distance=distanceMeters(here,target);
      return {bearing,distance,relative:Number.isFinite(heading)?((bearing-heading)+360)%360:bearing,direction:compassDirection(bearing)};
    }catch{return null;}
  },[point,userPos,heading]);
  return <>
    {compass&&<div id="compassDisplay" className="compass-display"><div className="compass-dial" aria-hidden="true"><span className="compass-north">N</span><span id="compassArrow" className="compass-arrow" style={{transform:`translate(-50%,-55%) rotate(${compass.relative}deg)`}}>↑</span></div><div className="compass-copy"><strong id="compassDistance">{formatDistance(compass.distance)}</strong><span id="compassBearing" className="muted">Азимут {Math.round(compass.bearing)}° · {compass.direction}</span></div></div>}
    <p id="compassStatus" className="muted small">{compass?'Компас включён.':point?'Нужна геопозиция для расчёта направления.':'Сначала выбери точку.'}</p>
  </>;
}
