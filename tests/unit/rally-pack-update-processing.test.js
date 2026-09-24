import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PERIODIC_CACHE,
  RACE_ASSET_CACHE,
  processCachedRallyPackUpdates
} from '../../src/app/rally-pack-update.js';
import { assetUrl, raceDetailToPackage } from '../../src/rallyfans.js';

const originalCaches=globalThis.caches;

function race(overrides={}){
  return {
    id:1,
    name:'Rally Test',
    category_race:'regional',
    status_race:'planned',
    date_race:'26.09.2026',
    city_race_details:'Sortavala',
    coordinates:[{id:1,name:'Point',coordinates:'61.700,30.690',image:'a.jpg'}],
    schedule:[{id:10,location:'SS1',date:'26.09.2026 10:00',events:[]}],
    results:[],
    lists:[],
    how_it_was:'',
    ...overrides
  };
}

function savedPackage(sourceRace=race()){
  return {
    ...raceDetailToPackage(sourceRace),
    savedAt:'2026-09-20T00:00:00.000Z',
    offlineMap:{ready:true,storageId:'map-old'},
    terrain:{ready:true,storageId:'terrain-old'}
  };
}

function responseJson(value){
  return new Response(JSON.stringify(value),{
    status:200,
    headers:{'content-type':'application/json'}
  });
}

function installCaches({freshRace,readyAssets=[]}){
  const periodic={
    match:vi.fn(async request=>{
      const url=typeof request==='string'?request:request?.url;
      return url==='/api/rallyfans/race/1' ? responseJson(freshRace) : undefined;
    })
  };
  const assets={
    match:vi.fn(async request=>readyAssets.includes(String(request)) ? new Response('ok',{status:200}) : undefined)
  };
  globalThis.caches={
    open:vi.fn(async name=>{
      if(name===PERIODIC_CACHE) return periodic;
      if(name===RACE_ASSET_CACHE) return assets;
      throw new Error('unexpected cache '+name);
    })
  };
  return {periodic,assets};
}

afterEach(()=>{
  if(originalCaches===undefined) delete globalThis.caches;
  else globalThis.caches=originalCaches;
  vi.restoreAllMocks();
});

describe('cached Rally Pack update processing',()=>{
  it('applies a compatible cached update only after all referenced assets are ready',async()=>{
    const current=savedPackage();
    const fresh=race({
      status_race:'updated',
      schedule:[{id:10,location:'SS1',date:'26.09.2026 10:30',events:[]}],
      safety_leaflet:'safety.pdf'
    });
    installCaches({
      freshRace:fresh,
      readyAssets:['a.jpg','safety.pdf'].map(assetUrl)
    });
    const savePackage=vi.fn(async()=>{});
    const scheduleRaceReminders=vi.fn(async()=>{});

    const result=await processCachedRallyPackUpdates({
      getAllPackages:async()=>[current],
      savePackage,
      scheduleRaceReminders
    });

    expect(result).toEqual({checked:1,applied:1,pending:0});
    expect(savePackage).toHaveBeenCalledOnce();
    const next=savePackage.mock.calls[0][0];
    expect(next.summary.status).toBe('updated');
    expect(next.offlineMap).toEqual(current.offlineMap);
    expect(next.terrain).toEqual(current.terrain);
    expect(next.savedAt).toBe(current.savedAt);
    expect(next.pendingUpdate).toBeNull();
    expect(next.lastSmartUpdate.changes.map(change=>change.key)).toEqual(expect.arrayContaining(['schedule','materials','info']));
    expect(scheduleRaceReminders).toHaveBeenCalledWith(next);
  });

  it('keeps the current package and marks an update pending when a new asset is missing',async()=>{
    const current=savedPackage();
    const fresh=race({safety_leaflet:'new-safety.pdf'});
    installCaches({
      freshRace:fresh,
      readyAssets:[assetUrl('a.jpg')]
    });
    const savePackage=vi.fn(async()=>{});

    const result=await processCachedRallyPackUpdates({
      getAllPackages:async()=>[current],
      savePackage,
      scheduleRaceReminders:vi.fn()
    });

    expect(result).toEqual({checked:1,applied:0,pending:1});
    const next=savePackage.mock.calls[0][0];
    expect(next.offlineMap).toEqual(current.offlineMap);
    expect(next.terrain).toEqual(current.terrain);
    expect(next.pendingUpdate.reason).toBe('assets');
    expect(next.pendingUpdate.changes.map(change=>change.key)).toContain('materials');
  });

  it('does not auto-apply an update that changes race geometry',async()=>{
    const current=savedPackage();
    const fresh=race({
      coordinates:[{id:1,name:'Point',coordinates:'61.710,30.700',image:'a.jpg'}]
    });
    installCaches({freshRace:fresh,readyAssets:[assetUrl('a.jpg')]});
    const savePackage=vi.fn(async()=>{});
    const scheduleRaceReminders=vi.fn(async()=>{});

    const result=await processCachedRallyPackUpdates({
      getAllPackages:async()=>[current],
      savePackage,
      scheduleRaceReminders
    });

    expect(result).toEqual({checked:1,applied:0,pending:1});
    expect(savePackage.mock.calls[0][0].pendingUpdate.reason).toBe('geometry');
    expect(scheduleRaceReminders).not.toHaveBeenCalled();
  });

  it('does not rewrite an unchanged saved package',async()=>{
    const source=race();
    const current=savedPackage(source);
    installCaches({freshRace:source,readyAssets:[assetUrl('a.jpg')]});
    const savePackage=vi.fn(async()=>{});

    const result=await processCachedRallyPackUpdates({
      getAllPackages:async()=>[current],
      savePackage
    });

    expect(result).toEqual({checked:1,applied:0,pending:0});
    expect(savePackage).not.toHaveBeenCalled();
  });

  it('ignores a corrupted cached race response without damaging saved data',async()=>{
    const current=savedPackage();
    const periodic={match:vi.fn(async()=>new Response('{bad json',{status:200}))};
    globalThis.caches={
      open:vi.fn(async name=>name===PERIODIC_CACHE?periodic:{match:vi.fn()})
    };
    const savePackage=vi.fn(async()=>{});

    const result=await processCachedRallyPackUpdates({
      getAllPackages:async()=>[current],
      savePackage
    });

    expect(result).toEqual({checked:1,applied:0,pending:0});
    expect(savePackage).not.toHaveBeenCalled();
  });
});
