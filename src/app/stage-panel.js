import { elevationProfile } from './elevation.js';

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

export function elevationGridStep(min,max){
  const span=Math.max(0,Number(max)-Number(min));
  if(span>600) return 100;
  if(span>300) return 50;
  return 25;
}

export function elevationGridLevels(min,max){
  if(!Number.isFinite(min)||!Number.isFinite(max)) return [];
  const step=elevationGridStep(min,max);
  const gridMin=Math.floor(min/step)*step;
  const gridMax=Math.ceil(max/step)*step;
  const levels=[];
  for(let h=gridMin;h<=gridMax;h+=step) levels.push(h);
  return levels;
}

export function profileSvg(profile){
  const pts=profile.points||[];
  if(pts.length<2) return '';
  const levels=elevationGridLevels(profile.min,profile.max);
  const gridMin=levels[0] ?? profile.min;
  const gridMax=levels.at(-1) ?? profile.max;
  const W=900,H=240,PL=58,PR=24,PT=18,PB=30;
  const range=Math.max(1,gridMax-gridMin),distance=Math.max(1,profile.distance);
  const x=d=>PL+(W-PL-PR)*(d/distance);
  const y=h=>PT+(H-PT-PB)*(1-(h-gridMin)/range);
  const path=pts.map((p,i)=>`${i?'L':'M'}${x(p.distance).toFixed(1)} ${y(p.elevation).toFixed(1)}`).join(' ');
  const grid=levels.map(level=>`<g class="elevation-grid-row"><line x1="${PL}" y1="${y(level).toFixed(1)}" x2="${W-PR}" y2="${y(level).toFixed(1)}"/><text x="${PL-8}" y="${(y(level)+4).toFixed(1)}" text-anchor="end">${Math.round(level)} м</text></g>`).join('');
  return `<svg class="elevation-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Профиль высот">${grid}<path class="elevation-profile-line" d="${path}" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><text class="elevation-distance-label" x="${W-PR}" y="${H-6}" text-anchor="end">${(profile.distance/1000).toFixed(1)} км</text></svg>`;
}

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
