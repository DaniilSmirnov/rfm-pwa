import { useCallback, useEffect, useState } from 'react';
import { savePackage } from '../db.js';
import { downloadOfflineMap, removeOfflineMap, discardOfflineMapRevision } from '../offline-map.js';
import { downloadTerrain, removeTerrain, discardTerrainRevision, buildTerrainDownloadPlan } from '../terrain-offline.js';
import { replaceOfflineRevision } from '../app/offline-revision.js';
import { formatBytes } from '../app/format.js';

export function useOfflineStorageControls({currentPackage,setCurrentPackage,refreshPackages}){
  const [mapProgress,setMapProgress]=useState(null);
  const [mapError,setMapError]=useState(null);
  const [terrainProgress,setTerrainProgress]=useState(null);

  useEffect(()=>setMapError(null),[currentPackage?.id]);
  const clearMapError=useCallback(()=>setMapError(null),[]);

  const downloadMap=useCallback(async()=>{
    if(!currentPackage) return;
    setMapError(null);
    setMapProgress({text:'Подготавливаю карту…',busy:true});
    try{
      if(navigator.storage?.persist) try{await navigator.storage.persist();}catch{}
      const pkg=await replaceOfflineRevision({
        packageData:currentPackage,
        key:'offlineMap',
        download:()=>downloadOfflineMap(currentPackage,p=>{
          setMapProgress({
            text:`Скачано ${p.saved} тайлов · ${formatBytes(p.bytes)}${p.failed?` · ошибок ${p.failed}`:''}`,
            button:`Карта ${p.done}/${p.total}`,busy:true
          });
        },{previousMap:currentPackage.offlineMap||null}),
        savePackage,
        discardRevision:discardOfflineMapRevision
      });
      setCurrentPackage(pkg);await refreshPackages(pkg.id);
    }catch(error){
      setMapError(error);
      alert(`Не удалось скачать карту: ${error.message}`);
    }finally{setMapProgress(null);}
  },[currentPackage,refreshPackages,setCurrentPackage]);

  const deleteMap=useCallback(async()=>{
    if(!currentPackage||!confirm('Удалить офлайн-подложку этой гонки?')) return;
    setMapError(null);
    await removeOfflineMap(currentPackage);
    const pkg={...currentPackage};delete pkg.offlineMap;
    await savePackage(pkg);setCurrentPackage(pkg);await refreshPackages(pkg.id);
  },[currentPackage,refreshPackages,setCurrentPackage]);

  const downloadTerrainForRace=useCallback(async()=>{
    if(!currentPackage) return;
    let plan;
    try{plan=buildTerrainDownloadPlan(currentPackage.geojson);}catch(error){alert(`Не удалось подготовить рельеф: ${error.message}`);return;}
    if(!confirm(`Рельеф карты скачивается отдельно и может занимать много места на устройстве.\n\nДля этой гонки будет загружено до ${plan.tiles.length} DEM-тайлов (z${plan.minZoom}–${plan.maxZoom}).\n\nПродолжить загрузку?`)) return;
    setTerrainProgress({text:'Подготавливаю рельеф…',busy:true});
    try{
      const pkg=await replaceOfflineRevision({
        packageData:currentPackage,
        key:'terrain',
        download:()=>downloadTerrain(currentPackage,p=>setTerrainProgress({
          text:`Скачано ${p.saved} DEM-тайлов · ${formatBytes(p.bytes)}${p.failed?` · ошибок ${p.failed}`:''}`,
          button:`Рельеф ${p.done}/${p.total}`,busy:true
        })),
        savePackage,
        discardRevision:discardTerrainRevision
      });
      setCurrentPackage(pkg);await refreshPackages(pkg.id);
    }catch(error){
      alert(`Не удалось скачать рельеф: ${error.message}`);
    }finally{setTerrainProgress(null);}
  },[currentPackage,refreshPackages,setCurrentPackage]);

  const deleteTerrain=useCallback(async()=>{
    if(!currentPackage||!confirm('Удалить скачанный рельеф этой гонки? Офлайн-карта и данные гонки останутся.')) return;
    await removeTerrain(currentPackage);
    const pkg={...currentPackage};delete pkg.terrain;
    await savePackage(pkg);setCurrentPackage(pkg);await refreshPackages(pkg.id);
  },[currentPackage,refreshPackages,setCurrentPackage]);

  return {mapProgress,mapError,terrainProgress,clearMapError,downloadMap,deleteMap,downloadTerrainForRace,deleteTerrain};
}
