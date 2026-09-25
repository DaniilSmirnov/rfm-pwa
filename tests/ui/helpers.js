export const raceFixture={
  id:101,
  name:'Rally Test Sortavala',
  category_race:'Rally',
  stage_race:'Этап 1',
  status_race:'Скоро',
  dates:'26.09.2026',
  date_race:'26.09.2026',
  city_race:'Республика Карелия',
  city_race_details:'Сортавала',
  total_distance:'120 км',
  combat_km:'82 км',
  days_race:'2',
  image:'hero.jpg',
  mapsimg:'map.jpg',
  safety_leaflet:'safety.jpg',
  overlap_schedule:null,
  lists:[],
  results:[],
  coordinates:[
    {id:1,name:'Смотровая точка',coordinates:'61.702000, 30.691000',color:'#f00'},
    {id:2,name:'Парковка зрителей',coordinates:'61.710000, 30.700000',color:'#0f0'}
  ],
  schedule:[
    {
      id:1,
      date:'26.09.2026',
      location:'СУ 1 Сортавала',
      coordinates:'61.705000, 30.695000',
      events:[
        {time:'10:00',text:'Закрытие дороги'},
        {time:'12:00',text:'Открытие дороги'}
      ]
    }
  ],
  how_it_was:'<p>История этапа <strong>жирно</strong><script>window.__xss=1</script><a href="javascript:window.__xss=2">опасная ссылка</a></p>',
  iframe_maps:null
};

export const secondRace={
  ...raceFixture,
  id:202,
  name:'Rally Far Future',
  dates:'20.12.2026',
  date_race:'20.12.2026',
  city_race:'Пермский край',
  city_race_details:'Пермь',
  image:null,
  mapsimg:null,
  safety_leaflet:null,
  coordinates:[{id:3,name:'Future point',coordinates:'58.010000, 56.250000'}],
  schedule:[]
};

const onePixelPng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');

const maplibreStub=String.raw`
export function supported(){return true;}
export function addProtocol(){}
export function setWorkerUrl(url){window.__maplibreWorkerUrl=url;}
export class NavigationControl{constructor(options={}){this.options=options;}}
export class Map{
  constructor(options={}){
    this.container=typeof options.container==='string'?document.querySelector(options.container):options.container;
    this.zoom=Number(options.zoom)||5;
    this.sources={};
    this.layers=[];
    this.handlers={};
    queueMicrotask(()=>this.emit('load',{}));
  }
  on(type,a,b){
    const handler=typeof a==='function'?a:b;
    if(typeof handler==='function')(this.handlers[type]||(this.handlers[type]=[])).push(handler);
    if(type==='idle'&&typeof handler==='function')queueMicrotask(()=>handler({}));
    return this;
  }
  emit(type,event){for(const fn of this.handlers[type]||[])fn(event);}
  addSource(id,source){this.sources[id]={...source,setData:data=>{this.sources[id].data=data;}};}
  addLayer(layer){this.layers.push(layer);}
  addControl(){return this;}
  getSource(id){return this.sources[id]||null;}
  getLayer(id){return this.layers.find(x=>x.id===id)||null;}
  getStyle(){return {layers:this.layers};}
  queryRenderedFeatures(){return [];}
  project(){return {x:100,y:100};}
  getZoom(){return this.zoom;}
  isStyleLoaded(){return true;}
  fitBounds(bounds,options={}){this.bounds=bounds;this.zoom=Math.min(options.maxZoom||12,12);return this;}
  easeTo(options={}){if(Number.isFinite(options.zoom))this.zoom=options.zoom;return this;}
  getCanvas(){return {style:{}};}
  remove(){}
}
export class Marker{
  constructor(options={}){this.element=options.element||document.createElement('div');}
  setLngLat(value){this.lngLat=value;return this;}
  addTo(map){this.map=map;map?.container?.appendChild(this.element);return this;}
  remove(){this.element?.remove();}
  getElement(){return this.element;}
}
export class Popup{
  constructor(){this.element=null;}
  setLngLat(value){this.lngLat=value;return this;}
  setHTML(value){this.html=value;return this;}
  addTo(map){this.map=map;return this;}
  remove(){return this;}
}
`;

const pmtilesStub=String.raw`
window.pmtiles={
  PMTiles:class{
    constructor(url){this.url=url;}
    async getHeader(){return {tileType:1};}
    async getMetadata(){return {name:'test',version:'1',vector_layers:[{id:'roads',fields:{kind:'String'}},{id:'places',fields:{kind:'String'}}]};}
    async getZxy(){if(window.__pmtilesFail)throw new Error('simulated tile failure');return {data:new Uint8Array([1,2,3,4]).buffer};}
  }
};
`;

export async function installAppMocks(page,options={}){
  const {
    healthStatus=200,
    catalogStatus=200,
    catalog=[raceFixture,secondRace],
    race=raceFixture,
    online=true
  }=options;

  await page.addInitScript(({pmtilesFailure})=>{window.__pmtilesFail=Boolean(pmtilesFailure);},{pmtilesFailure:options.pmtilesFailure});

  await page.addInitScript(({online})=>{
    const RealDate=Date;
    const fixedNow=new RealDate('2026-09-24T06:00:00.000Z').getTime();
    class FixedDate extends RealDate{
      constructor(...args){super(...(args.length?args:[fixedNow]));}
      static now(){return fixedNow;}
    }
    window.Date=FixedDate;
    window.__rfmTestOnline=online;
    try{Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>window.__rfmTestOnline});}catch{}
    const clipboard={writeText:async text=>{window.__copied=text;}};
    try{Object.defineProperty(navigator,'clipboard',{configurable:true,value:clipboard});}
    catch{try{navigator.clipboard.writeText=clipboard.writeText;}catch{}}
    const geolocation={
      getCurrentPosition(ok){ok({coords:{latitude:61.7,longitude:30.69,accuracy:5}});},
      watchPosition(ok){queueMicrotask(()=>ok({coords:{latitude:61.7,longitude:30.69,accuracy:5}}));return 1;},
      clearWatch(){}
    };
    try{Object.defineProperty(navigator,'geolocation',{configurable:true,value:geolocation});}
    catch{try{navigator.geolocation.getCurrentPosition=geolocation.getCurrentPosition;navigator.geolocation.watchPosition=geolocation.watchPosition;navigator.geolocation.clearWatch=geolocation.clearWatch;}catch{}}
    const swRegistration={
      waiting:null,
      installing:null,
      backgroundFetch:null,
      periodicSync:null,
      pushManager:{getSubscription:async()=>null},
      update:async()=>{},
      addEventListener(){}
    };
    const serviceWorker={
      controller:null,
      ready:Promise.resolve(swRegistration),
      register:async()=>swRegistration,
      addEventListener(){}
    };
    try{Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:serviceWorker});}catch{}
  },{online});

  await page.route('**/vendor/maplibre-gl/**',async route=>{
    const url=route.request().url();
    if(url.endsWith('maplibre-gl.mjs')) return route.fulfill({status:200,contentType:'application/javascript',body:maplibreStub});
    if(url.endsWith('.css')) return route.fulfill({status:200,contentType:'text/css',body:''});
    return route.fulfill({status:200,contentType:'application/javascript',body:'export default {};'});
  });
  await page.route('**/vendor/pmtiles/pmtiles.js',route=>
    route.fulfill({status:200,contentType:'application/javascript',body:pmtilesStub})
  );

  await page.route('**/rfm/icon.png*',route=>route.fulfill({status:200,contentType:'image/png',body:onePixelPng}));
  await page.route('**/api/rallyfans/public/**',route=>route.fulfill({status:200,contentType:'image/png',body:onePixelPng}));

  await page.route('**/api/health',route=>route.fulfill({
    status:healthStatus,
    contentType:'application/json',
    body:JSON.stringify(healthStatus===200?{ok:true,version:'0.6.0'}:{ok:false,error:'down'})
  }));

  await page.route('**/api/rallyfans/race',route=>route.fulfill({
    status:catalogStatus,
    contentType:'application/json',
    body:catalogStatus===200?JSON.stringify(catalog):JSON.stringify({error:'catalog down'})
  }));

  await page.route(/\/api\/rallyfans\/race\/\d+$/,route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify(race)
  }));

  await page.route('**/api/push/config',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,enabled:false,publicKey:null,storage:false})}));
  await page.route('**/api/push/schedule',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,stored:0})}));
  await page.route('**/api/yandex/constructor*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,features:[],sourceFeatureCount:0})}));
  await page.route('**/api/wallet/**',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:'disabled'})}));
}

export async function openApp(page,options={}){
  await installAppMocks(page,options);
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(()=>document.querySelector('#catalogStatus')?.textContent?.includes('гонок') || document.querySelector('#catalogStatus')?.textContent?.includes('недоступен') || document.querySelector('#catalogStatus')?.textContent?.includes('Офлайн'));
}

export async function downloadFixtureRace(page){
  const row=page.locator('.catalog-row').filter({hasText:raceFixture.name});
  await row.getByRole('button',{name:/Скачать Rally Pack|Обновить Rally Pack/}).click();
  await page.locator('#raceDetails').waitFor({state:'visible'});
}
