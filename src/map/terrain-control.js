const TERRAIN_SOURCE='offline-terrain-3d';
const HILLSHADE_LAYER='terrain-hillshade';

function mountainIcon(){
  return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2.5 19.5 9 8.5l3 4.8 2.4-3.6 7.1 9.8H2.5Zm3.4-2h11.7l-3.1-4.3-2.6 3.8L9.1 12l-3.2 5.5Z" fill="currentColor"/></svg>';
}

export function applyTerrainMode(map,mode){
  if(!map) return 'hillshade';
  const next=mode==='3d'?'3d':'hillshade';

  if(next==='3d'){
    if(map.getLayer?.(HILLSHADE_LAYER)) map.setLayoutProperty?.(HILLSHADE_LAYER,'visibility','none');
    map.setTerrain?.({source:TERRAIN_SOURCE,exaggeration:1.15});
    map.easeTo?.({pitch:68,bearing:-18,duration:650});
  }else{
    map.setTerrain?.(null);
    if(map.getLayer?.(HILLSHADE_LAYER)) map.setLayoutProperty?.(HILLSHADE_LAYER,'visibility','visible');
    map.easeTo?.({pitch:0,duration:450});
  }
  return next;
}

export class TerrainModeControl {
  constructor({initialMode='hillshade'}={}){
    this.mode=initialMode==='3d'?'3d':'hillshade';
  }

  onAdd(map){
    this.map=map;
    const container=document.createElement('div');
    container.className='maplibregl-ctrl maplibregl-ctrl-group terrain-mode-control';

    const button=document.createElement('button');
    button.type='button';
    button.className='terrain-mode-button';
    button.innerHTML=mountainIcon();
    button.addEventListener('click',this.handleClick=()=>{
      this.mode=applyTerrainMode(this.map,this.mode==='hillshade'?'3d':'hillshade');
      this.syncButton();
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
