import React, { useEffect, useState } from 'react';
import { assetUrl } from '../rallyfans.js';
import { sanitizeRichHtml } from '../app/sanitize.js';
import { raceHasFinished } from '../app/today-summary.js';

const asArray=value=>Array.isArray(value)?value:(value&&typeof value==='object'?Object.values(value):[]);
const legacyImages=(object,keys)=>keys.map(key=>object?.[key]).filter(value=>typeof value==='string'&&value.trim());
const modernImages=items=>asArray(items).map(item=>item?.image).filter(value=>typeof value==='string'&&value.trim());
const unique=values=>[...new Set(values)];

function MediaSection({title,images,emptyText='Информация появится позже :)',onOpen}){
  const list=unique(images);
  return <details className="race-material collapsible-section">
    <summary><span className="block-title">{title}</span><span className="summary-meta">{list.length?` · ${list.length}`:''}</span><span className="summary-chevron">⌄</span></summary>
    <div className="collapsible-body">{list.length?<div className="media-strip">{list.map((name,index)=><button key={`${name}-${index}`} className="media-card" data-media-name={name} type="button" aria-label={`Открыть ${title} ${index+1}`} onClick={()=>onOpen(name)}><img loading="lazy" src={assetUrl(name)} alt={title}/></button>)}</div>:<p className="gray-label">{emptyText}</p>}</div>
  </details>;
}

export default function RaceMedia({pkg}){
  const [selectedImage,setSelectedImage]=useState('');
  useEffect(()=>{
    if(!selectedImage)return undefined;
    const closeOnEscape=event=>{if(event.key==='Escape')setSelectedImage('');};
    window.addEventListener('keydown',closeOnEscape);
    document.body.classList.add('modal-open');
    return()=>{window.removeEventListener('keydown',closeOnEscape);document.body.classList.remove('modal-open');};
  },[selectedImage]);
  if(!pkg)return null;
  const race=pkg.original||{};
  const crews=[...modernImages(race.lists),...legacyImages(race,['list_crews','list_crews2','list_crews3','list_crews4','list_crews5'])];
  const results=[...modernImages(race.results),...legacyImages(race,['results_race','results_race2','results_race3','results_race4','results_race5'])];
  const known=new Set([race.image,race.mapsimg,race.safety_leaflet,race.overlap_schedule,...crews,...results].filter(Boolean));
  const extra=(pkg.assetNames||[]).filter(name=>!known.has(name)&&name!=='name-pin.jpg');
  const finished=raceHasFinished(pkg);
  const open=name=>setSelectedImage(name);
  return <>
    {race.mapsimg&&<MediaSection title="КАРТА ОРГАНИЗАТОРА" images={[race.mapsimg]} onOpen={open}/>}
    <MediaSection title="ПАМЯТКА ПО БЕЗОПАСНОСТИ" images={race.safety_leaflet?[race.safety_leaflet]:[]} onOpen={open}/>
    <MediaSection title="ЗАЯВЛЕННЫЕ ЭКИПАЖИ" images={crews} onOpen={open}/>
    {!finished&&<MediaSection title="РЕЗУЛЬТАТЫ" images={results} onOpen={open}/>}
    {extra.length>0&&<MediaSection title="МАТЕРИАЛЫ ГОНКИ" images={extra} onOpen={open}/>}
    <details className="race-material collapsible-section"><summary><span className="block-title">КАК ЭТО БЫЛО</span><span className="summary-chevron">⌄</span></summary><div className="collapsible-body">{race.how_it_was?<div className="how-it-was" dangerouslySetInnerHTML={{__html:sanitizeRichHtml(race.how_it_was)}}/>:<p className="gray-label">Информация появится позже :)</p>}</div></details>
    <div id="imageModal" className="image-modal" hidden={!selectedImage} onClick={event=>{if(event.target===event.currentTarget)setSelectedImage('');}}><button id="imageModalClose" className="image-modal-close" aria-label="Закрыть" type="button" onClick={()=>setSelectedImage('')}>×</button><div className="image-modal-inner"><img id="imageModalImg" src={selectedImage?assetUrl(selectedImage):undefined} alt="Материал гонки"/></div></div>
  </>;
}
