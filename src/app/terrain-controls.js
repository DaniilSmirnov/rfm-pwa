export function createTerrainControls({
  getCurrentPackageId,
  getPackage,
  savePackage,
  downloadTerrain,
  removeTerrain,
  discardTerrainRevision,
  buildTerrainDownloadPlan,
  formatBytes,
  onPackageChanged
}){
  const $=id=>document.getElementById(id);

  function elements(){
    return {
      buttons:[$('downloadTerrainBtn'),$('downloadTerrainBtnTop')].filter(Boolean),
      deletes:[$('deleteTerrainBtn'),$('deleteTerrainBtnTop')].filter(Boolean),
      statuses:[$('terrainStatus'),$('terrainStatusTop')].filter(Boolean)
    };
  }

  function setUi({button,status,deleteHidden,disabled}){
    const els=elements();
    for(const el of els.buttons){ if(button!=null) el.textContent=button; if(disabled!=null) el.disabled=disabled; }
    for(const el of els.statuses){ if(status!=null) el.textContent=status; }
    for(const el of els.deletes){ if(deleteHidden!=null) el.hidden=deleteHidden; }
  }

  function update(pkg){
    if(!pkg){
      setUi({button:'Рельеф карты',status:'Сначала выбери сохранённую гонку.',deleteHidden:true,disabled:true});
      return;
    }
    if(pkg.terrain?.ready){
      setUi({
        button:`Обновить рельеф (${formatBytes(pkg.terrain.bytes||0)})`,
        status:`Рельеф готов · ${pkg.terrain.tileCount||0} DEM-тайлов · ${formatBytes(pkg.terrain.bytes||0)} · z${pkg.terrain.minZoom}–${pkg.terrain.maxZoom}`,
        deleteHidden:false,
        disabled:false
      });
      return;
    }

    let status='Рельеф ещё не скачан.';
    try{
      const plan=buildTerrainDownloadPlan(pkg.geojson);
      status=`Отдельная загрузка DEM: до ${plan.tiles.length} тайлов · z${plan.minZoom}–${plan.maxZoom}. Может занимать много места.`;
    }catch{}
    setUi({button:'Рельеф карты',status,deleteHidden:true,disabled:false});
  }

  async function download(){
    const packageId=getCurrentPackageId();
    if(!packageId) return;
    let pkg=await getPackage(packageId);
    if(!pkg) return;

    let plan;
    try{ plan=buildTerrainDownloadPlan(pkg.geojson); }
    catch(error){ alert(`Не удалось подготовить рельеф: ${error.message}`); return; }

    const accepted=confirm(
      'Рельеф карты скачивается отдельно и может занимать много места на устройстве.\n\n'+
      `Для этой гонки будет загружено до ${plan.tiles.length} DEM-тайлов (z${plan.minZoom}–${plan.maxZoom}). Точный размер зависит от местности.\n\n`+
      'Продолжить загрузку?'
    );
    if(!accepted) return;

    setUi({disabled:true});
    let staged=null;
    const previous=pkg.terrain||null;
    try{
      if(navigator.storage?.persist){ try{ await navigator.storage.persist(); }catch{} }
      staged=await downloadTerrain(pkg,progress=>{
        setUi({
          button:`Рельеф ${progress.done}/${progress.total}`,
          status:`Скачано ${progress.saved} DEM-тайлов · ${formatBytes(progress.bytes)}${progress.failed?` · ошибок ${progress.failed}`:''}`
        });
      });

      pkg.terrain=staged;
      await savePackage(pkg);
      staged=null;

      if(previous?.storageId && previous.storageId!==pkg.terrain.storageId){
        try{ await discardTerrainRevision(previous); }
        catch(error){ console.warn('Could not remove previous terrain revision',error); }
      }
      await onPackageChanged(pkg.id);
    }catch(error){
      if(staged){
        try{ await discardTerrainRevision(staged); }
        catch(cleanupError){ console.warn('Could not remove staged terrain revision',cleanupError); }
      }
      const message=`Не удалось скачать рельеф: ${error.message}`;
      setUi({status:message});
      alert(message);
    }finally{
      pkg=await getPackage(packageId);
      update(pkg);
    }
  }

  async function remove(){
    const packageId=getCurrentPackageId();
    if(!packageId||!confirm('Удалить скачанный рельеф этой гонки? Офлайн-карта и данные гонки останутся.')) return;
    const pkg=await getPackage(packageId);
    if(!pkg) return;
    await removeTerrain(pkg);
    delete pkg.terrain;
    await savePackage(pkg);
    await onPackageChanged(pkg.id);
  }

  for(const id of ['downloadTerrainBtn','downloadTerrainBtnTop']) $(id)?.addEventListener('click',download);
  for(const id of ['deleteTerrainBtn','deleteTerrainBtnTop']) $(id)?.addEventListener('click',remove);

  return {update};
}
