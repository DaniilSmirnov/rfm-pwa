import { offlineTerrainSource, registerTerrainProtocol } from '../terrain-offline.js';

export function terrainStyleParts(meta){
  const source=offlineTerrainSource(meta);
  if(!source) return {sources:{},layers:[]};

  registerTerrainProtocol();
  return {
    sources:{
      'offline-terrain-hillshade':source,
      'offline-terrain-3d':{...source}
    },
    layers:[{
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
