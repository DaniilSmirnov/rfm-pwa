// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTerrainControls } from '../../src/app/terrain-controls.js';

function mount(){
  document.body.innerHTML=`
    <button id="downloadTerrainBtn"></button>
    <button id="downloadTerrainBtnTop"></button>
    <button id="deleteTerrainBtn"></button>
    <button id="deleteTerrainBtnTop"></button>
    <span id="terrainStatus"></span>
    <span id="terrainStatusTop"></span>
  `;
}

function fixture(overrides={}){
  const pkg={id:'race-1',geojson:{type:'FeatureCollection',features:[]}};
  const saved={...pkg};
  const deps={
    getCurrentPackageId:()=>pkg.id,
    getPackage:vi.fn(async()=>saved),
    savePackage:vi.fn(async value=>Object.assign(saved,value)),
    downloadTerrain:vi.fn(async(_pkg,onProgress)=>{
      onProgress({done:2,total:2,saved:2,bytes:4096,failed:0});
      return {ready:true,storageId:'race-1@terrain@new',tileCount:2,bytes:4096,minZoom:6,maxZoom:12};
    }),
    removeTerrain:vi.fn(async()=>{}),
    discardTerrainRevision:vi.fn(async()=>{}),
    buildTerrainDownloadPlan:vi.fn(()=>({tiles:[{},{}],minZoom:6,maxZoom:12})),
    formatBytes:n=>`${n}B`,
    onPackageChanged:vi.fn(async()=>{}),
    ...overrides
  };
  return {pkg,saved,deps,controls:createTerrainControls(deps)};
}

describe('terrain controls',()=>{
  beforeEach(()=>{
    mount();
    vi.stubGlobal('alert',vi.fn());
  });

  it('shows a separate terrain download action before DEM exists',()=>{
    const {pkg,controls}=fixture();
    controls.update(pkg);
    expect(document.querySelector('#downloadTerrainBtn').textContent).toBe('Рельеф карты');
    expect(document.querySelector('#terrainStatus').textContent).toMatch(/может занимать много места/i);
    expect(document.querySelector('#deleteTerrainBtn').hidden).toBe(true);
  });

  it('does not download until the user confirms the large download warning',async()=>{
    vi.stubGlobal('confirm',vi.fn(()=>false));
    const {controls,deps}=fixture();
    await controls.download();
    expect(confirm).toHaveBeenCalledOnce();
    expect(deps.downloadTerrain).not.toHaveBeenCalled();
  });

  it('commits a confirmed terrain revision independently',async()=>{
    vi.stubGlobal('confirm',vi.fn(()=>true));
    const {controls,deps,saved}=fixture();
    await controls.download();
    expect(deps.downloadTerrain).toHaveBeenCalledOnce();
    expect(saved.terrain?.ready).toBe(true);
    expect(deps.savePackage).toHaveBeenCalled();
    expect(deps.onPackageChanged).toHaveBeenCalledWith('race-1');
  });

  it('removes terrain without deleting the rally package',async()=>{
    vi.stubGlobal('confirm',vi.fn(()=>true));
    const {controls,deps,saved}=fixture();
    saved.terrain={ready:true,storageId:'race-1@terrain@old'};
    await controls.remove();
    expect(deps.removeTerrain).toHaveBeenCalledWith(expect.objectContaining({id:'race-1'}));
    expect(saved.terrain).toBeUndefined();
    expect(deps.savePackage).toHaveBeenCalled();
  });
});
