import { elevationAt, elevationProfile } from './elevation.js';
import { profileSvg } from './elevation-chart.js';

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

export async function showPointElevation(meta,point){
  const el=$('pointElevation');
  if(!el) return;
  if(!meta?.ready){el.textContent='Высота недоступна: рельеф не скачан.';return;}
  el.textContent='Высота: считаю…';
  try{
    const value=await elevationAt(meta,point);
    el.textContent=Number.isFinite(value)?`Высота: ${Math.round(value)} м`:'Высота для этой точки недоступна.';
  }catch(error){
    el.textContent=`Высота недоступна: ${error.message}`;
  }
}

export async function showRouteElevationProfile(meta,route){
  const panel=$('elevationProfilePanel'),title=$('elevationProfileTitle'),body=$('elevationProfileBody');
  if(!panel||!title||!body) return;
  panel.hidden=false;
  title.textContent=route?.name||'Профиль высот';
  if(!meta?.ready){body.innerHTML='<p class="muted small">Скачай рельеф, чтобы построить профиль высот.</p>';return;}
  body.innerHTML='<p class="muted small">Строю профиль по локальному DEM…</p>';
  try{
    const profile=await elevationProfile(meta,route.geometry);
    if(profile.points.length<2){body.innerHTML='<p class="muted small">Для этой линии недостаточно данных высоты.</p>';return;}
    body.innerHTML=`<div class="elevation-stats"><strong>${(profile.distance/1000).toFixed(1)} км</strong><span>мин. ${Math.round(profile.min)} м</span><span>макс. ${Math.round(profile.max)} м</span><span>набор +${Math.round(profile.gain)} м</span><span>сброс −${Math.round(profile.loss)} м</span></div>${profileSvg(profile)}`;
    panel.scrollIntoView({behavior:'smooth',block:'nearest'});
  }catch(error){
    body.innerHTML=`<p class="muted small">Не удалось построить профиль: ${esc(error.message)}</p>`;
  }
}
