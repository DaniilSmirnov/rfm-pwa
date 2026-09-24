import { sanitizeRichHtml } from './sanitize.js';

const asArray=v=>Array.isArray(v)?v:(v&&typeof v==='object'?Object.values(v):[]);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export function legacyImages(obj,keys){return keys.map(k=>obj?.[k]).filter(v=>typeof v==='string'&&v.trim());}
export function modernImages(items){return asArray(items).map(x=>x?.image).filter(v=>typeof v==='string'&&v.trim());}
export function unique(arr){return [...new Set(arr)];}
export function mediaSection(title,images,{assetUrl,emptyText='Информация появится позже :)'}){
  const list=unique(images),count=list.length?` · ${list.length}`:'';
  return `<details class="race-material collapsible-section">
    <summary><span class="block-title">${esc(title)}</span><span class="summary-meta">${esc(count)}</span><span class="summary-chevron">⌄</span></summary>
    <div class="collapsible-body">${list.length?`<div class="media-strip">${list.map((name,i)=>`<button class="media-card" data-media-name="${esc(name)}" aria-label="Открыть ${esc(title)} ${i+1}"><img loading="lazy" src="${assetUrl(name)}" alt="${esc(title)}" /></button>`).join('')}</div>`:`<p class="gray-label">${esc(emptyText)}</p>`}</div>
  </details>`;
}
export function createRaceMediaController({getElement,assetUrl,doc=document,win=window}){
  function openImageModal(name){if(!name)return;getElement('imageModalImg').src=assetUrl(name);getElement('imageModal').hidden=false;doc.body.classList.add('modal-open');}
  function closeImageModal(){getElement('imageModal').hidden=true;getElement('imageModalImg').removeAttribute('src');doc.body.classList.remove('modal-open');}
  function renderRaceMedia(p){
    const race=p.original||{};
    const crews=[...modernImages(race.lists),...legacyImages(race,['list_crews','list_crews2','list_crews3','list_crews4','list_crews5'])];
    const results=[...modernImages(race.results),...legacyImages(race,['results_race','results_race2','results_race3','results_race4','results_race5'])];
    const known=new Set([race.image,race.mapsimg,race.safety_leaflet,race.overlap_schedule,...crews,...results].filter(Boolean));
    const extra=(p.assetNames||[]).filter(x=>!known.has(x)&&x!=='name-pin.jpg');
    const section=(title,images,emptyText)=>mediaSection(title,images,{assetUrl,emptyText});
    const root=getElement('raceMedia');
    root.innerHTML=[
      race.mapsimg?section('КАРТА ОРГАНИЗАТОРА',[race.mapsimg]):'',
      section('ПАМЯТКА ПО БЕЗОПАСНОСТИ',race.safety_leaflet?[race.safety_leaflet]:[]),
      section('ГРАФИК ПЕРЕКРЫТИЙ',race.overlap_schedule?[race.overlap_schedule]:[]),
      section('ЗАЯВЛЕННЫЕ ЭКИПАЖИ',crews),
      section('РЕЗУЛЬТАТЫ',results),
      extra.length?section('МАТЕРИАЛЫ ГОНКИ',extra):'',
      `<details class="race-material collapsible-section"><summary><span class="block-title">КАК ЭТО БЫЛО</span><span class="summary-chevron">⌄</span></summary><div class="collapsible-body">${race.how_it_was?`<div class="how-it-was">${sanitizeRichHtml(race.how_it_was)}</div>`:'<p class="gray-label">Информация появится позже :)</p>'}</div></details>`
    ].join('');
    root.querySelectorAll('[data-media-name]').forEach(btn=>btn.addEventListener('click',()=>openImageModal(btn.dataset.mediaName)));
  }
  function setup(){
    const close=getElement('imageModalClose'),modal=getElement('imageModal');
    if(close)close.onclick=closeImageModal;
    modal?.addEventListener('click',e=>{if(e.target===modal)closeImageModal();});
    win.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal?.hidden)closeImageModal();});
  }
  return {renderRaceMedia,openImageModal,closeImageModal,setup};
}
