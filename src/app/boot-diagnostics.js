import { getAllPackages, getMapStorageStats, getLegacyMapTileCount, getMapTile } from '../db.js';
import { buildDownloadPlan } from '../offline-map.js';
import { buildTerrainDownloadPlan } from '../terrain-offline.js';
import { inspectOfflineRevisionSamples } from './offline-diagnostics.js';

const startedAt=performance.now();
const marks=[];
let tapTimes=[];
let storageSnapshot=null;
let refreshPromise=null;
let initialized=false;

function snapshotMeta(){
  const nav=performance.getEntriesByType?.('navigation')?.[0];
  return {
    online:navigator.onLine,
    visibility:document.visibilityState,
    navigationType:nav?.type||'unknown',
    domContentLoadedMs:Math.round(nav?.domContentLoadedEventEnd||0),
    loadEventMs:Math.round(nav?.loadEventEnd||0),
    serviceWorkerControlled:Boolean(navigator.serviceWorker?.controller),
    displayMode:['standalone','fullscreen','minimal-ui'].find(mode=>window.matchMedia?.(`(display-mode: ${mode})`).matches)||'browser',
    userAgent:navigator.userAgent
  };
}

export function markBoot(name,detail=null){
  const entry={name,ms:Math.round(performance.now()-startedAt),detail};
  marks.push(entry);
  window.dispatchEvent(new CustomEvent('rfm:boot-mark',{detail:entry}));
  return entry;
}

export function bootSnapshot(){
  return {startedAt,marks:[...marks],meta:snapshotMeta(),storage:storageSnapshot};
}

export async function collectStorageDiagnostics(){
  if(refreshPromise) return refreshPromise;
  refreshPromise=(async()=>{
    const warnings=[];
    const [packages,tiles,legacyTiles,estimate,persisted,cachesList]=await Promise.all([
      getAllPackages(),getMapStorageStats(),getLegacyMapTileCount(),
      navigator.storage?.estimate?.().catch(()=>null)??null,
      navigator.storage?.persisted?.().catch(()=>false)??false,
      'caches' in window?caches.keys().catch(()=>[]):Promise.resolve([])
    ]);
    const readyMaps=packages.filter(pkg=>pkg?.offlineMap?.ready);
    const readyTerrain=packages.filter(pkg=>pkg?.terrain?.ready);
    const invalidReferences=packages.filter(pkg=>
      (pkg?.offlineMap?.ready&&!pkg.offlineMap.storageId)
      ||(pkg?.terrain?.ready&&!pkg.terrain.storageId)
    ).map(pkg=>pkg?.name||pkg?.id);
    if(invalidReferences.length) warnings.push(`У ${invalidReferences.length} пакетов отсутствует storageId у готовой карты/рельефа.`);
    if(tiles.count===0&&(readyMaps.length||readyTerrain.length)) warnings.push('Метаданные ссылаются на офлайн-тайлы, но их учётное количество равно нулю.');
    if(estimate?.quota&&estimate.quota-estimate.usage<50*1024*1024) warnings.push('Свободно менее 50 МБ браузерного хранилища.');
    const [cacheEntries,revisionSamples]=await Promise.all([Promise.all(cachesList.map(async name=>{
      try{return {name,count:(await (await caches.open(name)).keys()).length};}
      catch(error){warnings.push(`Не удалось прочитать кэш ${name}: ${error?.message||error}`);return {name,count:null};}
    })),inspectOfflineRevisionSamples(packages,{getTile:getMapTile,buildMapPlan:buildDownloadPlan,buildTerrainPlan:buildTerrainDownloadPlan})]);
    if(revisionSamples.samples.some(item=>item.missing)) warnings.push('Не все проверочные тайлы офлайн-ревизий найдены. Обнови или скачай карту/рельеф повторно.');
    if(revisionSamples.samples.some(item=>item.error)) warnings.push('Не удалось полностью проверить одну или несколько офлайн-ревизий.');
    storageSnapshot={
      checkedAt:new Date().toISOString(),
      indexedDb:{name:'rallyfans-offline',packages:packages.length,legacyTiles},
      offline:{readyMaps:readyMaps.length,readyTerrain:readyTerrain.length,metadataTiles:tiles.count,metadataBytes:tiles.bytes},
      browserStorage:{supported:Boolean(navigator.storage),persisted:Boolean(persisted),usageBytes:estimate?.usage??null,quotaBytes:estimate?.quota??null},
      caches:cacheEntries,revisionSamples,warnings
    };
    return storageSnapshot;
  })().finally(()=>{refreshPromise=null;});
  return refreshPromise;
}

function render(){
  const list=document.getElementById('bootDiagnosticsList');
  const meta=document.getElementById('bootDiagnosticsMeta');
  if(!list||!meta) return;
  const snap=bootSnapshot();
  list.innerHTML=snap.marks.length
    ? snap.marks.map((entry,index)=>{
        const previous=index?snap.marks[index-1].ms:0;
        const delta=entry.ms-previous;
        const detail=entry.detail==null?'':`<small>${escapeHtml(typeof entry.detail==='string'?entry.detail:JSON.stringify(entry.detail))}</small>`;
        return `<div class="boot-diagnostic-row"><span>${escapeHtml(entry.name)}</span><strong>${entry.ms} ms</strong><em>+${delta} ms</em>${detail}</div>`;
      }).join('')
    : '<p class="muted">Пока нет отметок.</p>';
  meta.textContent=[
    `online: ${snap.meta.online}`,
    `display: ${snap.meta.displayMode}`,
    `navigation: ${snap.meta.navigationType}`,
    `SW controlled: ${snap.meta.serviceWorkerControlled}`,
    `DOMContentLoaded: ${snap.meta.domContentLoadedMs} ms`,
    `load: ${snap.meta.loadEventMs} ms`,
    snap.meta.userAgent,
    snap.storage?`\nЛокальные данные:\n${JSON.stringify(snap.storage,null,2)}`:'\nЛокальные данные: нажми «Проверить локальное хранилище». '
  ].join('\n');
}

function escapeHtml(value){
  return String(value??'').replace(/[&<>"']/g,ch=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[ch]);
}

export function openBootDiagnostics(){
  const modal=document.getElementById('bootDiagnosticsModal');
  if(!modal) return;
  render();
  modal.hidden=false;
  document.body.classList.add('modal-open');
}

function close(){
  const modal=document.getElementById('bootDiagnosticsModal');
  if(!modal) return;
  modal.hidden=true;
  document.body.classList.remove('modal-open');
}

async function copy(){
  const snap=bootSnapshot();
  const text=JSON.stringify(snap,null,2);
  try{
    await navigator.clipboard.writeText(text);
    const button=document.getElementById('bootDiagnosticsCopy');
    if(button){
      const old=button.textContent;
      button.textContent='Скопировано';
      setTimeout(()=>{button.textContent=old;},1200);
    }
  }catch{}
}

async function refreshStorage(){
  const button=document.getElementById('bootDiagnosticsRefresh');
  if(button) button.disabled=true;
  try{await collectStorageDiagnostics();render();}
  catch(error){
    storageSnapshot={checkedAt:new Date().toISOString(),error:String(error?.message||error)};
    markBoot('storage-diagnostics-failed',{message:storageSnapshot.error});
    render();
  }finally{if(button)button.disabled=false;}
}

function exportReport(){
  const blob=new Blob([JSON.stringify(bootSnapshot(),null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;link.download=`rfm-diagnostics-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
  link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function setupBootDiagnosticsUi(){
  if(initialized) return;
  initialized=true;
  const logo=document.getElementById('headerLogo');
  if(logo){
    logo.addEventListener('click',()=>{
      const now=Date.now();
      tapTimes=tapTimes.filter(ts=>now-ts<2500);
      tapTimes.push(now);
      if(tapTimes.length>=5){
        tapTimes=[];
        openBootDiagnostics();
      }
    });
  }
  document.getElementById('bootDiagnosticsClose')?.addEventListener('click',close);
  document.getElementById('bootDiagnosticsCopy')?.addEventListener('click',copy);
  document.getElementById('bootDiagnosticsRefreshPackages')?.addEventListener('click',()=>window.dispatchEvent(new Event('rfm:refresh-local-data')));
  document.getElementById('bootDiagnosticsRefresh')?.addEventListener('click',refreshStorage);
  document.getElementById('bootDiagnosticsExport')?.addEventListener('click',exportReport);
  document.getElementById('bootDiagnosticsModal')?.addEventListener('click',event=>{
    if(event.target?.id==='bootDiagnosticsModal') close();
  });
}

markBoot('app-script-start');
