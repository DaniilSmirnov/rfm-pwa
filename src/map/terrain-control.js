const TERRAIN_SOURCE='offline-terrain-3d';
const HILLSHADE_LAYER='terrain-hillshade';
const TERRAIN_EXAGGERATION=1.15;

function mountainIcon(){
  return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2.5 19.5 9 8.5l3 4.8 2.4-3.6 7.1 9.8H2.5Zm3.4-2h11.7l-3.1-4.3-2.6 3.8L9.1 12l-3.2 5.5Z" fill="currentColor"/></svg>';
}

function terrainSample(map){
  try{
    const center=map.getCenter?.();
    if(!center || typeof map.queryTerrainElevation!=='function') return null;
    const elevation=map.queryTerrainElevation(center);
    return Number.isFinite(elevation)?elevation:null;
  }catch{
    return null;
  }
}

export function waitForTerrainReady(map,{timeoutMs=4000}={}){
  if(!map) return Promise.resolve(null);

  const immediate=terrainSample(map);
  if(map.isSourceLoaded?.(TERRAIN_SOURCE) && immediate!==null) return Promise.resolve(immediate);

  return new Promise(resolve=>{
    let settled=false;
    let timer=null;

    const finish=value=>{
      if(settled) return;
      settled=true;
      if(timer) clearTimeout(timer);
      map.off?.('sourcedata',check);
      map.off?.('idle',check);
      map.off?.('render',check);
      resolve(value);
    };

    const check=()=>{
      const elevation=terrainSample(map);
      if(map.isSourceLoaded?.(TERRAIN_SOURCE) && elevation!==null) finish(elevation);
    };

    map.on?.('sourcedata',check);
    map.on?.('idle',check);
    map.on?.('render',check);
    timer=setTimeout(()=>finish(terrainSample(map)),timeoutMs);
    map.redraw?.();
    check();
  });
}

export async function applyTerrainMode(map,mode){
  if(!map) return 'hillshade';
  const next=mode==='3d'?'3d':'hillshade';

  if(next==='3d'){
    map.setTerrain?.({source:TERRAIN_SOURCE,exaggeration:TERRAIN_EXAGGERATION});
    map.redraw?.();

    const elevation=await waitForTerrainReady(map);
    if(elevation===null){
      map.setTerrain?.({source:TERRAIN_SOURCE,exaggeration:0});
      if(map.getLayer?.(HILLSHADE_LAYER)) map.setLayoutProperty?.(HILLSHADE_LAYER,'visibility','visible');
      throw new Error('DEM для 3D-рельефа не загрузился');
    }

    if(map.getLayer?.(HILLSHADE_LAYER)) map.setLayoutProperty?.(HILLSHADE_LAYER,'visibility','none');
    map.easeTo?.({pitch:68,bearing:-18,duration:650});
    map.redraw?.();
    console.info('3D terrain ready',{elevation});
  }else{
    map.setTerrain?.({source:TERRAIN_SOURCE,exaggeration:0});
    if(map.getLayer?.(HILLSHADE_LAYER)) map.setLayoutProperty?.(HILLSHADE_LAYER,'visibility','visible');
    map.easeTo?.({pitch:0,bearing:0,duration:450});
    map.redraw?.();
  }
  return next;
}

export class TerrainModeControl {
  constructor({initialMode='hillshade'}={}){
    this.mode=initialMode==='3d'?'3d':'hillshade';
    this.busy=false;
  }

  onAdd(map){
    this.map=map;
    const container=document.createElement('div');
    container.className='maplibregl-ctrl maplibregl-ctrl-group terrain-mode-control';

    const button=document.createElement('button');
    button.type='button';
    button.className='terrain-mode-button';
    button.innerHTML=mountainIcon();
    button.addEventListener('click',this.handleClick=async()=>{
      if(this.busy) return;
      this.busy=true;
      button.disabled=true;
      const requested=this.mode==='hillshade'?'3d':'hillshade';
      try{
        this.mode=await applyTerrainMode(this.map,requested);
      }catch(error){
        console.error('terrain mode switch failed',error);
        this.mode='hillshade';
        button.title=error?.message||'Не удалось включить 3D-рельеф';
      }finally{
        this.busy=false;
        button.disabled=false;
        this.syncButton();
      }
    });

    container.appendChild(button);
    this.container=container;
    this.button=button;
    this.syncButton();
    return container;
  }

  syncButton(){
    if(!this.button) return;
    const is3d=this.mode==='3d';
    this.button.title=is3d?'Переключить на тени рельефа':'Переключить на 3D-рельеф';
    this.button.setAttribute('aria-label',this.button.title);
    this.button.setAttribute('aria-pressed',String(is3d));
    this.button.dataset.mode=this.mode;
  }

  onRemove(){
    if(this.button&&this.handleClick) this.button.removeEventListener('click',this.handleClick);
    this.container?.remove();
    this.map=null;
    this.container=null;
    this.button=null;
  }
}
