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
