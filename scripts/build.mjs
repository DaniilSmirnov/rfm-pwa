import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build as viteBuild } from 'vite';

const root=resolve(import.meta.dirname,'..');
const dist=resolve(root,'dist');
const publicDir=resolve(root,'.vite-public');
const meta=JSON.parse(await readFile(resolve(root,'version.json'),'utf8'));
const version=String(meta.version||'').trim();
const codename=String(meta.codename||'').trim();
if(!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('version.json must contain a semver version');
if(!codename) throw new Error('version.json must contain a codename');

const versionCache=version.replace(/\D/g,'');
const codenameSlug=codename.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const replacements=new Map([
  ['__APP_VERSION__',version],
  ['__APP_CODENAME__',codename],
  ['__APP_VERSION_CACHE__',versionCache],
  ['__APP_CODENAME_SLUG__',codenameSlug]
]);

async function replaceTokens(target){
  let text=await readFile(target,'utf8');
  for(const [token,value] of replacements) text=text.replaceAll(token,value);
  await writeFile(target,text);
}

async function stagePublicFiles(){
  await rm(publicDir,{recursive:true,force:true});
  await mkdir(publicDir,{recursive:true});

  for(const entry of ['manifest.webmanifest','icon.svg','assets']){
    await cp(resolve(root,entry),resolve(publicDir,entry),{recursive:true});
  }

  await cp(resolve(root,'_worker.js'),resolve(publicDir,'_worker.js'));
  await mkdir(resolve(publicDir,'src'),{recursive:true});
  await cp(resolve(root,'src/worker'),resolve(publicDir,'src/worker'),{recursive:true});

  await mkdir(resolve(publicDir,'vendor/maplibre-gl'),{recursive:true});
  await cp(resolve(root,'node_modules/maplibre-gl/dist'),resolve(publicDir,'vendor/maplibre-gl'),{recursive:true});
  await mkdir(resolve(publicDir,'vendor/pmtiles'),{recursive:true});
  await cp(resolve(root,'node_modules/pmtiles/dist/pmtiles.js'),resolve(publicDir,'vendor/pmtiles/pmtiles.js'));
}

async function listFiles(dir,prefix=''){
  const entries=await readdir(dir,{withFileTypes:true});
  const files=[];
  for(const entry of entries){
    const path=prefix ? `${prefix}/${entry.name}` : entry.name;
    if(entry.isDirectory()) files.push(...await listFiles(resolve(dir,entry.name),path));
    else files.push(path);
  }
  return files;
}

function shouldPrecache(path){
  if(path==='sw.js' || path==='_worker.js' || path==='version.json') return false;
  if(path.startsWith('.vite/') || path.startsWith('src/worker/')) return false;
  if(path.endsWith('.map')) return false;
  return true;
}

await stagePublicFiles();

try{
  await viteBuild({configFile:resolve(root,'vite.config.js')});

  await replaceTokens(resolve(dist,'manifest.webmanifest'));
  await replaceTokens(resolve(dist,'_worker.js'));
  await writeFile(resolve(dist,'version.json'),JSON.stringify({version,codename},null,2)+'\n');

  const outputFiles=await listFiles(dist);
  const shell=['/',...outputFiles.filter(shouldPrecache).map(path=>`/${path}`)];
  const uniqueShell=[...new Set(shell)].sort();

  let sw=await readFile(resolve(root,'sw.js'),'utf8');
  for(const [token,value] of replacements) sw=sw.replaceAll(token,value);
  const shellPlaceholder='/*__BUILD_ASSETS__*/[]';
  if(!sw.includes(shellPlaceholder)) throw new Error('sw.js must contain the build asset placeholder');
  sw=sw.replace(shellPlaceholder,JSON.stringify(uniqueShell));
  await writeFile(resolve(dist,'sw.js'),sw);

  await rm(resolve(dist,'.vite'),{recursive:true,force:true});

  console.log(`Built Rally Fans Map ${version} · ${codename} with Vite`);
  console.log(`Service Worker precache: ${uniqueShell.length} files`);
  console.log('Production artifact: dist/');
}finally{
  await rm(publicDir,{recursive:true,force:true});
}
