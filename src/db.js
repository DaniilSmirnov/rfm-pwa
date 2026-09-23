const DB_NAME = 'rallyfans-offline';
const PACKAGE_STORE = 'packages';
const TILE_STORE = 'maptiles';
const VERSION = 2;

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

export function tileKey(raceId,z,x,y){ return `${raceId}:${z}:${x}:${y}`; }
export const saveMapTile = (raceId,z,x,y,data) => withStore(TILE_STORE,'readwrite',s=>s.put({key:tileKey(raceId,z,x,y),raceId:String(raceId),z,x,y,data,bytes:data?.byteLength||0}));
export const getMapTile = (raceId,z,x,y) => withStore(TILE_STORE,'readonly',s=>s.get(tileKey(raceId,z,x,y)));
export async function deleteMapTiles(raceId){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(TILE_STORE,'readwrite'); const s=tx.objectStore(TILE_STORE); const idx=s.index('raceId');
    const req=idx.openCursor(IDBKeyRange.only(String(raceId)));
    req.onsuccess=()=>{const c=req.result;if(c){c.delete();c.continue();}};
    tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error);
  });
}
export async function clearMapTiles(){ return withStore(TILE_STORE,'readwrite',s=>s.clear()); }
export async function getMapStorageStats(){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(TILE_STORE,'readonly'); const req=tx.objectStore(TILE_STORE).getAll();
    req.onsuccess=()=>{const a=req.result||[];resolve({count:a.length,bytes:a.reduce((n,t)=>n+(t.bytes||t.data?.byteLength||0),0)});};
    req.onerror=()=>reject(req.error);
  });
}
