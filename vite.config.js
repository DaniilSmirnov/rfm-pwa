import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const root=resolve(import.meta.dirname);
const meta=JSON.parse(readFileSync(resolve(root,'version.json'),'utf8'));
const version=String(meta.version||'').trim();
const codename=String(meta.codename||'').trim();
const versionCache=version.replace(/\D/g,'');
const codenameSlug=codename.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

const replacements=new Map([
  ['__APP_VERSION__',version],
  ['__APP_CODENAME__',codename],
  ['__APP_VERSION_CACHE__',versionCache],
  ['__APP_CODENAME_SLUG__',codenameSlug]
]);

export default defineConfig({
  publicDir:'.vite-public',
  build:{
    outDir:'dist',
    emptyOutDir:true,
    manifest:true,
    rollupOptions:{
      external:id=>id.startsWith('/vendor/')
    }
  },
  plugins:[{
    name:'rfm-release-metadata',
    transformIndexHtml(html){
      let output=html;
      for(const [token,value] of replacements) output=output.replaceAll(token,value);
      return output;
    }
  }]
});
