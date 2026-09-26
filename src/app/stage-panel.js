import { elevationProfile } from './elevation.js';
import { profileSvg } from './elevation-chart.js';
export { elevationGridStep, elevationGridLevels, profileSvg } from './elevation-chart.js';

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));


function eventRows(stage){
  const events=stage?.events||[];
  if(!events.length) return '<p class="muted small">Для этого СУ нет событий расписания.</p>';
  return `<div class="stage-event-list">${events.map(event=>{
    const cls=event.kind?` stage-event-${event.kind}`:'';
    return `<div class="stage-event${cls}"><time>${esc(event.time||'')}</time><span>${esc(event.text||'')}</span></div>`;
  }).join('')}</div>`;
}

export async function renderStagePanel(stage,terrain){
  const panel=$('stagePanel'),title=$('stagePanelTitle'),meta=$('stagePanelMeta'),events=$('stagePanelEvents'),body=$('stagePanelElevation');
  if(!panel||!title||!meta||!events||!body) return;
  document.querySelector('.map-card')?.classList.toggle('stage-open',Boolean(stage));
  if(!stage){
    panel.hidden=true;
    return;
  }

  panel.hidden=false;
  title.textContent=stage.name||'Спецучасток';
  const scheduleParts=[stage.date,stage.location].filter(Boolean);
  meta.textContent=scheduleParts.join(' · ');
  events.innerHTML=eventRows(stage);

  if(!stage.geometry){
    body.innerHTML='<p class="muted small">Для этого СУ не найдена линия на карте.</p>';
    return;
  }
  if(!terrain?.ready){
    body.innerHTML='<p class="muted small">Скачай рельеф, чтобы увидеть профиль высот.</p>';
    return;
  }

  body.innerHTML='<p class="muted small">Строю профиль по локальному DEM…</p>';
  try{
    const profile=await elevationProfile(terrain,stage.geometry);
    if(profile.points.length<2){
      body.innerHTML='<p class="muted small">Для этой линии недостаточно данных высоты.</p>';
      return;
    }
    body.innerHTML=`<div class="elevation-stats"><strong>${(profile.distance/1000).toFixed(1)} км</strong><span>мин. ${Math.round(profile.min)} м</span><span>макс. ${Math.round(profile.max)} м</span><span>набор +${Math.round(profile.gain)} м</span><span>сброс −${Math.round(profile.loss)} м</span></div>${profileSvg(profile)}`;
  }catch(error){
    body.innerHTML=`<p class="muted small">Не удалось построить профиль: ${esc(error.message)}</p>`;
  }
}
