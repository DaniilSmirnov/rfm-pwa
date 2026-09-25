const startedAt=performance.now();
const marks=[];
let tapTimes=[];

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
  return {startedAt,marks:[...marks],meta:snapshotMeta()};
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
    snap.meta.userAgent
  ].join('\n');
}

function escapeHtml(value){
  return String(value??'').replace(/[&<>"']/g,ch=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[ch]);
}

function open(){
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

export function setupBootDiagnosticsUi(){
  const logo=document.getElementById('headerLogo');
  if(logo){
    logo.addEventListener('click',()=>{
      const now=Date.now();
      tapTimes=tapTimes.filter(ts=>now-ts<2500);
      tapTimes.push(now);
      if(tapTimes.length>=5){
        tapTimes=[];
        open();
      }
    });
  }
  document.getElementById('bootDiagnosticsClose')?.addEventListener('click',close);
  document.getElementById('bootDiagnosticsCopy')?.addEventListener('click',copy);
  document.getElementById('bootDiagnosticsModal')?.addEventListener('click',event=>{
    if(event.target?.id==='bootDiagnosticsModal') close();
  });
}

markBoot('app-script-start');
