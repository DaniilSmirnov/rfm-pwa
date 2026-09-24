import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=resolve(import.meta.dirname,'..');
const dist=resolve(root,'dist');
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

const entries=['index.html','manifest.webmanifest','sw.js','_worker.js','icon.svg','assets','src'];

await rm(dist,{recursive:true,force:true});
await mkdir(dist,{recursive:true});

for(const entry of entries) await cp(resolve(root,entry),resolve(dist,entry),{recursive:true});

await mkdir(resolve(dist,'vendor/maplibre-gl'),{recursive:true});
await cp(resolve(root,'node_modules/maplibre-gl/dist'),resolve(dist,'vendor/maplibre-gl'),{recursive:true});
await mkdir(resolve(dist,'vendor/pmtiles'),{recursive:true});
await cp(resolve(root,'node_modules/pmtiles/dist/pmtiles.js'),resolve(dist,'vendor/pmtiles/pmtiles.js'));

for(const file of ['index.html','manifest.webmanifest','sw.js','_worker.js']){
  const target=resolve(dist,file);
  let text=await readFile(target,'utf8');
  for(const [token,value] of replacements) text=text.replaceAll(token,value);
  await writeFile(target,text);
}

await writeFile(resolve(dist,'version.json'),JSON.stringify({version,codename},null,2)+'\n');

console.log(`Built Rally Fans Map ${version} · ${codename}`);
console.log('Production artifact: dist/');
