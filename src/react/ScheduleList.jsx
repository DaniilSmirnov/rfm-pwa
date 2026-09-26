import React, { useEffect, useRef } from 'react';
import { renderSchedule } from '../app/schedule-ui.js';

export default function ScheduleList({pkg,schedule,onStageSelect}){
  const root=useRef(null);
  useEffect(()=>{
    const node=root.current;
    renderSchedule(pkg,{root:node,schedule,onStageSelect});
    return()=>node?.replaceChildren();
  },[pkg,schedule,onStageSelect]);
  return <div className="schedule-list" ref={root}/>;
}
