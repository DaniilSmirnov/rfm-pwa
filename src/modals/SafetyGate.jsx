import './SafetyGate.css';
import React, { useEffect, useRef, useState } from 'react';
import SafetyMemo from '../components/SafetyMemo.jsx';

export default function SafetyGate({onAccept,onClose,fullScreen=false}){
  const content=useRef(null);
  const [readToEnd,setReadToEnd]=useState(false);

  useEffect(()=>{
    const node=content.current;
    if(!node)return;
    const check=()=>setReadToEnd(node.scrollTop+node.clientHeight>=node.scrollHeight-8);
    node.addEventListener('scroll',check,{passive:true});
    check();
    return()=>{
      node.removeEventListener('scroll',check);
    };
  },[]);

  useEffect(()=>{
    let previousTouchY=null;
    const recordTouchStart=event=>{previousTouchY=event.touches[0]?.clientY??null;};
    const preventBackgroundScroll=event=>{
      const node=content.current;
      if(!node?.contains(event.target)){
        event.preventDefault();
        return;
      }
      const currentTouchY=event.touches[0]?.clientY;
      if(currentTouchY==null||previousTouchY==null)return;
      const deltaY=currentTouchY-previousTouchY;
      previousTouchY=currentTouchY;
      const maxScroll=node.scrollHeight-node.clientHeight;
      const atTop=node.scrollTop<=0;
      const atBottom=node.scrollTop>=maxScroll-1;
      if(maxScroll<=0||(atTop&&deltaY>0)||(atBottom&&deltaY<0))event.preventDefault();
    };
    document.addEventListener('touchstart',recordTouchStart,{passive:true});
    document.addEventListener('touchmove',preventBackgroundScroll,{passive:false});
    return()=>{
      document.removeEventListener('touchstart',recordTouchStart);
      document.removeEventListener('touchmove',preventBackgroundScroll);
    };
  },[]);

  return <section className={`safety-gate${fullScreen?' safety-gate-fullscreen':''}`} role="dialog" aria-modal="true" aria-labelledby="safetyGateTitle">
    {fullScreen&&<button className="button compact safety-close" type="button" aria-label="Закрыть правила безопасности" onClick={onClose}>Закрыть</button>}
    <div className="safety-gate-content" ref={content} tabIndex={0} aria-label="Памятка по безопасности">
      <SafetyMemo/>
    </div>
    {!fullScreen&&<button className="button primary safety-accept" type="button" disabled={!readToEnd} onClick={onAccept}>
      {readToEnd?'Прочитал(а), открыть карту':'Прокрути памятку до конца'}
    </button>}
  </section>;
}
