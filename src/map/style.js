import { registerOfflineMapProtocol, offlineVectorSource, resetOfflineMapDiagnostics } from '../offline-map.js';
import { terrainStyleParts } from './terrain.js';

function basemapField(...names){
  return ['to-string',['coalesce',...names.map(name=>['get',name]),'']];
}

function basemapNumber(names,fallback=0){
  return ['to-number',['coalesce',...names.map(name=>['get',name]),fallback],fallback];
}

function basemapTruthy(...names){
  const value=basemapField(...names);
  return ['!', ['in', value, ['literal',['','0','false','no','none','null']]]];
}

function featureMinZoom(){
  return basemapNumber(['min_zoom','minzoom'],0);
}

function featureSortRank(fallback=0){
  return basemapNumber(['sort_rank','rank'],fallback);
}

function minZoomOpacity(opacity=1){
  const out=['step',['zoom'],0];
  for(let z=5;z<=18;z++){
    out.push(z,['case',['<=',featureMinZoom(),z],opacity,0]);
  }
  return out;
}

function basemapClass(){
  return basemapField('kind','kind_detail','highway','pmap:kind','class','type','natural','landuse','amenity','tourism','shop');
}

function roadClass(){
  return basemapField('kind_detail','highway','pmap:kind','kind','class','type');
}

function roadKind(){
  return basemapField('kind');
}

function roadWidthAt(level,casing=0){
  const widths=level<=6
    ? ['motorway',2.2,'motorway_link',1.65,'trunk',2,'trunk_link',1.5,'primary',1.7,'primary_link',1.3,'secondary',1.4,'secondary_link',1.1,'tertiary',1.1,'tertiary_link',.9,.7]
    : level<=10
      ? ['motorway',4.2,'motorway_link',3.1,'trunk',3.8,'trunk_link',2.8,'primary',3.2,'primary_link',2.4,'secondary',2.7,'secondary_link',2,'tertiary',2.2,'tertiary_link',1.7,'residential',1.6,'service',1.2,'unclassified',1.4,'track',1.1,'path',.9,'steps',.8,1.3]
      : ['motorway',9,'motorway_link',6.5,'trunk',8,'trunk_link',5.8,'primary',7,'primary_link',5.2,'secondary',6,'secondary_link',4.5,'tertiary',5,'tertiary_link',3.8,'residential',4,'service',3,'unclassified',3.4,'road',3.2,'pedestrian',3,'track',2.4,'path',1.8,'footway',1.6,'sidewalk',1.4,'crossing',1.6,'cycleway',1.8,'bridleway',1.6,'steps',1.5,'driveway',2.2,'parking_aisle',2,'alley',2,'emergency_access',2,2.5];
  return ['+',
    ['*',
      ['match',roadClass(),...widths],
      ['case',basemapTruthy('is_link'),.82,1]
    ],
    casing
  ];
}

function roadWidth(casing=0){
  return ['interpolate',['linear'],['zoom'],
    6,roadWidthAt(6,casing),
    10,roadWidthAt(10,casing),
    14,roadWidthAt(14,casing)
  ];
}

function roadColor(){
  return ['match',roadClass(),
    'motorway','#d98f49','motorway_link','#d99b5f',
    'trunk','#dfa35a','trunk_link','#e1b270',
    'primary','#e7bb6f','primary_link','#e8c58a',
    'secondary','#ead191','secondary_link','#ead9a8',
    'tertiary','#f1dfb1','tertiary_link','#f2e5c5',
    'residential','#ffffff',
    'living_street','#ffffff',
    'pedestrian','#f5eee3',
    'service','#f7f6f2',
    'unclassified','#fbfaf6',
    'driveway','#f4f1eb',
    'parking_aisle','#f0ede7',
    'alley','#f3efe9',
    'track','#c9b48f',
    'path','#b7a98d',
    'footway','#b7a98d',
    'sidewalk','#b9afa0',
    'crossing','#9e9a91',
    'cycleway','#93b7a0',
    'bridleway','#b79c7d',
    'steps','#9e968a',
    '#ebe8df'
  ];
}

function landColor(){
  const sport=basemapField('sport');
  return ['case',
    ['!=',sport,''],'#d2e2bd',
    ['match',basemapClass(),
      'forest','#c9ddbd','wood','#c9ddbd','scrub','#d1dfc7',
      'grass','#dce8c7','grassland','#dce8c7','meadow','#dce8c7',
      'park','#d7e9c5','national_park','#cfe5c1','nature_reserve','#cfe5c1','recreation_ground','#d7e9c5',
      'farmland','#eadfbd','farm','#eadfbd','farmyard','#e7d9bc','orchard','#dce4bf',
      'residential','#e8e4dd','commercial','#e5dfdc','retail','#e5dfdc','industrial','#ddd8d4',
      'cemetery','#d5dfcf','military','#ded9d0',
      'school','#e8dfca','college','#e8dfca','university','#e8dfca','kindergarten','#e8dfca',
      'hospital','#e8d7d8',
      'sand','#eee2bd','beach','#f3e5b8','wetland','#c8ded2','glacier','#e5f0f2','bare_rock','#dedbd5',
      'runway','#d4d2cf','taxiway','#dedbd8','aerodrome','#dedbd8',
      'pitch','#d2e2bd','stadium','#d4e3c2','golf_course','#d7e5c9',
      '#e3e6db'
    ]
  ];
}

function poiColor(){
  return ['match',basemapField('kind'),
    'fuel','#d97838','charging_station','#64a36f',
    'parking','#6f86a7','bicycle_parking','#6f86a7','motorcycle_parking','#6f86a7',
    'toilets','#8a75a2','shower','#8a75a2',
    'drinking_water','#4a90a8','water_point','#4a90a8',
    'hospital','#c85f67','clinic','#c85f67','pharmacy','#c85f67','doctors','#c85f67','dentist','#c85f67',
    'fire_station','#c85f67','emergency_phone','#c85f67',
    'viewpoint','#7a6f55','information','#687c91',
    'camp_site','#5f8a62','caravan_site','#5f8a62','shelter','#5f8a62','alpine_hut','#5f8a62','wilderness_hut','#5f8a62',
    'supermarket','#8b6b9a','convenience','#8b6b9a','grocery','#8b6b9a',
    'cafe','#a87a54','restaurant','#a87a54','bakery','#a87a54',
    'hotel','#7d6a99','motel','#7d6a99','guest_house','#7d6a99','hostel','#7d6a99','bed_and_breakfast','#7d6a99',
    'station','#657a92','bus_stop','#657a92','aerodrome','#657a92','airfield','#657a92',
    'peak','#756b58','landmark','#756b58','memorial','#756b58',
    '#777f89'
  ];
}

function poiIconExpression(){
  return ['match',basemapField('kind'),
    'fuel','⛽','charging_station','⚡',
    'parking','P','bicycle_parking','P','motorcycle_parking','P',
    'toilets','WC','shower','◌',
    'drinking_water','◉','water_point','◉',
    'hospital','✚','clinic','✚','pharmacy','✚','doctors','✚','dentist','✚',
    'fire_station','✚','emergency_phone','!',
    'viewpoint','◉','information','i',
    'camp_site','△','caravan_site','△','shelter','△','alpine_hut','△','wilderness_hut','△',
    'supermarket','▣','convenience','▣','grocery','▣',
    'cafe','●','restaurant','●','bakery','●',
    'hotel','◆','motel','◆','guest_house','◆','hostel','◆','bed_and_breakfast','◆',
    'station','▤','bus_stop','▤','aerodrome','✈','airfield','✈',
    'peak','▲','landmark','◆','memorial','◆',
    '•'
  ];
}

function waterClass(){
  return basemapField('kind_detail','kind');
}

function waterWidth(){
  return ['interpolate',['linear'],['zoom'],
    6,['match',waterClass(),'river',1.1,'canal',.9,'stream',.6,'drain',.45,'ditch',.4,.7],
    10,['match',waterClass(),'river',2.2,'canal',1.7,'stream',1.1,'drain',.75,'ditch',.65,1.2],
    14,['match',waterClass(),'river',4.2,'canal',3,'stream',2,'drain',1.3,'ditch',1.1,2]
  ];
}

function boundaryWidth(){
  return ['interpolate',['linear'],['zoom'],
    5,['match',basemapField('kind'),'country',1.5,'region',1,'county',.7,'locality',.5,.6],
    10,['match',basemapField('kind'),'country',2.3,'region',1.7,'county',1.2,'locality',.8,1],
    14,['match',basemapField('kind'),'country',3,'region',2.2,'county',1.6,'locality',1.1,1.3]
  ];
}

function semanticBasemapLayers(source,layerName,index){
  const id=String(layerName).replace(/[^a-z0-9_-]/gi,'-');
  const n=String(layerName||'').toLowerCase();
  const prefix=`base-${index}-${id}`;
  const sortKey=featureSortRank(0);

  if(n.includes('earth') || n==='land' || n.includes('mask')){
    return [
      {id:`${prefix}-fill`,type:'fill',source,'source-layer':layerName,filter:['==',['geometry-type'],'Polygon'],layout:{'fill-sort-key':sortKey},paint:{'fill-color':'#f2f0e9','fill-opacity':minZoomOpacity(1)}}
    ];
  }

  if(n.includes('water')){
    const reservoir=['any',basemapTruthy('reservoir'),['==',waterClass(),'reservoir']];
    const tunneled=basemapTruthy('tunnel');
    const bridged=basemapTruthy('bridge');
    return [
      {id:`${prefix}-fill`,type:'fill',source,'source-layer':layerName,filter:['==',['geometry-type'],'Polygon'],layout:{'fill-sort-key':sortKey},paint:{
        'fill-color':['case',basemapTruthy('alkaline'),'#c9d8cf',reservoir,'#b3d5e4','#b9dce9'],
        'fill-opacity':minZoomOpacity(.96)
      }},
      {id:`${prefix}-line`,type:'line',source,'source-layer':layerName,filter:['all',['==',['geometry-type'],'LineString'],['!',basemapTruthy('intermittent')]],layout:{'line-sort-key':sortKey},paint:{
        'line-color':['case',tunneled,'#9ab7c2',bridged,'#5f9eb8','#79afc5'],
        'line-width':waterWidth(),
        'line-opacity':minZoomOpacity(.95)
      }},
      {id:`${prefix}-intermittent`,type:'line',source,'source-layer':layerName,filter:['all',['==',['geometry-type'],'LineString'],basemapTruthy('intermittent')],layout:{'line-sort-key':sortKey},paint:{
        'line-color':'#79afc5','line-width':waterWidth(),'line-dasharray':[2,2],'line-opacity':minZoomOpacity(.8)
      }}
    ];
  }

  if(n.includes('landuse') || n.includes('landcover') || n.includes('natural')){
    return [
      {id:`${prefix}-fill`,type:'fill',source,'source-layer':layerName,filter:['==',['geometry-type'],'Polygon'],layout:{'fill-sort-key':sortKey},paint:{'fill-color':landColor(),'fill-opacity':minZoomOpacity(.9)}},
      {id:`${prefix}-line`,type:'line',source,'source-layer':layerName,filter:['==',['geometry-type'],'LineString'],layout:{'line-sort-key':sortKey},paint:{'line-color':'#a9b69d','line-width':['interpolate',['linear'],['zoom'],6,.4,14,1.4],'line-opacity':minZoomOpacity(.85)}},
      {id:`${prefix}-point`,type:'circle',source,'source-layer':layerName,filter:['==',['geometry-type'],'Point'],layout:{'circle-sort-key':sortKey},paint:{'circle-color':'#78906f','circle-radius':['interpolate',['linear'],['zoom'],7,1.5,14,3.5],'circle-opacity':minZoomOpacity(.8)}}
    ];
  }

  if(n.includes('building')){
    const buildingSort=['+',['*',basemapNumber(['layer'],0),10000],sortKey];
    return [
      {id:`${prefix}-fill`,type:'fill',source,'source-layer':layerName,filter:['==',['geometry-type'],'Polygon'],minzoom:12,layout:{'fill-sort-key':buildingSort},paint:{'fill-color':'#d6d0c9','fill-opacity':minZoomOpacity(.92),'fill-outline-color':'#bcb4ac'}}
    ];
  }

  if(n.includes('road')){
    const kind=roadKind();
    const cls=roadClass();
    const railDetails=['disused','funicular','light_rail','miniature','monorail','narrow_gauge','preserved','subway','tram'];
    const isRail=['any',['==',kind,'rail'],['in',cls,['literal',railDetails]]];
    const isAeroway=['any',['==',kind,'aeroway'],['in',cls,['literal',['runway','taxiway']]]];
    const isFerry=['==',kind,'ferry'];
    const roadFilter=['all',['==',['geometry-type'],'LineString'],['!',isRail],['!',isAeroway],['!',isFerry]];
    const bridgeFilter=['all',...roadFilter.slice(1),basemapTruthy('is_bridge')];
    const tunnelFilter=['all',...roadFilter.slice(1),basemapTruthy('is_tunnel')];

    return [
      {id:`${prefix}-casing`,type:'line',source,'source-layer':layerName,filter:roadFilter,layout:{'line-sort-key':sortKey},paint:{'line-color':'#aaa49b','line-width':roadWidth(1.6),'line-opacity':minZoomOpacity(.95)}},
      {id:`${prefix}-bridge-casing`,type:'line',source,'source-layer':layerName,filter:bridgeFilter,layout:{'line-sort-key':sortKey},paint:{'line-color':'#817b73','line-width':roadWidth(2.6),'line-opacity':minZoomOpacity(.9)}},
      {id:`${prefix}-road`,type:'line',source,'source-layer':layerName,filter:roadFilter,layout:{'line-sort-key':sortKey},paint:{'line-color':roadColor(),'line-width':roadWidth(),'line-opacity':minZoomOpacity(.98)}},
      {id:`${prefix}-tunnel`,type:'line',source,'source-layer':layerName,filter:tunnelFilter,layout:{'line-sort-key':sortKey},paint:{'line-color':'#8e8a83','line-width':roadWidth(.3),'line-dasharray':[2,2],'line-opacity':minZoomOpacity(.55)}},
      {id:`${prefix}-rail`,type:'line',source,'source-layer':layerName,filter:['all',['==',['geometry-type'],'LineString'],isRail],layout:{'line-sort-key':sortKey},paint:{
        'line-color':['case',['!=',basemapField('service'),''],'#85817b','#66635f'],'line-width':['interpolate',['linear'],['zoom'],7,.8,14,2.4],
        'line-dasharray':[2,1.5],
        'line-opacity':minZoomOpacity(.92)
      }},
      {id:`${prefix}-aeroway`,type:'line',source,'source-layer':layerName,filter:['all',['==',['geometry-type'],'LineString'],isAeroway],layout:{'line-sort-key':sortKey},paint:{
        'line-color':['match',cls,'runway','#aaa7a3','taxiway','#c1beb9','#b5b2ad'],
        'line-width':['interpolate',['linear'],['zoom'],8,1.3,14,5],
        'line-opacity':minZoomOpacity(.9)
      }},
      {id:`${prefix}-ferry`,type:'line',source,'source-layer':layerName,filter:['all',['==',['geometry-type'],'LineString'],isFerry],layout:{'line-sort-key':sortKey},paint:{
        'line-color':'#4f91ad','line-width':['interpolate',['linear'],['zoom'],6,.8,14,2.2],
        'line-dasharray':[3,2],'line-opacity':minZoomOpacity(.85)
      }}
    ];
  }

  if(n.includes('transit') || n.includes('rail')){
    return [
      {id:`${prefix}-rail`,type:'line',source,'source-layer':layerName,filter:['==',['geometry-type'],'LineString'],layout:{'line-sort-key':sortKey},paint:{'line-color':'#72706d','line-width':['interpolate',['linear'],['zoom'],7,.7,14,2.2],'line-dasharray':[2,1.5],'line-opacity':minZoomOpacity(.9)}}
    ];
  }

  if(n.includes('boundar')){
    const common={type:'line',source,'source-layer':layerName,layout:{'line-sort-key':sortKey}};
    return [
      {id:`${prefix}-line`,...common,filter:['all',['==',['geometry-type'],'LineString'],['!',basemapTruthy('disputed')]],paint:{
        'line-color':['match',basemapField('kind'),'country','#777d85','region','#8e949b','county','#a8adb2','locality','#b7bbc0','#9ea2a8'],
        'line-width':boundaryWidth(),'line-opacity':minZoomOpacity(.82)
      }},
      {id:`${prefix}-disputed`,...common,filter:['all',['==',['geometry-type'],'LineString'],basemapTruthy('disputed')],paint:{
        'line-color':'#9b7777','line-width':boundaryWidth(),'line-dasharray':[3,2],'line-opacity':minZoomOpacity(.9)
      }}
    ];
  }

  if(n.includes('physical_line')){
    return [
      {id:`${prefix}-line`,type:'line',source,'source-layer':layerName,filter:['==',['geometry-type'],'LineString'],layout:{'line-sort-key':sortKey},paint:{'line-color':['match',basemapClass(),'cliff','#857c72','ridge','#9b8b76','river','#79afc5','stream','#79afc5','#aaa49b'],'line-width':['interpolate',['linear'],['zoom'],7,.5,14,1.8],'line-opacity':minZoomOpacity(.82)}}
    ];
  }

  if(n.includes('poi')){
    return [
      {id:`${prefix}-point`,type:'circle',source,'source-layer':layerName,filter:['==',['geometry-type'],'Point'],minzoom:10,layout:{'circle-sort-key':sortKey},paint:{'circle-color':poiColor(),'circle-radius':['interpolate',['linear'],['zoom'],10,2.4,14,4.8],'circle-stroke-color':'#fff','circle-stroke-width':1.2,'circle-opacity':minZoomOpacity(.96)}}
    ];
  }

  if(n.includes('place')){
    return [
      {id:`${prefix}-point`,type:'circle',source,'source-layer':layerName,filter:['==',['geometry-type'],'Point'],layout:{'circle-sort-key':sortKey},paint:{'circle-color':['case',['!=',basemapField('capital'),''],'#34383c','#555b61'],'circle-radius':['interpolate',['linear'],['zoom'],6,1.5,14,3.4],'circle-opacity':minZoomOpacity(.8)}}
    ];
  }

  if(n.includes('physical_point')){
    return [
      {id:`${prefix}-point`,type:'circle',source,'source-layer':layerName,filter:['==',['geometry-type'],'Point'],minzoom:9,layout:{'circle-sort-key':sortKey},paint:{'circle-color':'#706756','circle-radius':['interpolate',['linear'],['zoom'],9,2,14,4],'circle-stroke-color':'#f7f4ed','circle-stroke-width':1,'circle-opacity':minZoomOpacity(.95)}}
    ];
  }

  return [
    {id:`${prefix}-fill`,type:'fill',source,'source-layer':layerName,filter:['==',['geometry-type'],'Polygon'],layout:{'fill-sort-key':sortKey},paint:{'fill-color':'#e5e5e5','fill-opacity':minZoomOpacity(.72)}},
    {id:`${prefix}-line`,type:'line',source,'source-layer':layerName,filter:['==',['geometry-type'],'LineString'],layout:{'line-sort-key':sortKey},paint:{'line-color':'#9ca3aa','line-width':['interpolate',['linear'],['zoom'],6,.4,14,1.4],'line-opacity':minZoomOpacity(.82)}},
    {id:`${prefix}-point`,type:'circle',source,'source-layer':layerName,filter:['==',['geometry-type'],'Point'],layout:{'circle-sort-key':sortKey},paint:{'circle-color':'#7f878e','circle-radius':['interpolate',['linear'],['zoom'],6,1.4,14,3.2],'circle-opacity':minZoomOpacity(.8)}}
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
    ['!=',name,''],name,
    ref
  ];
}

function placeClassExpression(){
  return basemapField('kind_detail','kind','place','class','type','category','subclass');
}

function placeSortKey(){
  const populationRank=basemapNumber(['population_rank'],0);
  return ['case',
    ['!=',basemapField('capital'),''],-1000,
    ['>',populationRank,0],['-',100,populationRank],
    featureSortRank(9999)
  ];
}

function placeTextSize(major=true){
  const populationRank=basemapNumber(['population_rank'],0);
  const capital=['!=',basemapField('capital'),''];
  return ['interpolate',['linear'],['zoom'],
    major?5:9,
    ['case',capital,major?13:11,['>=',populationRank,14],major?12:10.5,['>=',populationRank,10],major?11:10,major?10.5:9.5],
    14,
    ['case',capital,major?16:13,['>=',populationRank,14],major?15:12.5,['>=',populationRank,10],major?14:12,major?13:11]
  ];
}

function nativeTextPaint(color='#45484c',haloWidth=1){
  return {
    'text-color':color,
    'text-halo-color':'rgba(255,255,255,0.96)',
    'text-halo-width':haloWidth,
    'text-halo-blur':0.35,
    'text-opacity':minZoomOpacity(1)
  };
}

function nativePointLabelLayout(textField,textSize,sortKey=featureSortRank(9999)){
  return {
    'text-field':textField,
    'text-font':BASEMAP_FONT_STACK,
    'text-size':textSize,
    'text-variable-anchor':['top','bottom','left','right'],
    'text-radial-offset':0.65,
    'text-padding':2,
    'text-max-width':12,
    'text-allow-overlap':false,
    'text-ignore-placement':false,
    'symbol-sort-key':sortKey
  };
}

function poiDetailedLabel(){
  const name=labelNameExpression();
  const iata=basemapField('iata');
  const cuisine=basemapField('cuisine');
  const religion=basemapField('religion');
  const sport=basemapField('sport');
  return ['concat',
    name,
    ['case',['!=',iata,''],['concat','\nIATA ',iata],''],
    ['case',['!=',cuisine,''],['concat','\n',cuisine],''],
    ['case',['!=',religion,''],['concat','\n',religion],''],
    ['case',['!=',sport,''],['concat','\n',sport],'']
  ];
}

function nativeBasemapLabelLayers(source,layerName,index){
  const id=String(layerName).replace(/[^a-z0-9_-]/gi,'-');
  const n=String(layerName||'').toLowerCase();
  const prefix=`base-label-${index}-${id}`;
  const name=labelNameExpression();
  const hasName=['!=',name,''];
  const klass=roadClass();
  const sortKey=featureSortRank(9999);

  if(n.includes('place')){
    const place=placeClassExpression();
    const label=['case',['!=',basemapField('capital'),''],['concat','★ ',name],name];
    const major=['country','state','province','city','town'];
    return [
      {
        id:`${prefix}-major`,type:'symbol',source,'source-layer':layerName,minzoom:5,
        filter:['all',hasName,['in',place,['literal',major]]],
        layout:{
          ...nativePointLabelLayout(label,placeTextSize(true),placeSortKey()),
          'text-padding':4
        },
        paint:nativeTextPaint('#25282c',1)
      },
      {
        id:`${prefix}-minor`,type:'symbol',source,'source-layer':layerName,minzoom:8,
        filter:['all',hasName,['!', ['in',place,['literal',major]]]],
        layout:nativePointLabelLayout(label,placeTextSize(false),placeSortKey()),
        paint:nativeTextPaint('#4d5156',.8)
      }
    ];
  }

  if(n.includes('road')){
    const roadText=roadLabelExpression();
    const shield=basemapField('shield_text');
    const oneway=basemapField('oneway');
    const hasRoadText=['!=',roadText,''];
    const major=['motorway','motorway_link','trunk','trunk_link','primary','primary_link','secondary','secondary_link','tertiary','tertiary_link'];
    const notRail=['!', ['in',roadKind(),['literal',['rail','aeroway','ferry']]]];
    return [
      {
        id:`${prefix}-major`,type:'symbol',source,'source-layer':layerName,minzoom:8,
        filter:['all',['==',['geometry-type'],'LineString'],notRail,hasRoadText,['in',klass,['literal',major]]],
        layout:{
          'symbol-placement':'line','symbol-spacing':320,'symbol-sort-key':sortKey,
          'text-field':roadText,'text-font':BASEMAP_FONT_STACK,
          'text-size':['interpolate',['linear'],['zoom'],8,9.5,12,10.5,16,12.5],
          'text-letter-spacing':.01,'text-max-angle':35,'text-keep-upright':true,'text-padding':2
        },
        paint:nativeTextPaint('#5f5b55',.9)
      },
      {
        id:`${prefix}-local`,type:'symbol',source,'source-layer':layerName,minzoom:11,
        filter:['all',['==',['geometry-type'],'LineString'],notRail,hasRoadText,['!', ['in',klass,['literal',major]]]],
        layout:{
          'symbol-placement':'line','symbol-spacing':230,'symbol-sort-key':sortKey,
          'text-field':roadText,'text-font':BASEMAP_FONT_STACK,
          'text-size':['interpolate',['linear'],['zoom'],11,8.8,14,11.2],
          'text-letter-spacing':.01,'text-max-angle':40,'text-keep-upright':true,'text-padding':1
        },
        paint:nativeTextPaint('#64615c',.8)
      },
      {
        id:`${prefix}-shield`,type:'symbol',source,'source-layer':layerName,minzoom:8,
        filter:['all',['==',['geometry-type'],'LineString'],notRail,['!=',shield,'']],
        layout:{
          'symbol-placement':'line','symbol-spacing':520,'symbol-sort-key':sortKey,
          'text-field':shield,'text-font':BASEMAP_FONT_STACK,
          'text-size':['interpolate',['linear'],['zoom'],8,8.5,14,10.5],
          'text-padding':5,'text-keep-upright':true
        },
        paint:{...nativeTextPaint('#3d5064',2.2),'text-halo-color':'rgba(255,255,255,.98)'}
      },
      {
        id:`${prefix}-oneway`,type:'symbol',source,'source-layer':layerName,minzoom:12,
        filter:['all',['==',['geometry-type'],'LineString'],notRail,['!', ['in',oneway,['literal',['','0','false','no']]]]],
        layout:{
          'symbol-placement':'line','symbol-spacing':130,'symbol-sort-key':sortKey,
          'text-field':['case',['==',oneway,'-1'],'←','→'],
          'text-font':BASEMAP_FONT_STACK,'text-size':13,
          'text-keep-upright':false,'text-padding':1
        },
        paint:{...nativeTextPaint('#77736c',.6),'text-opacity':minZoomOpacity(.7)}
      }
    ];
  }

  if(n.includes('poi')){
    const iata=basemapField('iata');
    const hasUseful=['any',hasName,['!=',iata,'']];
    return [
      {
        id:`${prefix}-icon`,type:'symbol',source,'source-layer':layerName,minzoom:10,
        filter:['==',['geometry-type'],'Point'],
        layout:{
          ...nativePointLabelLayout(poiIconExpression(),['interpolate',['linear'],['zoom'],10,8,14,10.5],sortKey),
          'text-radial-offset':0
        },
        paint:{...nativeTextPaint('#394047',.8),'text-opacity':minZoomOpacity(.92)}
      },
      {
        id:`${prefix}-label`,type:'symbol',source,'source-layer':layerName,minzoom:11,
        filter:['all',['==',['geometry-type'],'Point'],hasUseful],
        layout:nativePointLabelLayout(
          ['step',['zoom'],['case',hasName,name,iata],14,poiDetailedLabel()],
          ['interpolate',['linear'],['zoom'],11,8.8,14,10.8],
          sortKey
        ),
        paint:nativeTextPaint('#4d5156',.8)
      }
    ];
  }

  if(n.includes('physical_point')){
    const ele=basemapField('ele','elevation');
    const text=['case',
      ['all',hasName,['!=',ele,'']],['concat',name,' · ',ele,' м'],
      name
    ];
    return [{
      id:`${prefix}-physical`,type:'symbol',source,'source-layer':layerName,minzoom:9,
      filter:['all',['==',['geometry-type'],'Point'],hasName],
      layout:nativePointLabelLayout(text,['interpolate',['linear'],['zoom'],9,9.2,14,11],sortKey),
      paint:nativeTextPaint('#625b50',.8)
    }];
  }

  if(n.includes('water')){
    return [
      {
        id:`${prefix}-water-line`,type:'symbol',source,'source-layer':layerName,minzoom:9,
        filter:['all',['==',['geometry-type'],'LineString'],hasName],
        layout:{
          'symbol-placement':'line','symbol-spacing':320,'symbol-sort-key':sortKey,
          'text-field':name,'text-font':BASEMAP_FONT_STACK,
          'text-size':['interpolate',['linear'],['zoom'],9,9.2,14,11.5],
          'text-max-angle':35,'text-keep-upright':true,'text-padding':2
        },
        paint:nativeTextPaint('#47798f',.7)
      },
      {
        id:`${prefix}-water-area`,type:'symbol',source,'source-layer':layerName,minzoom:8,
        filter:['all',['!=',['geometry-type'],'LineString'],hasName],
        layout:nativePointLabelLayout(name,['interpolate',['linear'],['zoom'],8,9.2,14,11.5],sortKey),
        paint:nativeTextPaint('#47798f',.7)
      }
    ];
  }

  if(n.includes('transit') || n.includes('rail')){
    const text=['case',hasName,name,labelRefExpression()];
    return [{
      id:`${prefix}-transit`,type:'symbol',source,'source-layer':layerName,minzoom:10,
      filter:['all',['==',['geometry-type'],'LineString'],['!=',text,'']],
      layout:{
        'symbol-placement':'line','symbol-spacing':360,'symbol-sort-key':sortKey,
        'text-field':text,'text-font':BASEMAP_FONT_STACK,
        'text-size':['interpolate',['linear'],['zoom'],10,9,14,10.5],
        'text-max-angle':35,'text-keep-upright':true,'text-padding':2
      },
      paint:nativeTextPaint('#5a5855',.75)
    }];
  }

  if(n.includes('boundar')){
    return [{
      id:`${prefix}-boundary`,type:'symbol',source,'source-layer':layerName,minzoom:7,
      filter:['all',['==',['geometry-type'],'LineString'],hasName],
      layout:{
        'symbol-placement':'line','symbol-spacing':600,'symbol-sort-key':sortKey,
        'text-field':name,'text-font':BASEMAP_FONT_STACK,
        'text-size':['interpolate',['linear'],['zoom'],7,8.5,14,10.5],
        'text-max-angle':35,'text-keep-upright':true,'text-padding':3
      },
      paint:nativeTextPaint('#72777d',.75)
    }];
  }

  if(n.includes('natural') || n.includes('landuse') || n.includes('landcover')){
    const sport=basemapField('sport');
    const text=['step',['zoom'],name,13,
      ['case',
        ['all',hasName,['!=',sport,'']],['concat',name,'\n',sport],
        hasName,name,
        sport
      ]
    ];
    return [{
      id:`${prefix}-land`,type:'symbol',source,'source-layer':layerName,minzoom:10,
      filter:['any',hasName,['!=',sport,'']],
      layout:nativePointLabelLayout(text,['interpolate',['linear'],['zoom'],10,8.8,14,10.5],sortKey),
      paint:nativeTextPaint('#5f7259',.7)
    }];
  }

  if(n.includes('building')){
    const number=basemapField('addr_housenumber');
    const buildingKind=basemapField('kind');
    return [
      {
        id:`${prefix}-building`,type:'symbol',source,'source-layer':layerName,minzoom:14,
        filter:['all',hasName,['!=',buildingKind,'address']],
        layout:nativePointLabelLayout(name,9.2,sortKey),
        paint:nativeTextPaint('#69645e',.7)
      },
      {
        id:`${prefix}-address`,type:'symbol',source,'source-layer':layerName,minzoom:14,
        filter:['all',['==',buildingKind,'address'],['!=',number,'']],
        layout:nativePointLabelLayout(number,9,sortKey),
        paint:nativeTextPaint('#5e5a55',.7)
      }
    ];
  }

  return [];
}

function offlineBasemapLayers(source='offline-base', offlineMap={}){
  const metadataLayers=Array.isArray(offlineMap?.vectorLayers)
    ? offlineMap.vectorLayers.map(v=>typeof v==='string'?v:v?.id).filter(Boolean)
    : [];
  const fallback=['earth','landuse','landcover','natural','water','physical_line','buildings','roads','transit','boundaries','places','physical_point','pois'];
  const names=[...new Set(metadataLayers.length?metadataLayers:fallback)];

  const geometry=names.flatMap((name,i)=>semanticBasemapLayers(source,name,i));
  const labels=names.flatMap((name,i)=>nativeBasemapLabelLayers(source,name,i));
  return [...geometry,...labels];
}

function baseStyle(offlineMap,terrain,{terrainMode='hillshade'}={}) {
  const sources = {};
  const layers = [{id:'background',type:'background',paint:{'background-color':'#11151b'}}];
  let labelLayers=[];

  if (offlineMap?.ready) {
    registerOfflineMapProtocol();
    resetOfflineMapDiagnostics();
    sources['offline-base']=offlineVectorSource(offlineMap.raceId,offlineMap);
    const basemapLayers=offlineBasemapLayers('offline-base',offlineMap);
    const firstLabel=basemapLayers.findIndex(layer=>layer.type==='symbol');
    if(firstLabel>=0){
      layers.push(...basemapLayers.slice(0,firstLabel));
      labelLayers=basemapLayers.slice(firstLabel);
    }else{
      layers.push(...basemapLayers);
    }
  } else if (navigator.onLine) {
    sources.osm = {type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,maxzoom:19,attribution:'© OpenStreetMap contributors'};
    layers.push({id:'osm',type:'raster',source:'osm',paint:{'raster-opacity':0.92}});
  }

  const terrainParts=terrainStyleParts(terrain,terrainMode);
  Object.assign(sources,terrainParts.sources);
  layers.push(...terrainParts.layers,...labelLayers);
  const style={version:8,sources,layers};
  if(terrainParts.terrain) style.terrain=terrainParts.terrain;
  return style;
}


export { baseStyle };
