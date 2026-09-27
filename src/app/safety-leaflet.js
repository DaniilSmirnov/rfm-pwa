import { assetUrl } from '../rallyfans.js';

export function safetyLeafletValue(pkg){
  const value=pkg?.original?.safety_leaflet??pkg?.safety_leaflet;
  return typeof value==='string'&&value.trim()?value.trim():null;
}

export function safetyLeafletUrl(value){
  const source=String(value||'').trim();
  if(!source)return null;
  if(/^(https?:|data:|blob:)/i.test(source))return source;
  if(source.startsWith('/api/rallyfans/public/'))return source;
  if(source.startsWith('/public/'))return `/api/rallyfans${source}`;
  return assetUrl(source.replace(/^\.\//,''));
}
