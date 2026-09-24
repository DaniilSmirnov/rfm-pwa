import { geometryBounds } from './normalize.js';
import { registerOfflineMapProtocol, offlineVectorSource, resetOfflineMapDiagnostics } from './offline-map.js';

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

function basemapField(...names){
  return ['to-string',['coalesce',...names.map(name=>['get',name]),'']];
}

function basemapClass(){
  return basemapField('highway','pmap:kind','kind','class','type','natural','landuse','amenity','tourism','shop');
}

function roadWidth(casing=0){
  // MapLibre only allows ["zoom"] as the input of a top-level step/interpolate.
  // Keep the zoom interpolation itself at the root and add casing to each stop,
  // rather than wrapping a zoom expression in ["+", ...].
  return ['interpolate',['linear'],['zoom'],
    6,['match',basemapClass(),'motorway',2.2+casing,'trunk',2+casing,'primary',1.7+casing,'secondary',1.4+casing,'tertiary',1.1+casing,.7+casing],
    10,['match',basemapClass(),'motorway',4.2+casing,'trunk',3.8+casing,'primary',3.2+casing,'secondary',2.7+casing,'tertiary',2.2+casing,'residential',1.6+casing,'service',1.2+casing,'track',1.1+casing,1.3+casing],
    14,['match',basemapClass(),'motorway',9+casing,'trunk',8+casing,'primary',7+casing,'secondary',6+casing,'tertiary',5+casing,'residential',4+casing,'service',3+casing,'track',2.4+casing,'path',1.8+casing,'footway',1.6+casing,'cycleway',1.8+casing,2.5+casing]
  ];
}

function roadColor(){
  return ['match',basemapClass(),
    'motorway','#d98f49',
    'trunk','#dfa35a',
    'primary','#e7bb6f',
    'secondary','#ead191',
    'tertiary','#f1dfb1',
    'residential','#ffffff',
    'living_street','#ffffff',
    'service','#f7f6f2',
    'track','#c9b48f',
    'path','#b7a98d',
    'footway','#b7a98d',
    'cycleway','#93b7a0',
    '#ebe8df'
  ];
}

function landColor(){
  return ['match',basemapClass(),
    'forest','#c9ddbd','wood','#c9ddbd',
    'grass','#dce8c7','meadow','#dce8c7','park','#d7e9c5','recreation_ground','#d7e9c5',
    'farmland','#eadfbd','farm','#eadfbd','orchard','#dce4bf','vineyard','#dce4bf',
    'residential','#e8e4dd','commercial','#e5dfdc','retail','#e5dfdc','industrial','#ddd8d4',
    'cemetery','#d5dfcf','grave_yard','#d5dfcf',
    'sand','#eee2bd','beach','#f3e5b8','wetland','#c8ded2',
    '#e3e6db'
  ];
}

function poiColor(){
  return ['match',basemapClass(),
    'fuel','#d97838','charging_station','#64a36f',
    'parking','#6f86a7','toilets','#8a75a2',
    'hospital','#c85f67','clinic','#c85f67','pharmacy','#c85f67',
    'viewpoint','#7a6f55','camp_site','#5f8a62','caravan_site','#5f8a62',
    'supermarket','#8b6b9a','convenience','#8b6b9a',
    'cafe','#a87a54','restaurant','#a87a54',
    'hotel','#7d6a99','motel','#7d6a99','guest_house','#7d6a99',
    '#777f89'
  ];
}

function semanticBasemapLayers(source,layerName,index){
  const id=String(layerName).replace(/[^a-z0-9_-]/gi,'-');
  const n=String(layerName||'').toLowerCase();
  const prefix=`base-${index}-${id}`;

  if(n.includes('earth') || n==='land' || n.includes('mask')){
    return [
      {id:`${prefix}-fill`,type:'fill',source,'source-layer':layerName,filter:['==',['geometry-type'],'Polygon'],paint:{'fill-color':'#f2f0e9','fill-opacity':1}}
    ];
  }

  if(n.includes('water')){
    return [
      {id:`${prefix}-fill`,type:'fill',source,'source-layer':layerName,filter:['==',['geometry-type'],'Polygon'],paint:{'fill-color':'#b9dce9','fill-opacity':.96}},
      {id:`${prefix}-line`,type:'line',source,'source-layer':layerName,filter:['==',['geometry-type'],'LineString'],paint:{'line-color':'#79afc5','line-width':['interpolate',['linear'],['zoom'],6,.7,14,2.8],'line-opacity':.95}}
    ];
  }

  if(n.includes('landuse') || n.includes('landcover') || n.includes('natural')){
    return [
      {id:`${prefix}-fill`,type:'fill',source,'source-layer':layerName,filter:['==',['geometry-type'],'Polygon'],paint:{'fill-color':landColor(),'fill-opacity':.9}},
      {id:`${prefix}-line`,type:'line',source,'source-layer':layerName,filter:['==',['geometry-type'],'LineString'],paint:{'line-color':'#a9b69d','line-width':['interpolate',['linear'],['zoom'],6,.4,14,1.4],'line-opacity':.85}},
      {id:`${prefix}-point`,type:'circle',source,'source-layer':layerName,filter:['==',['geometry-type'],'Point'],paint:{'circle-color':'#78906f','circle-radius':['interpolate',['linear'],['zoom'],7,1.5,14,3.5],'circle-opacity':.8}}
    ];
  }

  if(n.includes('building')){
    return [
      {id:`${prefix}-fill`,type:'fill',source,'source-layer':layerName,filter:['==',['geometry-type'],'Polygon'],minzoom:12,paint:{'fill-color':'#d6d0c9','fill-opacity':.92,'fill-outline-color':'#bcb4ac'}}
    ];
  }

  if(n.includes('road') || n.includes('transport')){
    return [
      {id:`${prefix}-casing`,type:'line',source,'source-layer':layerName,filter:['==',['geometry-type'],'LineString'],paint:{'line-color':'#aaa49b','line-width':roadWidth(1.6),'line-opacity':.95}},
      {id:`${prefix}-road`,type:'line',source,'source-layer':layerName,filter:['==',['geometry-type'],'LineString'],paint:{'line-color':roadColor(),'line-width':roadWidth(),'line-opacity':['case',['in',basemapField('tunnel'),['literal',['yes','true','1']]],.55,.98]}}
    ];
  }

  if(n.includes('transit') || n.includes('rail')){
    return [
      {id:`${prefix}-rail`,type:'line',source,'source-layer':layerName,filter:['==',['geometry-type'],'LineString'],paint:{'line-color':'#72706d','line-width':['interpolate',['linear'],['zoom'],7,.7,14,2.2],'line-dasharray':[2,1.5],'line-opacity':.9}}
    ];
  }

  if(n.includes('boundar')){
    return [
      {id:`${prefix}-line`,type:'line',source,'source-layer':layerName,filter:['==',['geometry-type'],'LineString'],paint:{'line-color':'#8d939a','line-width':['interpolate',['linear'],['zoom'],6,.6,14,1.8],'line-dasharray':[3,2],'line-opacity':.82}}
    ];
  }

  if(n.includes('physical_line')){
    return [
      {id:`${prefix}-line`,type:'line',source,'source-layer':layerName,filter:['==',['geometry-type'],'LineString'],paint:{'line-color':['match',basemapClass(),'cliff','#857c72','ridge','#9b8b76','river','#79afc5','stream','#79afc5','#aaa49b'],'line-width':['interpolate',['linear'],['zoom'],7,.5,14,1.8],'line-opacity':.82}}
    ];
  }

  if(n.includes('poi')){
    return [
      {id:`${prefix}-point`,type:'circle',source,'source-layer':layerName,filter:['==',['geometry-type'],'Point'],minzoom:11,paint:{'circle-color':poiColor(),'circle-radius':['interpolate',['linear'],['zoom'],11,2.7,14,4.8],'circle-stroke-color':'#fff','circle-stroke-width':1.2,'circle-opacity':.96}}
    ];
  }

  if(n.includes('place')){
    return [
      {id:`${prefix}-point`,type:'circle',source,'source-layer':layerName,filter:['==',['geometry-type'],'Point'],paint:{'circle-color':'#555b61','circle-radius':['interpolate',['linear'],['zoom'],6,1.5,14,3.4],'circle-opacity':.8}}
    ];
  }

  if(n.includes('physical_point')){
    return [
      {id:`${prefix}-point`,type:'circle',source,'source-layer':layerName,filter:['==',['geometry-type'],'Point'],minzoom:9,paint:{'circle-color':'#706756','circle-radius':['interpolate',['linear'],['zoom'],9,2,14,4],'circle-stroke-color':'#f7f4ed','circle-stroke-width':1,'circle-opacity':.95}}
    ];
  }

  return [
    {id:`${prefix}-fill`,type:'fill',source,'source-layer':layerName,filter:['==',['geometry-type'],'Polygon'],paint:{'fill-color':'#e5e5e5','fill-opacity':.72}},
    {id:`${prefix}-line`,type:'line',source,'source-layer':layerName,filter:['==',['geometry-type'],'LineString'],paint:{'line-color':'#9ca3aa','line-width':['interpolate',['linear'],['zoom'],6,.4,14,1.4],'line-opacity':.82}},
    {id:`${prefix}-point`,type:'circle',source,'source-layer':layerName,filter:['==',['geometry-type'],'Point'],paint:{'circle-color':'#7f878e','circle-radius':['interpolate',['linear'],['zoom'],6,1.4,14,3.2],'circle-opacity':.8}}
  ];
}

const BASEMAP_FONT_STACK=['Roboto','Arial','Helvetica','Noto Sans'];

function labelNameExpression(){
  return ['to-string',['coalesce',
    ['get','name:ru'],
    ['get','name_ru'],
    ['get','name'],
    ['get','name:en'],
    ['get','name_en'],
    ''
  ]];
}

function labelRefExpression(){
  return ['to-string',['coalesce',['get','ref'],'']];
}

function roadLabelExpression(){
  const name=labelNameExpression();
  const ref=labelRefExpression();
  return ['case',
    ['all',['!=',name,''],['!=',ref,'']],
    ['concat',ref,' · ',name],
    ['!=',name,''],name,
    ref
  ];
}

function placeClassExpression(){
  return basemapField('place','kind','class','type','category','subclass');
}

function nativeTextPaint(color='#45484c',haloWidth=1){
  return {
    'text-color':color,
    'text-halo-color':'rgba(255,255,255,0.96)',
    'text-halo-width':haloWidth,
    'text-halo-blur':0.35
  };
}

function nativePointLabelLayout(textField,textSize){
  return {
    'text-field':textField,
    'text-font':BASEMAP_FONT_STACK,
    'text-size':textSize,
    'text-variable-anchor':['top','bottom','left','right'],
    'text-radial-offset':0.65,
    'text-padding':2,
    'text-max-width':12,
    'text-allow-overlap':false,
    'text-ignore-placement':false
  };
}

function nativeBasemapLabelLayers(source,layerName,index){
  const id=String(layerName).replace(/[^a-z0-9_-]/gi,'-');
  const n=String(layerName||'').toLowerCase();
  const prefix=`base-label-${index}-${id}`;
  const name=labelNameExpression();
  const hasName=['!=',name,''];
  const klass=basemapClass();

  if(n.includes('place')){
    const place=placeClassExpression();
    return [
      {
        id:`${prefix}-major`,type:'symbol',source,'source-layer':layerName,minzoom:5,
        filter:['all',hasName,['in',place,['literal',['city','town','municipality']]]],
        layout:{
          ...nativePointLabelLayout(name,['interpolate',['linear'],['zoom'],5,11,9,13,14,15]),
          'text-padding':4
        },
        paint:nativeTextPaint('#25282c',1.15)
      },
      {
        id:`${prefix}-minor`,type:'symbol',source,'source-layer':layerName,minzoom:9,
        filter:['all',hasName,['!', ['in',place,['literal',['city','town','municipality']]]]],
        layout:nativePointLabelLayout(name,['interpolate',['linear'],['zoom'],9,9.5,14,11.5]),
        paint:nativeTextPaint('#4d5156',0.9)
      }
    ];
  }

  if(n.includes('road') || n.includes('transport')){
    const roadText=roadLabelExpression();
    const hasRoadText=['!=',roadText,''];
    const major=['motorway','trunk','primary','secondary','tertiary'];
    return [
      {
        id:`${prefix}-major`,type:'symbol',source,'source-layer':layerName,minzoom:8,
        filter:['all',['==',['geometry-type'],'LineString'],hasRoadText,['in',klass,['literal',major]]],
        layout:{
          'symbol-placement':'line',
          'symbol-spacing':320,
          'text-field':roadText,
          'text-font':BASEMAP_FONT_STACK,
          'text-size':['interpolate',['linear'],['zoom'],8,9.5,12,10.5,16,12.5],
          'text-letter-spacing':0.01,
          'text-max-angle':35,
          'text-keep-upright':true,
          'text-padding':2
        },
        paint:nativeTextPaint('#5f5b55',1)
      },
      {
        id:`${prefix}-local`,type:'symbol',source,'source-layer':layerName,minzoom:11.5,
        filter:['all',['==',['geometry-type'],'LineString'],hasRoadText,['!', ['in',klass,['literal',major]]]],
        layout:{
          'symbol-placement':'line',
          'symbol-spacing':230,
          'text-field':roadText,
          'text-font':BASEMAP_FONT_STACK,
          'text-size':['interpolate',['linear'],['zoom'],11.5,9,15,11.5,18,12.5],
          'text-letter-spacing':0.01,
          'text-max-angle':40,
          'text-keep-upright':true,
          'text-padding':1
        },
        paint:nativeTextPaint('#64615c',0.9)
      }
    ];
  }

  if(n.includes('poi')){
    return [{
      id:`${prefix}-poi`,type:'symbol',source,'source-layer':layerName,minzoom:12,
      filter:['all',['==',['geometry-type'],'Point'],hasName],
      layout:nativePointLabelLayout(name,['interpolate',['linear'],['zoom'],12,9,16,11]),
      paint:nativeTextPaint('#4d5156',0.85)
    }];
  }

  if(n.includes('physical_point')){
    const ele=['to-string',['coalesce',['get','ele'],['get','elevation'],'']];
    const text=['case',
      ['all',hasName,['!=',ele,'']],['concat',name,' · ',ele,' м'],
      name
    ];
    return [{
      id:`${prefix}-physical`,type:'symbol',source,'source-layer':layerName,minzoom:10,
      filter:['all',['==',['geometry-type'],'Point'],hasName],
      layout:nativePointLabelLayout(text,['interpolate',['linear'],['zoom'],10,9.5,14,11]),
      paint:nativeTextPaint('#625b50',0.9)
    }];
  }

  if(n.includes('water')){
    return [
      {
        id:`${prefix}-water-line`,type:'symbol',source,'source-layer':layerName,minzoom:10,
        filter:['all',['==',['geometry-type'],'LineString'],hasName],
        layout:{
          'symbol-placement':'line',
          'symbol-spacing':320,
          'text-field':name,
          'text-font':BASEMAP_FONT_STACK,
          'text-size':['interpolate',['linear'],['zoom'],10,9.5,14,11.5],
          'text-max-angle':35,
          'text-keep-upright':true,
          'text-padding':2
        },
        paint:nativeTextPaint('#47798f',0.8)
      },
      {
        id:`${prefix}-water-area`,type:'symbol',source,'source-layer':layerName,minzoom:9,
        filter:['all',['!=',['geometry-type'],'LineString'],hasName],
        layout:nativePointLabelLayout(name,['interpolate',['linear'],['zoom'],9,9.5,14,11.5]),
        paint:nativeTextPaint('#47798f',0.8)
      }
    ];
  }

  if(n.includes('transit') || n.includes('rail')){
    return [{
      id:`${prefix}-transit`,type:'symbol',source,'source-layer':layerName,minzoom:11,
      filter:['all',['==',['geometry-type'],'LineString'],hasName],
      layout:{
        'symbol-placement':'line',
        'symbol-spacing':360,
        'text-field':name,
        'text-font':BASEMAP_FONT_STACK,
        'text-size':['interpolate',['linear'],['zoom'],11,9,15,10.5],
        'text-max-angle':35,
        'text-keep-upright':true,
        'text-padding':2
      },
      paint:nativeTextPaint('#5a5855',0.8)
    }];
  }

  if(n.includes('natural') || n.includes('landuse') || n.includes('landcover')){
    return [{
      id:`${prefix}-land`,type:'symbol',source,'source-layer':layerName,minzoom:11,
      filter:hasName,
      layout:nativePointLabelLayout(name,['interpolate',['linear'],['zoom'],11,9,15,10.5]),
      paint:nativeTextPaint('#5f7259',0.8)
    }];
  }

  if(n.includes('building')){
    return [{
      id:`${prefix}-building`,type:'symbol',source,'source-layer':layerName,minzoom:15,
      filter:hasName,
      layout:nativePointLabelLayout(name,9.5),
      paint:nativeTextPaint('#69645e',0.75)
    }];
  }

  return [];
}

function offlineBasemapLayers(source='offline-base', offlineMap={}){
  const metadataLayers=Array.isArray(offlineMap?.vectorLayers)
    ? offlineMap.vectorLayers.map(v=>typeof v==='string'?v:v?.id).filter(Boolean)
    : [];
  const fallback=['earth','land','landuse','landcover','natural','water','physical_line','buildings','roads','transit','boundaries','places','physical_point','pois'];
  const names=[...new Set(metadataLayers.length?metadataLayers:fallback)];

  // Keep every label layer above every geometry layer so fills/lines never
  // cover text. MapLibre handles collision, repetition and line-following.
  const geometry=names.flatMap((name,i)=>semanticBasemapLayers(source,name,i));
  const labels=names.flatMap((name,i)=>nativeBasemapLabelLayers(source,name,i));
  return [...geometry,...labels];
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

function featureName(props={}) {
  return String(props['name:ru'] || props.name_ru || props.name || props.title || props.caption || '').trim();
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

    installRacePointLabels(map,points,onPointClick);

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
