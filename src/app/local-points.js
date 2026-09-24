import { normalizePoint } from '../navigation.js';

export const FAVORITES_KEY='rfm-favorite-points-v1';
export const CAR_POINT_KEY='rfm-car-point-v1';

export function pointKey(point){
  const p=normalizePoint(point);
  return `${p.lat.toFixed(6)}:${p.lon.toFixed(6)}:${p.name}`;
}

export function loadFavoritesStore(){
  try{
    const value=JSON.parse(localStorage.getItem(FAVORITES_KEY)||'{}');
    return value&&typeof value==='object'?value:{};
  }catch{
    return {};
  }
}

export function favoritesForPackage(packageId){
  const store=loadFavoritesStore();
  return Array.isArray(store[String(packageId||'')])?store[String(packageId||'')]:[];
}

export function isFavoritePoint(point,packageId){
  if(!point||!packageId) return false;
  const key=pointKey(point);
  return favoritesForPackage(packageId).some(p=>p.key===key);
}

export function setFavoritePoint(point,enabled,packageId){
  if(!point||!packageId) return;
  const store=loadFavoritesStore();
  const id=String(packageId);
  const normalized=normalizePoint(point);
  const key=pointKey(normalized);
  const list=Array.isArray(store[id])?store[id].filter(p=>p?.key!==key):[];
  if(enabled) list.push({key,...normalized,savedAt:new Date().toISOString()});
  if(list.length) store[id]=list;
  else delete store[id];
  localStorage.setItem(FAVORITES_KEY,JSON.stringify(store));
}

export function loadCarPoint(){
  try{
    const value=JSON.parse(localStorage.getItem(CAR_POINT_KEY)||'null');
    return value&&Number.isFinite(Number(value.lat))&&Number.isFinite(Number(value.lon))?value:null;
  }catch{
    return null;
  }
}

export function saveCarPoint(point){
  const normalized=normalizePoint(point);
  const value={...normalized,name:'Машина',savedAt:new Date().toISOString()};
  localStorage.setItem(CAR_POINT_KEY,JSON.stringify(value));
  return value;
}

export function deleteCarPoint(){
  localStorage.removeItem(CAR_POINT_KEY);
}
