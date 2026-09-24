import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=resolve(import.meta.dirname,'..');
const dist=resolve(root,'dist');

async function exists(path){
  try{ await stat(path); return true; }catch{return false;}
}

function assert(condition,message){
  if(!condition) throw new Error(message);
}

async function walk(dir,prefix=''){
  const entries=await readdir(dir,{withFileTypes:true});
  const files=[];
  for(const entry of entries){
    const path=prefix?`${prefix}/${entry.name}`:entry.name;
    if(entry.isDirectory()) files.push(...await walk(resolve(dir,entry.name),path));
    else files.push(path);
  }
  return files;
}

for(const path of ['index.html','_worker.js','sw.js','version.json','manifest.webmanifest']){
  assert(await exists(resolve(dist,path)),`Missing dist/${path}`);
}
for(const path of ['assets','src/worker','vendor/maplibre-gl']){
  assert(await exists(resolve(dist,path)),`Missing dist/${path}`);
}
assert(await exists(resolve(dist,'vendor/pmtiles/pmtiles.js')),'Missing PMTiles vendor bundle');

for(const path of ['tests','.github','package.json','README.md','samples','.vite','src/app.js']){
  assert(!(await exists(resolve(dist,path))),`Development artifact leaked into dist: ${path}`);
}

const srcEntries=await readdir(resolve(dist,'src'));
assert(srcEntries.length===1 && srcEntries[0]==='worker','dist/src must contain only Cloudflare Worker modules');

const files=await walk(dist);
const clientJs=files.filter(path=>/^assets\/.*\.js$/.test(path));
const clientCss=files.filter(path=>/^assets\/.*\.css$/.test(path));
assert(clientJs.length>0,'Vite did not emit a hashed client JS asset');
assert(clientCss.length>0,'Vite did not emit a hashed client CSS asset');

const index=await readFile(resolve(dist,'index.html'),'utf8');
const sw=await readFile(resolve(dist,'sw.js'),'utf8');
const manifest=await readFile(resolve(dist,'manifest.webmanifest'),'utf8');
const worker=await readFile(resolve(dist,'_worker.js'),'utf8');

assert(/src="\/assets\/[^"]+\.js"/.test(index),'index.html does not reference a Vite JS asset');
assert(!index.includes('/src/app.js'),'index.html still references the unbundled client entrypoint');
assert(!sw.includes('/src/app.js'),'Service Worker still precaches the unbundled client entrypoint');
assert(/\/assets\/[^"'\]]+\.js/.test(sw),'Service Worker precache does not include the Vite JS asset');
assert(/\/assets\/[^"'\]]+\.css/.test(sw),'Service Worker precache does not include the Vite CSS asset');

for(const required of [
  '/vendor/maplibre-gl/maplibre-gl.mjs',
  '/vendor/maplibre-gl/maplibre-gl-worker.mjs',
  '/vendor/maplibre-gl/maplibre-gl-shared.mjs',
  '/vendor/maplibre-gl/maplibre-gl.css',
  '/vendor/pmtiles/pmtiles.js'
]){
  assert(sw.includes(required),`Service Worker precache is missing ${required}`);
}

const unresolved=['__APP_VERSION__','__APP_CODENAME__','__APP_VERSION_CACHE__','__APP_CODENAME_SLUG__','__BUILD_ASSETS__'];
for(const [name,text] of [['index.html',index],['sw.js',sw],['manifest.webmanifest',manifest],['_worker.js',worker]]){
  for(const token of unresolved) assert(!text.includes(token),`${name} contains unresolved token ${token}`);
}

for(const path of ['index.html','sw.js',...clientJs,...clientCss]){
  const text=await readFile(resolve(dist,path),'utf8');
  assert(!text.includes('unpkg.com'),`Production artifact references unpkg.com: ${path}`);
}

console.log(`Vite artifact OK: ${clientJs.length} JS bundle(s), ${clientCss.length} CSS bundle(s), ${files.length} files`);
