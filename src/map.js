import { geometryBounds } from './normalize.js';
import { registerOfflineMapProtocol, offlineVectorSource, resetOfflineMapDiagnostics } from './offline-map.js';

let activeMap = null;

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

function basemapPalette(layerName){
  const n=String(layerName||'').toLowerCase();
  if(n.includes('water')) return {fill:'#bfdde8',line:'#7aaec2',circle:'#7aaec2'};
  if(n.includes('earth')) return {fill:'#f2f0e9',line:'#d8d3c7',circle:'#d8d3c7'};
  if(n.includes('landuse')||n.includes('landcover')) return {fill:'#dce8d2',line:'#b9c9ae',circle:'#8daa7d'};
  if(n.includes('building')) return {fill:'#ddd8d2',line:'#c5beb6',circle:'#c5beb6'};
  if(n.includes('road')||n.includes('transport')) return {fill:'#eee9df',line:'#b9b2a7',circle:'#b9b2a7'};
  if(n.includes('boundar')) return {fill:'#f3f3f3',line:'#9ea2a8',circle:'#9ea2a8'};
  if(n.includes('place')||n.includes('poi')) return {fill:'#ececec',line:'#b4b4b4',circle:'#777'};
  return {fill:'#e5e5e5',line:'#aab0b5',circle:'#8e9499'};
}

function genericLayerTriplet(source, layerName, index){
  const id=String(layerName).replace(/[^a-z0-9_-]/gi,'-');
  const p=basemapPalette(layerName);
  const lineWidth=String(layerName).toLowerCase().includes('road')
    ? ['interpolate',['linear'],['zoom'],6,.8,10,1.7,14,4.8]
    : ['interpolate',['linear'],['zoom'],6,.4,14,1.5];
  return [
    {id:`base-${index}-${id}-fill`,type:'fill',source,'source-layer':layerName,filter:['==',['geometry-type'],'Polygon'],paint:{'fill-color':p.fill,'fill-opacity':0.9}},
    {id:`base-${index}-${id}-line`,type:'line',source,'source-layer':layerName,filter:['==',['geometry-type'],'LineString'],paint:{'line-color':p.line,'line-width':lineWidth,'line-opacity':0.95}},
    {id:`base-${index}-${id}-point`,type:'circle',source,'source-layer':layerName,filter:['==',['geometry-type'],'Point'],paint:{'circle-color':p.circle,'circle-radius':['interpolate',['linear'],['zoom'],6,1.5,14,3.5],'circle-opacity':0.85}}
  ];
}

function offlineBasemapLayers(source='offline-base', offlineMap={}){
  const metadataLayers=Array.isArray(offlineMap?.vectorLayers)
    ? offlineMap.vectorLayers.map(v=>typeof v==='string'?v:v?.id).filter(Boolean)
    : [];
  const fallback=['earth','landuse','water','buildings','roads','boundaries','places','pois'];
  const names=[...new Set(metadataLayers.length?metadataLayers:fallback)];
  return names.flatMap((name,i)=>genericLayerTriplet(source,name,i));
}

function baseStyle(offlineMap) {
  const sources = {};
  const layers = [{id:'background',type:'background',paint:{'background-color':'#11151b'}}];
  if (offlineMap?.ready) {
    registerOfflineMapProtocol();
    resetOfflineMapDiagnostics();
    sources['offline-base']=offlineVectorSource(offlineMap.raceId,offlineMap);
    layers.push(...offlineBasemapLayers('offline-base',offlineMap));
  } else if (navigator.onLine) {
    sources.osm = {type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,maxzoom:19,attribution:'© OpenStreetMap contributors'};
    layers.push({id:'osm',type:'raster',source:'osm',paint:{'raster-opacity':0.92}});
  }
  return {version:8,sources,layers};
}

function renderMapLibre(container, fc, userPos, onPointClick, options={}) {
  const maplibregl = window.maplibregl;
  if (!maplibregl) throw new Error('MapLibre is unavailable');
  if (activeMap) { try { activeMap.remove(); } catch {} activeMap=null; }
  container.innerHTML='';
  const map = new maplibregl.Map({
    container,
    style:baseStyle(options.offlineMap),
    center:[37.6,55.75],
    zoom:5,
    attributionControl:true,
    cooperativeGestures:false
  });
  activeMap=map;
  map.on('error', e=>{
    const msg=e?.error?.message || e?.message || 'MapLibre error';
    options.onMapError?.(msg);
    console.warn('MapLibre map error',e);
  });
  map.addControl(new maplibregl.NavigationControl({showCompass:true,visualizePitch:false}), 'top-right');
  const bounds = expandBounds(geometryBounds(fc),userPos);
  const {lines,polygons,points}=splitFeatures(fc);
  map.on('load',()=>{
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

    if (onPointClick) {
      map.on('click','rfm-points',e=>{ const f=e.features?.[0]; if(f) onPointClick(pointPayload(f)); });
      map.on('mouseenter','rfm-points',()=>{ map.getCanvas().style.cursor='pointer'; });
      map.on('mouseleave','rfm-points',()=>{ map.getCanvas().style.cursor=''; });
    }
  });
  return map;
}

function niceCoord(v){ return Math.abs(v) >= 100 ? v.toFixed(2) : v.toFixed(3); }

function renderFallback(container, fc, userPos = null, onPointClick = null) {
  if (activeMap) { try { activeMap.remove(); } catch {} activeMap=null; }
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
    console.warn('MapLibre render failed, falling back to offline SVG map',e);
  }
  return renderFallback(container,fc,userPos,onPointClick);
}
