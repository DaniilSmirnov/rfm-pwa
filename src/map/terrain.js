import { offlineTerrainSource, registerTerrainProtocol } from '../terrain-offline.js';

export function terrainStyleParts(meta,mode='hillshade'){
  const source=offlineTerrainSource(meta);
  if(!source) return {sources:{},layers:[],terrain:null};

  registerTerrainProtocol();
  const is3d=mode==='3d';
  return {
    sources:{
      'offline-terrain-hillshade':source,
      'offline-terrain-3d':{...source}
    },
    terrain:is3d?{source:'offline-terrain-3d',exaggeration:1.35}:null,
    layers:is3d?[]:[{
      id:'terrain-hillshade',
      type:'hillshade',
      source:'offline-terrain-hillshade',
      paint:{
        'hillshade-exaggeration':0.42,
        'hillshade-shadow-color':'#473b24',
        'hillshade-highlight-color':'#ffffff',
        'hillshade-accent-color':'#6f6654'
      }
    }]
  };
}
