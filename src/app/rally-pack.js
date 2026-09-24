export const RALLY_PACK_PHASES=Object.freeze({
  RACE:'race',
  YANDEX:'yandex',
  MAP:'map',
  ASSETS:'assets',
  SAVE:'save',
  REMINDERS:'reminders',
  CLEANUP:'cleanup',
  DONE:'done'
});

function report(onProgress,phase,detail={}){
  onProgress({phase,...detail});
}

function assertDeps(deps){
  for(const name of ['fetchRace','raceDetailToPackage','getPackage','enrichPackageWithYandex','downloadOfflineMap','cacheRaceAssets','savePackage']){
    if(typeof deps?.[name]!=='function') throw new Error(`Rally Pack dependency missing: ${name}`);
  }
}

export async function downloadRallyPack(raceId,deps,onProgress=()=>{}){
  assertDeps(deps);
  let stagedMap=null;
  let previousMap=null;
  let pkg=null;

  try{
    report(onProgress,RALLY_PACK_PHASES.RACE,{raceId});
    const race=await deps.fetchRace(raceId);
    pkg=deps.raceDetailToPackage(race);

    const previous=await deps.getPackage(pkg.id);
    previousMap=previous?.offlineMap?.ready ? previous.offlineMap : null;
    if(previous?.terrain?.ready) pkg.terrain=previous.terrain;

    if(pkg.yandexMapEmbed){
      report(onProgress,RALLY_PACK_PHASES.YANDEX);
      const enriched=await deps.enrichPackageWithYandex(pkg);
      pkg=enriched.pkg;
    }

    report(onProgress,RALLY_PACK_PHASES.MAP,{status:'start'});
    stagedMap=await deps.downloadOfflineMap(pkg,progress=>{
      report(onProgress,RALLY_PACK_PHASES.MAP,{status:'progress',...progress});
    });
    pkg.offlineMap=stagedMap;

    let assetDownload={cached:0,total:0,background:false};
    if((pkg.assetNames||[]).length){
      report(onProgress,RALLY_PACK_PHASES.ASSETS,{status:'start',total:pkg.assetNames.length});
      assetDownload=await deps.cacheRaceAssets(pkg,(done,total,meta={})=>{
        report(onProgress,RALLY_PACK_PHASES.ASSETS,{status:'progress',done,total,...meta});
      });
      if(!assetDownload.background && assetDownload.cached<assetDownload.total){
        throw new Error(`Не удалось скачать все материалы: ${assetDownload.cached} из ${assetDownload.total}`);
      }
    }

    report(onProgress,RALLY_PACK_PHASES.SAVE);
    await deps.savePackage(pkg);

    if(typeof deps.scheduleRaceReminders==='function'){
      report(onProgress,RALLY_PACK_PHASES.REMINDERS);
      try{ await deps.scheduleRaceReminders(pkg); }
      catch(error){ deps.onOptionalError?.('reminders',error); }
    }

    if(previousMap && previousMap.storageId!==stagedMap.storageId && typeof deps.discardOfflineMapRevision==='function'){
      report(onProgress,RALLY_PACK_PHASES.CLEANUP);
      try{ await deps.discardOfflineMapRevision(previousMap,pkg.id); }
      catch(error){ deps.onOptionalError?.('old-map-cleanup',error); }
    }

    report(onProgress,RALLY_PACK_PHASES.DONE,{assetDownload});
    return {pkg,assetDownload};
  }catch(error){
    if(stagedMap && typeof deps.discardOfflineMapRevision==='function'){
      try{ await deps.discardOfflineMapRevision(stagedMap); }
      catch(cleanupError){ deps.onOptionalError?.('staged-map-cleanup',cleanupError); }
    }
    throw error;
  }
}
