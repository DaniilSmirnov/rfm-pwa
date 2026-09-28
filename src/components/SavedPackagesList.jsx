import React from 'react';
import { formatBytes } from '../app/format.js';
import './SavedPackages.css';

export default function SavedPackagesList({app}){
  if(!app.packages.length) return <p className="muted">Пока ничего не скачано.</p>;
  if(!app.visiblePackages.length) return <p className="muted">Ничего не найдено.</p>;
  return <>{app.visiblePackages.map(p=>{
    const summary=[p.summary?.stage,p.summary?.dates,p.summary?.city].filter(Boolean).join(' · ');
    return <button className="package-row" key={p.id} onClick={()=>app.selectPackage(p.id)}>
      <span><strong className="package-name">{p.name}</strong><small className="package-meta">{summary||`${p.geojson?.features?.length||0} объектов · ${formatBytes(p.size)}`}</small></span>
      <img className="row-arrow" src="/assets/arrow-right.svg" alt="" />
    </button>;
  })}</>;
}
