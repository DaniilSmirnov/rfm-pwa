export function toRad(v){return v*Math.PI/180;}
export function toDeg(v){return v*180/Math.PI;}
export function distanceMeters(a,b){
  const R=6371000,dLat=toRad(b.lat-a.lat),dLon=toRad(b.lon-a.lon),lat1=toRad(a.lat),lat2=toRad(b.lat);
  const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}
export function bearingDegrees(a,b){
  const lat1=toRad(a.lat),lat2=toRad(b.lat),dLon=toRad(b.lon-a.lon);
  const y=Math.sin(dLon)*Math.cos(lat2);
  const x=Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLon);
  return (toDeg(Math.atan2(y,x))+360)%360;
}
export function formatDistance(m){if(!Number.isFinite(m))return '—';return m<1000?`${Math.round(m)} м`:`${(m/1000).toFixed(m<10000?1:0)} км`;}
export function compassDirection(deg){const dirs=['N','NE','E','SE','S','SW','W','NW'];return dirs[Math.round((((deg%360)+360)%360)/45)%8];}
