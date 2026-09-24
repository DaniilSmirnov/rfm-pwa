import { assetUrl } from '../rallyfans.js';
import { sanitizeRichHtml } from './sanitize.js';

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const asArray=v=>Array.isArray(v)?v:(v&&typeof v==='object'?Object.values(v):[]);
const legacyImages=(obj,keys)=>keys.map(k=>obj?.[k]).filter(v=>typeof v==='string'&&v.trim());
const modernImages=items=>asArray(items).map(x=>x?.image).filter(v=>typeof v==='string'&&v.trim());
const unique=arr=>[...new Set(arr)];

function mediaSection(title,images,emptyText='Информация появится позже :)'){
  const list=unique(images);
  const count=list.length?` · ${list.length}`:'';
  return `<details class="race-material collapsible-section">
    <summary><span class="block-title">${esc(title)}</span><span class="summary-meta">${esc(count)}</span><span class="summary-chevron">⌄</span></summary>
    <div class="collapsible-body">${list.length?`<div class="media-strip">${list.map((name,i)=>`<button class="media-card" data-media-name="${esc(name)}" aria-label="Открыть ${esc(title)} ${i+1}"><img loading="lazy" src="${assetUrl(name)}" alt="${esc(title)}" /></button>`).join('')}</div>`:`<p class="gray-label">${esc(emptyText)}</p>`}</div>
  </details>`;
}

function openImageModal(name){
  if(!name) return;
  $('imageModalImg').src=assetUrl(name);
  $('imageModal').hidden=false;
  document.body.classList.add('modal-open');
}

function closeImageModal(){
  $('imageModal').hidden=true;
  $('imageModalImg').removeAttribute('src');
  document.body.classList.remove('modal-open');
}

export function initRaceMediaModal(){
  $('imageModalClose').onclick=closeImageModal;
  $('imageModal').addEventListener('click',e=>{if(e.target===$('imageModal')) closeImageModal();});
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('imageModal').hidden) closeImageModal();});
}

export function renderRaceMedia(pkg){
  const race=pkg.original||{};
  const crews=[...modernImages(race.lists),...legacyImages(race,['list_crews','list_crews2','list_crews3','list_crews4','list_crews5'])];
  const results=[...modernImages(race.results),...legacyImages(race,['results_race','results_race2','results_race3','results_race4','results_race5'])];
  const known=new Set([race.image,race.mapsimg,race.safety_leaflet,race.overlap_schedule,...crews,...results].filter(Boolean));
  const extra=(pkg.assetNames||[]).filter(x=>!known.has(x)&&x!=='name-pin.jpg');
  const root=$('raceMedia');
  root.innerHTML=[
    race.mapsimg?mediaSection('КАРТА ОРГАНИЗАТОРА',[race.mapsimg]):'',
    mediaSection('ПАМЯТКА ПО БЕЗОПАСНОСТИ',race.safety_leaflet?[race.safety_leaflet]:[]),
    mediaSection('ГРАФИК ПЕРЕКРЫТИЙ',race.overlap_schedule?[race.overlap_schedule]:[]),
    mediaSection('ЗАЯВЛЕННЫЕ ЭКИПАЖИ',crews),
    mediaSection('РЕЗУЛЬТАТЫ',results),
    extra.length?mediaSection('МАТЕРИАЛЫ ГОНКИ',extra):'',
    `<details class="race-material collapsible-section"><summary><span class="block-title">КАК ЭТО БЫЛО</span><span class="summary-chevron">⌄</span></summary><div class="collapsible-body">${race.how_it_was?`<div class="how-it-was">${sanitizeRichHtml(race.how_it_was)}</div>`:'<p class="gray-label">Информация появится позже :)</p>'}</div></details>`
  ].join('');
  root.querySelectorAll('[data-media-name]').forEach(btn=>btn.addEventListener('click',()=>openImageModal(btn.dataset.mediaName)));
}
