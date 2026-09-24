import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=resolve(import.meta.dirname,'..');
const meta=JSON.parse(await readFile(resolve(root,'version.json'),'utf8'));
if(!/^\d+\.\d+\.\d+$/.test(String(meta.version||''))) throw new Error('Invalid version.json version');
if(!String(meta.codename||'').trim()) throw new Error('Invalid version.json codename');

const expectations={
  'index.html':['__APP_VERSION__','__APP_CODENAME__'],
  'sw.js':['__APP_VERSION_CACHE__','__APP_CODENAME_SLUG__'],
  '_worker.js':['__APP_VERSION__'],
  'manifest.webmanifest':['__APP_VERSION_CACHE__']
};
for(const [file,tokens] of Object.entries(expectations)){
  const text=await readFile(resolve(root,file),'utf8');
  for(const token of tokens){
    if(!text.includes(token)) throw new Error(`${file} must use ${token} instead of a hard-coded release value`);
  }
}
console.log(`Release metadata OK: ${meta.version} · ${meta.codename}`);
