import {
  googleMapsDirections,
  yandexNavigatorLink,
  yandexWebFallback,
  mapsMeLink,
  mapsMeWebFallback,
  coordinateText,
  openCustomSchemeWithFallback
} from '../navigation.js';
import { isFavoritePoint, setFavoritePoint } from './local-points.js';

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function pointFeatures(fc){
  return (fc?.features||[]).filter(f=>f?.geometry?.type==='Point'&&Array.isArray(f.geometry.coordinates)&&f.geometry.coordinates.length>=2);
}

export function pointFromFeature(feature){
  return {
    lat:Number(feature.geometry.coordinates[1]),
    lon:Number(feature.geometry.coordinates[0]),
    name:String(feature.properties?.name||feature.properties?.title||'Точка')
  };
}

function openPointAction(action,point,onShare){
  if(!point) return;
  if(action==='google'){window.location.href=googleMapsDirections(point);return;}
  if(action==='yandex'){openCustomSchemeWithFallback(yandexNavigatorLink(point),yandexWebFallback(point));return;}
  if(action==='mapsme'){openCustomSchemeWithFallback(mapsMeLink(point),mapsMeWebFallback());return;}
  if(action==='share'){onShare?.(point);return;}
  if(action==='copy') navigator.clipboard?.writeText(coordinateText(point)).catch(()=>{});
}

export function renderPointList(pkg,{onSelectPoint,onFavoriteChange,onShare}={}){
  const root=$('pointList');
  if(!root) return;
  const pts=pointFeatures(pkg.geojson);
  if(!pts.length){root.innerHTML='<p class="muted">Точек с координатами нет.</p>';return;}

  root.innerHTML=pts.map((feature,index)=>{
    const point=pointFromFeature(feature);
    const favorite=isFavoritePoint(point,pkg.id);
    return `<article class="point-row" data-point-index="${index}">
      <div class="point-row-copy"><strong><img class="rfm-icon point-icon" src="/assets/location.svg" alt="" />${esc(point.name)}</strong><span class="muted">${esc(coordinateText(point))}</span></div>
      <div class="point-nav-buttons">
        <button class="button compact ${favorite?'downloaded':''}" data-nav="favorite">${favorite?'★ Избранное':'☆ В избранное'}</button>
        <button class="button compact primary" data-nav="google">Google Maps</button>
        <button class="button compact" data-nav="yandex">Yandex</button>
        <button class="button compact" data-nav="mapsme">MAPS.ME</button>
        <button class="button compact" data-nav="share">Поделиться</button>
        <button class="button compact" data-nav="copy"><img class="rfm-icon" src="/assets/document-copy.svg" alt="" />Копировать</button>
      </div>
    </article>`;
  }).join('');

  root.querySelectorAll('.point-row').forEach((row,index)=>{
    const point=pointFromFeature(pts[index]);
    row.querySelectorAll('[data-nav]').forEach(btn=>btn.addEventListener('click',event=>{
      event.stopPropagation();
      if(btn.dataset.nav==='favorite'){
        const enabled=!isFavoritePoint(point,pkg.id);
        setFavoritePoint(point,enabled,pkg.id);
        renderPointList(pkg,{onSelectPoint,onFavoriteChange,onShare});
        onFavoriteChange?.(point,enabled);
        return;
      }
      openPointAction(btn.dataset.nav,point,onShare);
    }));
    row.addEventListener('click',event=>{
      if(event.target.closest('[data-nav]')) return;
      onSelectPoint?.(point);
    });
  });
}
