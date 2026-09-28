import React,{useMemo} from 'react';

const SIZE={width:1000,height:620,pad:58};
function positions(geometry){
  if(!geometry)return [];
  const out=[];
  const visit=value=>{
    if(Array.isArray(value)&&value.length>=2&&Number.isFinite(Number(value[0]))&&Number.isFinite(Number(value[1])))out.push([Number(value[0]),Number(value[1])]);
    else if(Array.isArray(value))value.forEach(visit);
  };
  visit(geometry.coordinates);
  return out;
}
function pathFor(coords,project,close=false){return `${coords.map((coord,index)=>`${index?'L':'M'}${project(coord).join(' ')}`).join(' ')}${close?' Z':''}`;}
function boundsFor(features,userPos){
  const coords=features.flatMap(feature=>positions(feature.geometry));
  if(userPos&&Number.isFinite(userPos.longitude)&&Number.isFinite(userPos.latitude))coords.push([userPos.longitude,userPos.latitude]);
  if(!coords.length)return null;
  let minLon=Math.min(...coords.map(item=>item[0])),maxLon=Math.max(...coords.map(item=>item[0]));
  let minLat=Math.min(...coords.map(item=>item[1])),maxLat=Math.max(...coords.map(item=>item[1]));
  const dx=Math.max(maxLon-minLon,.002),dy=Math.max(maxLat-minLat,.002);
  minLon-=dx*.08;maxLon+=dx*.08;minLat-=dy*.08;maxLat+=dy*.08;
  return {minLon,maxLon,minLat,maxLat};
}
function featurePaths(geometry,project){
  if(!geometry)return [];
  const rings=[];
  const collect=value=>{
    if(Array.isArray(value)&&value.length&&Array.isArray(value[0])&&typeof value[0][0]==='number')rings.push(value);
    else if(Array.isArray(value))value.forEach(collect);
  };
  collect(geometry.coordinates);
  return rings.map((ring,index)=>({d:pathFor(ring,project,['Polygon','MultiPolygon'].includes(geometry.type)),close:['Polygon','MultiPolygon'].includes(geometry.type),key:index}));
}
export default function FallbackMap({geojson,userPos,onPointClick}){
  const model=useMemo(()=>{
    const features=geojson?.features||[];const bounds=boundsFor(features,userPos);
    if(!bounds)return {bounds:null,shapes:[],points:[],grid:[]};
    const {width,height,pad}=SIZE,dx=bounds.maxLon-bounds.minLon,dy=bounds.maxLat-bounds.minLat;
    const project=([lon,lat])=>[+(pad+(lon-bounds.minLon)/dx*(width-pad*2)).toFixed(2),+(height-pad-(lat-bounds.minLat)/dy*(height-pad*2)).toFixed(2)];
    const shapes=features.filter(f=>f.geometry?.type!=='Point').flatMap((feature,index)=>featurePaths(feature.geometry,project).map(path=>({feature,path,index,color:feature.properties?.color||(String(feature.properties?.kind||'').startsWith('yandex-')?'#ffd21e':'#e63b2e')})));
    const points=features.filter(f=>f.geometry?.type==='Point').map((feature,index)=>({feature,index,xy:project(feature.geometry.coordinates),label:String(feature.properties?.name||feature.properties?.title||'Точка'),yandex:String(feature.properties?.kind||'').startsWith('yandex-')}));
    const grid=[];
    for(let i=0;i<=4;i++)grid.push({key:`x${i}`,x:pad+(width-pad*2)*i/4,y:pad,vertical:true,label:`${(bounds.minLon+dx*i/4).toFixed(3)}°`},{key:`y${i}`,x:pad,y:pad+(height-pad*2)*i/4,vertical:false,label:`${(bounds.maxLat-dy*i/4).toFixed(3)}°`});
    return {bounds,shapes,points,grid,project};
  },[geojson,userPos]);
  if(!model.bounds)return <div className="empty">В этом пакете не найдено геометрии.<br/>Данные всё равно сохранены офлайн.</div>;
  return <svg viewBox="0 0 1000 620" role="img" aria-label="Офлайн-карта ралли"><rect width="100%" height="100%" fill="#0f1217"/>
    {model.grid.map(line=><g key={line.key}>{line.vertical?<><path d={`M${line.x} 58V562`} stroke="#1c222b" strokeWidth="2"/><text x={line.x+4} y="604" fill="#6f7a89" fontSize="13">{line.label}</text></>:<><path d={`M58 ${line.y}H942`} stroke="#1c222b" strokeWidth="2"/><text x="10" y={line.y-5} fill="#6f7a89" fontSize="13">{line.label}</text></>}</g>)}
    {model.shapes.map(({feature,path,index,color})=><path key={`${index}-${path.key}`} d={path.d} fill={path.close?color:'none'} fillOpacity={path.close?.12:undefined} stroke={color} strokeWidth={path.close?3:5} strokeLinecap="round" strokeLinejoin="round"><title>{feature.properties?.name||feature.properties?.title||'Участок'}</title></path>)}
    {model.points.map(({feature,index,xy,label,yandex})=><g key={index} className="map-point" tabIndex="0" role="button" aria-label={label} onClick={()=>onPointClick?.({lat:Number(feature.geometry.coordinates[1]),lon:Number(feature.geometry.coordinates[0]),name:label})} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onPointClick?.({lat:Number(feature.geometry.coordinates[1]),lon:Number(feature.geometry.coordinates[0]),name:label});}}}><circle cx={xy[0]} cy={xy[1]} r={yandex?8:9} fill={yandex?'#ffd21e':'#f3f5f7'} stroke="#111318" strokeWidth="4"><title>{label}</title></circle></g>)}
    {userPos&&Number.isFinite(userPos.longitude)&&Number.isFinite(userPos.latitude)&&(()=>{const [x,y]=model.project([userPos.longitude,userPos.latitude]);return <g><circle cx={x} cy={y} r="18" fill="#4da3ff" opacity=".25"/><circle cx={x} cy={y} r="8" fill="#4da3ff" stroke="#fff" strokeWidth="3"><title>Моё положение</title></circle></g>;})()}
  </svg>;
}
