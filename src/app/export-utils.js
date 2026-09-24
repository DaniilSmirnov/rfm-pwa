export function xmlEsc(value=''){return String(value).replace(/[<>&"']/g,ch=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[ch]));}
export function safeFileName(value='rally'){return String(value).trim().toLowerCase().replace(/[^a-zа-яё0-9_-]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,80)||'rally';}
export function geoJsonToGpx(fc,name='Rally Fans Map'){
  const waypoints=[],tracks=[];
  const addTrack=(coords,label)=>{
    if(!Array.isArray(coords)||coords.length<2)return;
    const pts=coords.filter(c=>Array.isArray(c)&&Number.isFinite(Number(c[0]))&&Number.isFinite(Number(c[1]))).map(c=>`<trkpt lat="${Number(c[1])}" lon="${Number(c[0])}"></trkpt>`).join('');
    if(pts)tracks.push(`<trk><name>${xmlEsc(label)}</name><trkseg>${pts}</trkseg></trk>`);
  };
  for(const feature of fc?.features||[]){
    const g=feature?.geometry||{},props=feature?.properties||{},label=String(props.name||props.title||props.location||'Rally Fans Map');
    if(g.type==='Point'&&Array.isArray(g.coordinates)){const [lon,lat]=g.coordinates.map(Number);if(Number.isFinite(lat)&&Number.isFinite(lon))waypoints.push(`<wpt lat="${lat}" lon="${lon}"><name>${xmlEsc(label)}</name></wpt>`);}
    else if(g.type==='LineString')addTrack(g.coordinates,label);
    else if(g.type==='MultiLineString')g.coordinates?.forEach((line,i)=>addTrack(line,`${label} ${i+1}`));
    else if(g.type==='Polygon')g.coordinates?.forEach((ring,i)=>addTrack(ring,`${label} ${i+1}`));
    else if(g.type==='MultiPolygon')g.coordinates?.forEach((poly,pi)=>poly?.forEach((ring,ri)=>addTrack(ring,`${label} ${pi+1}.${ri+1}`)));
  }
  return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Rally Fans Map Offline" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>${xmlEsc(name)}</name></metadata>${waypoints.join('')}${tracks.join('')}</gpx>`;
}
