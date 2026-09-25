function sampleIndices(length){
  if(!length) return [];
  return [...new Set([0,Math.floor((length-1)/2),length-1])];
}

export async function inspectOfflineRevisionSamples(packages,{
  getTile,buildMapPlan,buildTerrainPlan,limit=12
}){
  const revisions=packages.flatMap(pkg=>[
    {pkg,kind:'map',meta:pkg?.offlineMap,buildPlan:buildMapPlan},
    {pkg,kind:'terrain',meta:pkg?.terrain,buildPlan:buildTerrainPlan}
  ]).filter(item=>item.meta?.ready&&item.meta.storageId);
  const inspected=await Promise.all(revisions.slice(0,limit).map(async item=>{
    const name=item.pkg.name||item.pkg.id;
    try{
      const plan=item.buildPlan(item.pkg.geojson);
      const indices=sampleIndices(plan.tiles.length);
      const samples=await Promise.all(indices.map(async index=>{
        const tile=plan.tiles[index];
        const saved=await getTile(item.meta.storageId,tile.z,tile.x,tile.y);
        const present=Boolean((saved?.data?.byteLength??saved?.data?.size??0)>0);
        return {z:tile.z,x:tile.x,y:tile.y,present};
      }));
      return {package:name,kind:item.kind,storageId:item.meta.storageId,checked:samples.length,missing:samples.filter(sample=>!sample.present).length,samples};
    }catch(error){
      return {package:name,kind:item.kind,storageId:item.meta.storageId,checked:0,missing:0,error:String(error?.message||error)};
    }
  }));
  return {checkedRevisions:inspected.length,omittedRevisions:Math.max(0,revisions.length-inspected.length),samples:inspected};
}
