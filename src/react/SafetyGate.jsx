import React, { useEffect, useRef, useState } from 'react';
import { assetUrl } from '../rallyfans.js';

export default function SafetyGate({pkg,onAccept,onClose,fullScreen=false}){
  const content=useRef(null);
  const [readToEnd,setReadToEnd]=useState(false);
  useEffect(()=>{
    const node=content.current;
    if(!node)return;
    const image=node.querySelector('img');
    const check=()=>{
      if(image&&!image.complete)return;
      setReadToEnd(node.scrollTop+node.clientHeight>=node.scrollHeight-8);
    };
    node.addEventListener('scroll',check,{passive:true});
    image?.addEventListener('load',check);
    image?.addEventListener('error',check);
    if(!image||image.complete)check();
    return()=>{node.removeEventListener('scroll',check);image?.removeEventListener('load',check);image?.removeEventListener('error',check);};
  },[pkg]);
  const leaflet=pkg?.original?.safety_leaflet;
  return <section className={`safety-gate${fullScreen?' safety-gate-fullscreen':''}`} role="dialog" aria-modal="true" aria-labelledby="safetyGateTitle">
    <header className={`safety-gate-head${fullScreen?' safety-gate-head-fullscreen':''}`}><div><span className="eyebrow">{fullScreen?'ПАМЯТКА ЗРИТЕЛЯ':'ПЕРЕД ПРОСМОТРОМ КАРТЫ'}</span><h2 id="safetyGateTitle">Правила безопасности</h2>
      <p>Зритель сам отвечает за свою безопасность. Следуй указаниям организаторов и не заходи в опасные зоны.</p></div>
      {fullScreen&&<button className="button compact safety-close" type="button" aria-label="Закрыть правила безопасности" onClick={onClose}>Закрыть</button>}
    </header>
    <div className="safety-gate-content" ref={content} tabIndex={0} aria-label="Памятка по безопасности">
      {leaflet&&<img className="safety-leaflet" src={assetUrl(leaflet)} alt="Памятка по безопасности от организатора"/>}
      <ol className="safety-rules">
        <li>Соблюдай указания маршалов и сотрудников полиции.</li>
        <li>Находись только в разрешённых зрительских зонах и за ограждениями.</li>
        <li>Не стой на траектории движения и не выходи на дорогу спецучастка.</li>
        <li>Не перемещайся по трассе во время заезда и закрытия дороги.</li>
        <li>При опасности немедленно отойди в безопасное место.</li>
      </ol>
      <p>Памятка и правила организатора обязательны для прочтения перед просмотром карты.</p>
    </div>
    {fullScreen?<button className="button primary safety-accept" type="button" onClick={onClose}>Закрыть правила</button>:<button className="button primary safety-accept" type="button" disabled={!readToEnd} onClick={onAccept}>
      {readToEnd?'Прочитал(а), открыть карту':'Прокрути памятку до конца'}
    </button>}
  </section>;
}
