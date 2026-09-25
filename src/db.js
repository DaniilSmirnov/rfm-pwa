const DB_NAME = 'rallyfans-offline';
const PACKAGE_STORE = 'packages';
const TILE_STORE = 'maptiles';
const VERSION = 3;
const CREW_SUBSCRIPTION_STORE = 'crewSubscriptions';
const OPFS_TILE_ROOT = 'rfm-maptiles';
let opfsRootPromise=null;
const opfsRaceDirs=new Map();
const opfsTileDirs=new Map();

function clearOpfsHandleCache(raceId=null){
  if(raceId==null){
    opfsRootPromise=null;
    opfsRaceDirs.clear();
    opfsTileDirs.clear();
    return;
  }
  const prefix=`${safeRaceId(raceId)}:`;
  opfsRaceDirs.delete(String(raceId));
  for(const key of [...opfsTileDirs.keys()]) if(key.startsWith(prefix)) opfsTileDirs.delete(key);
}

export function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PACKAGE_STORE)) db.createObjectStore(PACKAGE_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(TILE_STORE)) {
        const s=db.createObjectStore(TILE_STORE,{keyPath:'key'});
        s.createIndex('raceId','raceId',{unique:false});
      }
      if (!db.objectStoreNames.contains(CREW_SUBSCRIPTION_STORE)) {
        const s=db.createObjectStore(CREW_SUBSCRIPTION_STORE,{keyPath:'key'});
        s.createIndex('asmgRaceId','asmgRaceId',{unique:false});
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(name, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, mode);
    const store = tx.objectStore(name);
    let result;
    try { result=fn(store); } catch(e) { reject(e); return; }
    tx.oncomplete = () => resolve(result?.result ?? result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });
}

export const savePackage = pkg => withStore(PACKAGE_STORE,'readwrite',s=>s.put(pkg));
export const deleteAllPackages = () => withStore(PACKAGE_STORE,'readwrite',s=>s.clear());
export const getAllPackages = () => withStore(PACKAGE_STORE,'readonly',s=>s.getAll());
export const getPackage = id => withStore(PACKAGE_STORE,'readonly',s=>s.get(id));
export const getCrewSubscriptions = () => withStore(CREW_SUBSCRIPTION_STORE,'readonly',s=>s.getAll());
export const saveCrewSubscription = subscription => withStore(CREW_SUBSCRIPTION_STORE,'readwrite',s=>s.put(subscription));
export const deleteCrewSubscription = key => withStore(CREW_SUBSCRIPTION_STORE,'readwrite',s=>s.delete(key));
export const deleteAllCrewSubscriptions = () => withStore(CREW_SUBSCRIPTION_STORE,'readwrite',s=>s.clear());

export function tileKey(raceId,z,x,y){ return `${raceId}:${z}:${x}:${y}`; }
const legacySaveMapTile = (raceId,z,x,y,data) => withStore(TILE_STORE,'readwrite',s=>s.put({key:tileKey(raceId,z,x,y),raceId:String(raceId),z,x,y,data,bytes:data?.byteLength||0}));
const legacyGetMapTile = (raceId,z,x,y) => withStore(TILE_STORE,'readonly',s=>s.get(tileKey(raceId,z,x,y)));

function opfsSupported(){ return Boolean(navigator.storage?.getDirectory); }
function safeRaceId(value){ return encodeURIComponent(String(value)).replace(/%/g,'_'); }
async function opfsTileRoot(create=true){
  if(!opfsSupported()) return null;
  if(opfsRootPromise) return opfsRootPromise;
  const load=async()=>{
    const root=await navigator.storage.getDirectory();
    return root.getDirectoryHandle(OPFS_TILE_ROOT,{create});
  };
  opfsRootPromise=load().catch(error=>{opfsRootPromise=null;throw error;});
  return opfsRootPromise;
}
async function opfsRaceDir(raceId,create=true){
  const key=String(raceId);
  if(opfsRaceDirs.has(key)) return opfsRaceDirs.get(key);
  const load=async()=>{
    const root=await opfsTileRoot(create);
    if(!root) return null;
    return root.getDirectoryHandle(safeRaceId(raceId),{create});
  };
  const promise=load().catch(error=>{opfsRaceDirs.delete(key);throw error;});
  opfsRaceDirs.set(key,promise);
  return promise;
}
async function opfsTileDir(raceId,z,x,create=true){
  const key=`${safeRaceId(raceId)}:${z}:${x}`;
  if(opfsTileDirs.has(key)) return opfsTileDirs.get(key);
  const load=async()=>{
    let dir=await opfsRaceDir(raceId,create);
    if(!dir) return null;
    dir=await dir.getDirectoryHandle(String(z),{create});
    dir=await dir.getDirectoryHandle(String(x),{create});
    return dir;
  };
  const promise=load().catch(error=>{opfsTileDirs.delete(key);throw error;});
  opfsTileDirs.set(key,promise);
  return promise;
}
async function writeOpfsTile(raceId,z,x,y,data){
  const dir=await opfsTileDir(raceId,z,x,true);
  const handle=await dir.getFileHandle(`${y}.pbf`,{create:true});
  const writable=await handle.createWritable();
  await writable.write(data);
  await writable.close();
}
async function readOpfsTile(raceId,z,x,y){
  try{
    const dir=await opfsTileDir(raceId,z,x,false);
    const handle=await dir.getFileHandle(`${y}.pbf`);
    const file=await handle.getFile();
    return {key:tileKey(raceId,z,x,y),raceId:String(raceId),z,x,y,data:await file.arrayBuffer(),bytes:file.size,storage:'opfs'};
  }catch(e){
    if(e?.name==='NotFoundError') return null;
    throw e;
  }
}

export async function saveMapTile(raceId,z,x,y,data){
  if(opfsSupported()){
    try{ await writeOpfsTile(raceId,z,x,y,data); return; }
    catch(e){ console.warn('OPFS tile write failed, falling back to IndexedDB',e); }
  }
  return legacySaveMapTile(raceId,z,x,y,data);
}
export async function getMapTile(raceId,z,x,y){
  if(opfsSupported()){
    try{
      const tile=await readOpfsTile(raceId,z,x,y);
      if(tile) return tile;
    }catch(e){ console.warn('OPFS tile read failed, trying IndexedDB',e); }
  }
  return legacyGetMapTile(raceId,z,x,y);
}

async function deleteLegacyMapTiles(raceId){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(TILE_STORE,'readwrite'); const s=tx.objectStore(TILE_STORE); const idx=s.index('raceId');
    const req=idx.openCursor(IDBKeyRange.only(String(raceId)));
    req.onsuccess=()=>{const c=req.result;if(c){c.delete();c.continue();}};
    tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error);
  });
}
export async function deleteMapTiles(raceId){
  if(opfsSupported()){
    try{
      const root=await opfsTileRoot(false);
      await root.removeEntry(safeRaceId(raceId),{recursive:true});
      clearOpfsHandleCache(raceId);
    }catch(e){ if(e?.name!=='NotFoundError') console.warn('Could not clear OPFS race tiles',e); }
  }
  await deleteLegacyMapTiles(raceId);
}
export async function clearMapTiles(){
  if(opfsSupported()){
    try{
      const root=await navigator.storage.getDirectory();
      await root.removeEntry(OPFS_TILE_ROOT,{recursive:true});
      clearOpfsHandleCache();
    }catch(e){ if(e?.name!=='NotFoundError') console.warn('Could not clear OPFS tiles',e); }
  }
  return withStore(TILE_STORE,'readwrite',s=>s.clear());
}
async function getLegacyMapStorageStats(){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(TILE_STORE,'readonly'); const req=tx.objectStore(TILE_STORE).getAll();
    req.onsuccess=()=>{const a=req.result||[];resolve({count:a.length,bytes:a.reduce((n,t)=>n+(t.bytes||t.data?.byteLength||0),0)});};
    req.onerror=()=>reject(req.error);
  });
}
async function getOpfsMapStorageStats(){
  if(!opfsSupported()) return {count:0,bytes:0};
  let root;
  try{ root=await opfsTileRoot(false); }catch(e){ if(e?.name==='NotFoundError') return {count:0,bytes:0}; throw e; }
  let count=0,bytes=0;
  async function walk(dir){
    for await(const handle of dir.values()){
      if(handle.kind==='directory') await walk(handle);
      else {
        const file=await handle.getFile();
        count++; bytes+=file.size;
      }
    }
  }
  await walk(root);
  return {count,bytes};
}
export async function getDeepMapStorageStats(){
  const [opfs,legacy]=await Promise.all([
    getOpfsMapStorageStats().catch(()=>({count:0,bytes:0})),
    getLegacyMapStorageStats()
  ]);
  return {
    count:opfs.count+legacy.count,
    bytes:opfs.bytes+legacy.bytes,
    opfsCount:opfs.count,
    opfsBytes:opfs.bytes,
    legacyCount:legacy.count,
    legacyBytes:legacy.bytes,
    source:'scan'
  };
}

export async function getMapStorageStats(){
  const packages=await getAllPackages();
  const maps=packages.map(pkg=>pkg?.offlineMap).filter(map=>map?.ready);
  const terrains=packages.map(pkg=>pkg?.terrain).filter(terrain=>terrain?.ready);
  return {
    count:[...maps,...terrains].reduce((sum,item)=>sum+(Number(item.tileCount)||0),0),
    bytes:[...maps,...terrains].reduce((sum,item)=>sum+(Number(item.bytes)||0),0),
    mapCount:maps.length,
    terrainCount:terrains.length,
    terrainBytes:terrains.reduce((sum,item)=>sum+(Number(item.bytes)||0),0),
    source:'metadata'
  };
}
