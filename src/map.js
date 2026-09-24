import { geometryBounds } from './normalize.js';
import { baseStyle } from './map/style.js';
import { applyOfflineViewportConstraints, offlineViewportOptions } from './map/viewport-policy.js';
import { TerrainModeControl } from './map/terrain-control.js';

let activeMap = null;
let activeRaceLabelMarkers = [];

function clearMarkers(list) {
  for (const marker of list) {
    try { marker.remove(); } catch {}
  }
  list.length = 0;
}

function clearAllLabels() {
  clearMarkers(activeRaceLabelMarkers);
}

function esc(s='') { return String(s).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

function expandBounds(bounds, userPos) {
  if (!bounds) return null;
  let {minLon,minLat,maxLon,maxLat}=bounds;
  if (userPos && Number.isFinite(userPos.longitude) && Number.isFinite(userPos.latitude)) {
    minLon=Math.min(minLon,userPos.longitude); maxLon=Math.max(maxLon,userPos.longitude);
    minLat=Math.min(minLat,userPos.latitude); maxLat=Math.max(maxLat,userPos.latitude);
  }
  const dx=Math.max(maxLon-minLon,0.002), dy=Math.max(maxLat-minLat,0.002);
  const padX=dx*.08, padY=dy*.08;
  return {minLon:minLon-padX,maxLon:maxLon+padX,minLat:minLat-padY,maxLat:maxLat+padY};
}

function splitFeatures(fc={type:'FeatureCollection',features:[]}) {
  const features = Array.isArray(fc.features) ? fc.features : [];
  return {
    lines: {type:'FeatureCollection',features:features.filter(f=>['LineString','MultiLineString'].includes(f?.geometry?.type))},
    polygons: {type:'FeatureCollection',features:features.filter(f=>['Polygon','MultiPolygon'].includes(f?.geometry?.type))},
    points: {type:'FeatureCollection',features:features.filter(f=>f?.geometry?.type==='Point')}
  };
}

function pointPayload(feature) {
  const c=feature?.geometry?.coordinates || [];
  return {lat:Number(c[1]),lon:Number(c[0]),name:String(feature?.properties?.name || feature?.properties?.title || 'Точка')};
}

function sourceColorExpression() {
  return ['case', ['==', ['slice', ['to-string', ['coalesce', ['get','kind'], '']], 0, 7], 'yandex-'], '#ffd21e', '#e63b2e'];
}

function featureName(props={}) {
  return String(props['name:ru'] || props.name_ru || props.name || props.title || props.caption || '').trim();
}

function readableBasemapValue(value){
  if(value===true || value==='true') return 'да';
  if(value===false || value==='false') return 'нет';
  return String(value);
}

function basemapPopupHtml(feature){
  const props=feature?.properties||{};
  const title=featureName(props) || props.ref || props.shield_text || props.addr_housenumber || 'Объект карты';
  const fields=[
    ['Тип',props.kind],
    ['Подтип',props.kind_detail],
    ['Номер / ref',props.ref],
    ['Щит',props.shield_text],
    ['Дорожная сеть',props.network],
    ['Односторонняя',props.oneway],
    ['Сервис',props.service],
    ['Съезд',props.is_link],
    ['Мост',props.is_bridge ?? props.bridge],
    ['Тоннель',props.is_tunnel ?? props.tunnel],
    ['Население',props.population],
    ['Ранг населения',props.population_rank],
    ['Столица',props.capital],
    ['Wikidata',props.wikidata],
    ['Кухня',props.cuisine],
    ['Религия',props.religion],
    ['Спорт',props.sport],
    ['IATA',props.iata],
    ['Водохранилище',props.reservoir],
    ['Пересыхающий',props.intermittent],
    ['Щёлочная вода',props.alkaline],
    ['Уровень',props.layer],
    ['Спорная граница',props.disputed],
    ['Admin level',props.kind_detail && feature?.layer?.['source-layer']?.includes?.('bound') ? props.kind_detail : null],
    ['Номер дома',props.addr_housenumber],
    ['min_zoom',props.min_zoom],
    ['sort_rank',props.sort_rank]
  ].filter(([,value])=>value!==undefined && value!==null && String(value)!=='');
  const layer=feature?.layer?.['source-layer'] || feature?.sourceLayer || '';
  return `<div class="basemap-popup-card"><strong class="basemap-popup-title">${esc(title)}</strong>${layer?`<div class="basemap-popup-layer">${esc(layer)}</div>`:''}${fields.map(([label,value])=>`<div class="basemap-popup-row"><span>${esc(label)}</span><b>${esc(readableBasemapValue(value))}</b></div>`).join('')}</div>`;
}

function installBasemapInspector(map, offlineMap){
  if(!offlineMap?.ready || !window.maplibregl?.Popup) return;
  const popup=new window.maplibregl.Popup({closeButton:true,closeOnClick:true,maxWidth:'330px',className:'basemap-popup'});
  map.on('click',e=>{
    try{
      if(map.getLayer('rfm-points') && map.queryRenderedFeatures(e.point,{layers:['rfm-points']}).length) return;
      const layers=(map.getStyle()?.layers||[]).filter(layer=>layer.source==='offline-base').map(layer=>layer.id);
      if(!layers.length) return;
      const features=map.queryRenderedFeatures(e.point,{layers});
      if(!features.length) return;
      const interesting=['name','name:ru','kind','kind_detail','ref','shield_text','network','oneway','service','is_link','is_bridge','is_tunnel','population','population_rank','capital','wikidata','cuisine','religion','sport','iata','reservoir','intermittent','alkaline','layer','disputed','addr_housenumber','min_zoom','sort_rank'];
      const score=feature=>interesting.reduce((n,key)=>n+(feature?.properties?.[key]!==undefined && feature?.properties?.[key]!==''?1:0),0);
      const feature=[...features].sort((a,b)=>score(b)-score(a))[0];
      if(!feature || score(feature)===0) return;
      popup.setLngLat(e.lngLat).setHTML(basemapPopupHtml(feature)).addTo(map);
    }catch(error){
      console.warn('basemap feature inspector failed',error);
    }
  });
}

function placeKind(props={}, layerName='') {
  const raw=[props.place,props.kind,props.class,props.type,props.category,props.subclass]
    .filter(Boolean).join(' ').toLowerCase();
  const known=['city','town','village','hamlet','settlement','locality','municipality','suburb','borough','neighbourhood','neighborhood','isolated_dwelling'];
  const hit=known.find(k=>raw.includes(k));
  if(hit) return hit;
  if(String(layerName).toLowerCase().includes('place')) return 'place';
  return null;
}

function placePriority(kind) {
  return ({
    city:100,town:90,municipality:82,village:72,settlement:68,
    suburb:58,borough:56,hamlet:50,neighbourhood:46,neighborhood:46,
    locality:42,isolated_dwelling:35,place:60
  })[kind] || 0;
}

function placeMinZoom(kind) {
  return ({
    city:6,town:8,municipality:8,village:10,settlement:10,
    suburb:11,borough:11,hamlet:12,neighbourhood:12,neighborhood:12,
    locality:12,isolated_dwelling:13,place:10
  })[kind] ?? 11;
}

function boxesOverlap(a,b,pad=4) {
  return !(a.right+pad<b.left || a.left-pad>b.right || a.bottom+pad<b.top || a.top-pad>b.bottom);
}

function installRacePointLabels(map, points, onPointClick) {
  clearMarkers(activeRaceLabelMarkers);
  const maplibregl=window.maplibregl;
  if(!maplibregl?.Marker) return;

  const labels=(points?.features||[])
    .filter(f=>f?.geometry?.type==='Point' && Array.isArray(f.geometry.coordinates))
    .map(f=>({feature:f,name:featureName(f.properties),coords:f.geometry.coordinates}))
    .filter(x=>x.name);

  for(const item of labels) {
    const el=document.createElement('button');
    el.type='button';
    el.className='map-label map-race-label';
    el.textContent=item.name;
    el.title=item.name;
    if(onPointClick) el.addEventListener('click',e=>{
      e.preventDefault();
      e.stopPropagation();
      onPointClick(pointPayload(item.feature));
    });
    const marker=new maplibregl.Marker({element:el,anchor:'left',offset:[12,0]})
      .setLngLat(item.coords)
      .addTo(map);
    activeRaceLabelMarkers.push(marker);
  }

  const update=()=>{
    const visible=map.getZoom()>=9;
    for(const marker of activeRaceLabelMarkers) {
      const el=marker.getElement();
      el.style.display=visible?'block':'none';
    }
  };
  update();
  map.on('zoom',update);
}


function renderMapLibre(container, fc, userPos, onPointClick, options={}) {
  const maplibregl = window.maplibregl;
  if (!maplibregl) throw new Error('MapLibre is unavailable');
  if (activeMap) { try { activeMap.remove(); } catch {} activeMap=null; }
  clearAllLabels();
  container.innerHTML='';
  const map = new maplibregl.Map({
    container,
    style:baseStyle(options.offlineMap,options.terrain),
    center:[37.6,55.75],
    zoom:5,
    attributionControl:true,
    cooperativeGestures:false,
    ...offlineViewportOptions(options.offlineMap)
  });
  activeMap=map;
  map.on('error', e=>{
    const msg=e?.error?.message || e?.message || 'MapLibre error';
    options.onMapError?.(msg);
    console.warn('MapLibre map error',e);
  });
  map.addControl(new maplibregl.NavigationControl({showCompass:true,visualizePitch:false}), 'top-right');
  if(options.terrain?.ready) map.addControl(new TerrainModeControl(), 'top-right');
  const bounds = expandBounds(geometryBounds(fc),userPos);
  const {lines,polygons,points}=splitFeatures(fc);
  map.on('load',()=>{
    applyOfflineViewportConstraints(map,options.offlineMap);
    map.addSource('rfm-lines',{type:'geojson',data:lines});
    map.addLayer({id:'rfm-lines',type:'line',source:'rfm-lines',paint:{'line-color':sourceColorExpression(),'line-width':['interpolate',['linear'],['zoom'],5,2,12,5,17,8],'line-opacity':0.96}});

    map.addSource('rfm-polygons',{type:'geojson',data:polygons});
    map.addLayer({id:'rfm-polygons-fill',type:'fill',source:'rfm-polygons',paint:{'fill-color':sourceColorExpression(),'fill-opacity':0.14}});
    map.addLayer({id:'rfm-polygons-outline',type:'line',source:'rfm-polygons',paint:{'line-color':sourceColorExpression(),'line-width':3}});

    map.addSource('rfm-points',{type:'geojson',data:points});
    map.addLayer({id:'rfm-points',type:'circle',source:'rfm-points',paint:{
      'circle-radius':['interpolate',['linear'],['zoom'],5,5,12,7,17,10],
      'circle-color':['case',['==',['slice',['to-string',['coalesce',['get','kind'],'']],0,7],'yandex-'],'#ffd21e','#f3f5f7'],
      'circle-stroke-color':'#111318','circle-stroke-width':3
    }});

    if (userPos && Number.isFinite(userPos.longitude) && Number.isFinite(userPos.latitude)) {
      const user={type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'Point',coordinates:[userPos.longitude,userPos.latitude]}}]};
      map.addSource('user-position',{type:'geojson',data:user});
      map.addLayer({id:'user-halo',type:'circle',source:'user-position',paint:{'circle-radius':18,'circle-color':'#4da3ff','circle-opacity':0.22}});
      map.addLayer({id:'user-dot',type:'circle',source:'user-position',paint:{'circle-radius':7,'circle-color':'#4da3ff','circle-stroke-color':'#fff','circle-stroke-width':3}});
    }

    if (bounds) map.fitBounds([[bounds.minLon,bounds.minLat],[bounds.maxLon,bounds.maxLat]],{padding:48,maxZoom:15,duration:0});

    installRacePointLabels(map,points,onPointClick);
    installBasemapInspector(map,options.offlineMap);

    if (onPointClick) {
      map.on('click','rfm-points',e=>{ const f=e.features?.[0]; if(f) onPointClick(pointPayload(f)); });
      map.on('mouseenter','rfm-points',()=>{ map.getCanvas().style.cursor='pointer'; });
      map.on('mouseleave','rfm-points',()=>{ map.getCanvas().style.cursor=''; });
    }
  });
  return map;
}

export function updateLiveUserPosition(position, {center=false} = {}) {
  if (!activeMap || !position) return false;
  const longitude=Number(position.longitude);
  const latitude=Number(position.latitude);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return false;

  const data={type:'FeatureCollection',features:[{
    type:'Feature',
    properties:{accuracy:Number(position.accuracy)||null},
    geometry:{type:'Point',coordinates:[longitude,latitude]}
  }]};

  try {
    const source=activeMap.getSource?.('user-position');
    if (source?.setData) {
      source.setData(data);
    } else if (activeMap.isStyleLoaded?.()) {
      activeMap.addSource('user-position',{type:'geojson',data});
      activeMap.addLayer({id:'user-halo',type:'circle',source:'user-position',paint:{
        'circle-radius':['interpolate',['linear'],['zoom'],5,10,14,20],
        'circle-color':'#4da3ff','circle-opacity':0.22
      }});
      activeMap.addLayer({id:'user-dot',type:'circle',source:'user-position',paint:{
        'circle-radius':['interpolate',['linear'],['zoom'],5,5,14,8],
        'circle-color':'#4da3ff','circle-stroke-color':'#fff','circle-stroke-width':3
      }});
    }
    if (center) activeMap.easeTo({center:[longitude,latitude],zoom:Math.max(activeMap.getZoom?.()||0,13),duration:700});
    return true;
  } catch (e) {
    console.warn('live user position update failed',e);
    return false;
  }
}

function niceCoord(v){ return Math.abs(v) >= 100 ? v.toFixed(2) : v.toFixed(3); }

function renderFallback(container, fc, userPos = null, onPointClick = null) {
  if (activeMap) { try { activeMap.remove(); } catch {} activeMap=null; }
  clearAllLabels();
  let bounds = geometryBounds(fc);
  bounds = expandBounds(bounds,userPos);
  if (!bounds) {
    container.innerHTML = '<div class="empty">В этом пакете не найдено геометрии.<br>Данные всё равно сохранены офлайн.</div>';
    return;
  }
  const W=1000,H=620,P=58;
  const dx = Math.max(bounds.maxLon-bounds.minLon, 0.0001);
  const dy = Math.max(bounds.maxLat-bounds.minLat, 0.0001);
  const project = ([lon,lat]) => [P + (lon-bounds.minLon)/dx*(W-P*2), H-P-(lat-bounds.minLat)/dy*(H-P*2)];
  const pathLine = coords => coords.map((c,i)=>`${i?'L':'M'}${project(c).map(n=>n.toFixed(2)).join(' ')}`).join(' ');
  let shapes='', points='';
  for (const f of fc.features || []) {
    const g=f.geometry||{}; const props=f.properties||{}; const label=esc(props.name || props.title || 'Точка');
    const isYandex=String(props.kind||'').startsWith('yandex-');
    const stroke=props.color || (isYandex ? '#ffd21e' : '#e63b2e');
    if (g.type==='LineString') shapes += `<path d="${pathLine(g.coordinates)}" fill="none" stroke="${esc(stroke)}" stroke-width="${isYandex?5:6}" stroke-linecap="round" stroke-linejoin="round"><title>${label}</title></path>`;
    if (g.type==='MultiLineString') for (const line of g.coordinates) shapes += `<path d="${pathLine(line)}" fill="none" stroke="${esc(stroke)}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><title>${label}</title></path>`;
    if (g.type==='Polygon') for (const ring of g.coordinates || []) shapes += `<path d="${pathLine(ring)} Z" fill="${esc(stroke)}" fill-opacity=".12" stroke="${esc(stroke)}" stroke-width="3"><title>${label}</title></path>`;
    if (g.type==='MultiPolygon') for (const poly of g.coordinates || []) for (const ring of poly || []) shapes += `<path d="${pathLine(ring)} Z" fill="${esc(stroke)}" fill-opacity=".12" stroke="${esc(stroke)}" stroke-width="3"><title>${label}</title></path>`;
    if (g.type==='Point') {
      const [x,y]=project(g.coordinates); const fill=isYandex ? '#ffd21e' : '#f3f5f7';
      points += `<g class="map-point" tabindex="0" role="button" data-lat="${g.coordinates[1]}" data-lon="${g.coordinates[0]}" data-name="${label}" aria-label="${label}"><circle cx="${x}" cy="${y}" r="${isYandex?8:9}" fill="${fill}" stroke="#111318" stroke-width="4"><title>${label}</title></circle></g>`;
    }
  }
  let user='';
  if (userPos && Number.isFinite(userPos.longitude) && Number.isFinite(userPos.latitude)) {
    const [x,y]=project([userPos.longitude,userPos.latitude]);
    user = `<g><circle cx="${x}" cy="${y}" r="18" fill="#4da3ff" opacity=".25"/><circle cx="${x}" cy="${y}" r="8" fill="#4da3ff" stroke="#fff" stroke-width="3"><title>Моё положение</title></circle></g>`;
  }
  const grid=[];
  for(let i=0;i<=4;i++){
    const x=P+(W-P*2)*(i/4); const lon=bounds.minLon+dx*(i/4);
    grid.push(`<path d="M${x} ${P}V${H-P}" stroke="#1c222b" stroke-width="2"/><text x="${x+4}" y="${H-16}" fill="#6f7a89" font-size="13">${niceCoord(lon)}°</text>`);
    const y=P+(H-P*2)*(i/4); const lat=bounds.maxLat-dy*(i/4);
    grid.push(`<path d="M${P} ${y}H${W-P}" stroke="#1c222b" stroke-width="2"/><text x="10" y="${y-5}" fill="#6f7a89" font-size="13">${niceCoord(lat)}°</text>`);
  }
  container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Offline rally map"><rect width="100%" height="100%" fill="#0f1217"/>${grid.join('')}${shapes}${points}${user}</svg>`;
  if (onPointClick) {
    const activate = el => onPointClick({lat:Number(el.dataset.lat), lon:Number(el.dataset.lon), name:el.dataset.name || 'Точка'});
    container.querySelectorAll('.map-point[data-lat][data-lon]').forEach(el => {
      el.addEventListener('click', () => activate(el));
      el.addEventListener('keydown', e => { if (e.key==='Enter' || e.key===' ') { e.preventDefault(); activate(el); } });
    });
  }
}

export function renderMap(container, fc, userPos = null, onPointClick = null, options={}) {
  try {
    if (window.maplibregl) return renderMapLibre(container,fc,userPos,onPointClick,options);
  } catch (e) {
    console.error('MapLibre render failed',e);
    options.onMapError?.(e?.message || String(e));
    if (options.offlineMap?.ready) {
      if (activeMap) { try { activeMap.remove(); } catch {} activeMap=null; }
      container.innerHTML = `<div class="empty map-engine-error"><strong>Не удалось запустить интерактивную карту.</strong><br><span>${esc(e?.message || String(e))}</span></div>`;
      return null;
    }
  }
  if (options.offlineMap?.ready) {
    container.innerHTML = '<div class="empty map-engine-error"><strong>MapLibre не загрузился.</strong><br>Офлайн-тайлы сохранены, но движок карты недоступен.</div>';
    return null;
  }
  return renderFallback(container,fc,userPos,onPointClick);
}
