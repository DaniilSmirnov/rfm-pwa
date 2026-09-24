import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=resolve(import.meta.dirname,'..');
const dist=resolve(root,'dist');

const entries=[
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  '_worker.js',
  'icon.svg',
  'assets',
  'src'
];

await rm(dist,{recursive:true,force:true});
await mkdir(dist,{recursive:true});

for(const entry of entries){
  await cp(resolve(root,entry),resolve(dist,entry),{recursive:true});
}

console.log('Built dist/ with production allowlist:');
for(const entry of entries) console.log(` - ${entry}`);
