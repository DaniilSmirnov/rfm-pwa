import { elevationAt, elevationProfile } from './elevation.js';

export async function pointElevationText(meta,point){
  if(!meta?.ready)return 'Высота недоступна: рельеф не скачан.';
  try{
    const value=await elevationAt(meta,point);
    return Number.isFinite(value)?`Высота: ${Math.round(value)} м`:'Высота для этой точки недоступна.';
  }catch(error){return `Высота недоступна: ${error.message}`;}
}

export async function routeElevationData(meta,route){
  if(!meta?.ready)return {state:'unavailable',message:'Скачай рельеф, чтобы построить профиль высот.'};
  if(!route?.geometry)return {state:'unavailable',message:'Для этой линии недостаточно данных высоты.'};
  try{
    const profile=await elevationProfile(meta,route.geometry);
    return profile.points.length<2
      ?{state:'unavailable',message:'Для этой линии недостаточно данных высоты.'}
      :{state:'ready',profile};
  }catch(error){return {state:'error',message:`Не удалось построить профиль: ${error.message}`};}
}
