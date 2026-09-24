function mountainIcon(){
  return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2.5 19.5 9 8.5l3 4.8 2.4-3.6 7.1 9.8H2.5Zm3.4-2h11.7l-3.1-4.3-2.6 3.8L9.1 12l-3.2 5.5Z" fill="currentColor"/></svg>';
}

export class TerrainModeControl {
  constructor({initialMode='hillshade',onModeChange=()=>{}}={}){
    this.mode=initialMode==='3d'?'3d':'hillshade';
    this.onModeChange=onModeChange;
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
      const next=this.mode==='hillshade'?'3d':'hillshade';
      try{
        await this.onModeChange(next,map);
        this.mode=next;
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
