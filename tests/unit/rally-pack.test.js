import { describe, expect, it, vi } from 'vitest';
import { downloadRallyPack, RALLY_PACK_PHASES } from '../../src/app/rally-pack.js';

function fixture(overrides={}){
  const oldMap={ready:true,storageId:'race-7@old'};
  const pkg={id:'race-7',raceId:7,name:'Demo',assetNames:['a.jpg','b.jpg'],yandexMapEmbed:'https://yandex.test'};
  const stagedMap={ready:true,storageId:'race-7@new',tileCount:42};
  const deps={
    fetchRace:vi.fn(async()=>({id:7,name:'Demo'})),
    raceDetailToPackage:vi.fn(()=>structuredClone(pkg)),
    getPackage:vi.fn(async()=>({id:'race-7',offlineMap:oldMap})),
    enrichPackageWithYandex:vi.fn(async p=>({pkg:{...p,yandexImport:{featureCount:3}},imported:3})),
    downloadOfflineMap:vi.fn(async(_p,onProgress)=>{onProgress({done:42,total:42,bytes:1024});return stagedMap;}),
    cacheRaceAssets:vi.fn(async(_p,onProgress)=>{onProgress(2,2,{background:false});return {cached:2,total:2,background:false};}),
    savePackage:vi.fn(async()=>{}),
    scheduleRaceReminders:vi.fn(async()=>({stored:2})),
    discardOfflineMapRevision:vi.fn(async()=>{}),
    onOptionalError:vi.fn(),
    ...overrides
  };
  return {deps,pkg,oldMap,stagedMap};
}

describe('downloadRallyPack',()=>{
  it('downloads data, Yandex, basemap and assets before committing the package',async()=>{
    const {deps,stagedMap,oldMap}=fixture();
    const phases=[];
    const result=await downloadRallyPack(7,deps,event=>phases.push(event.phase));

    expect(result.pkg.offlineMap).toEqual(stagedMap);
    expect(deps.savePackage).toHaveBeenCalledOnce();
    expect(deps.savePackage.mock.calls[0][0].yandexImport.featureCount).toBe(3);
    expect(deps.discardOfflineMapRevision).toHaveBeenCalledWith(oldMap,'race-7');
    expect(phases).toEqual(expect.arrayContaining([
      RALLY_PACK_PHASES.RACE,
      RALLY_PACK_PHASES.YANDEX,
      RALLY_PACK_PHASES.MAP,
      RALLY_PACK_PHASES.ASSETS,
      RALLY_PACK_PHASES.SAVE,
      RALLY_PACK_PHASES.DONE
    ]));

    const saveOrder=deps.savePackage.mock.invocationCallOrder[0];
    expect(deps.downloadOfflineMap.mock.invocationCallOrder[0]).toBeLessThan(saveOrder);
    expect(deps.cacheRaceAssets.mock.invocationCallOrder[0]).toBeLessThan(saveOrder);
  });

  it('keeps the previous package and removes staged map when the pack fails',async()=>{
    const {deps,stagedMap}=fixture({
      cacheRaceAssets:vi.fn(async()=>({cached:1,total:2,background:false}))
    });

    await expect(downloadRallyPack(7,deps)).rejects.toThrow('1 из 2');
    expect(deps.savePackage).not.toHaveBeenCalled();
    expect(deps.discardOfflineMapRevision).toHaveBeenCalledWith(stagedMap);
  });

  it('does not require Yandex when a race has no constructor map',async()=>{
    const {deps}=fixture({
      raceDetailToPackage:vi.fn(()=>({id:'race-7',raceId:7,name:'Demo',assetNames:[],yandexMapEmbed:null}))
    });

    await downloadRallyPack(7,deps);
    expect(deps.enrichPackageWithYandex).not.toHaveBeenCalled();
    expect(deps.cacheRaceAssets).not.toHaveBeenCalled();
    expect(deps.savePackage).toHaveBeenCalledOnce();
  });

  it('does not fail a completed pack when reminder scheduling fails',async()=>{
    const optional=vi.fn();
    const {deps}=fixture({
      scheduleRaceReminders:vi.fn(async()=>{throw new Error('push unavailable');}),
      onOptionalError:optional
    });

    await expect(downloadRallyPack(7,deps)).resolves.toBeTruthy();
    expect(optional).toHaveBeenCalledWith('reminders',expect.any(Error));
    expect(deps.savePackage).toHaveBeenCalledOnce();
  });

  it('accepts browser background asset fetch as an in-progress material download',async()=>{
    const {deps}=fixture({
      cacheRaceAssets:vi.fn(async()=>({cached:0,total:2,background:true,id:'bg-1'}))
    });

    const result=await downloadRallyPack(7,deps);
    expect(result.assetDownload.background).toBe(true);
    expect(deps.savePackage).toHaveBeenCalledOnce();
  });
});
