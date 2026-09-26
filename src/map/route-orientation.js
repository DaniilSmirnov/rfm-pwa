import { distanceMeters } from '../app/geo.js';
import { parseCoordinatePair, pointCoordinate, stageFeatureScore } from '../app/schedule.js';

const point=c=>({lon:c[0],lat:c[1]});
const gap=(a,b)=>distanceMeters(point(a),point(b));
const valid=c=>Array.isArray(c)&&Number.isFinite(c[0])&&Number.isFinite(c[1]);

export function orientStageRoute(feature,features=[],stage=null){
  const geometry=feature?.geometry;
  const source=geometry?.type==='LineString'?[geometry.coordinates]
    :geometry?.type==='MultiLineString'?geometry.coordinates:[];
  const remaining=source.filter(line=>Array.isArray(line)&&line.length>1&&line.every(valid))
    .map(line=>line.slice());
  if(!remaining.length) return geometry;
  // Join multipart lines at their nearest ends, reversing individual parts as
  // needed. Distances across gaps are never included in the route chainage.
  const lines=[remaining.shift()];
  while(remaining.length){
    let best=null;
    remaining.forEach((line,index)=>{
      const first=lines[0][0],last=lines.at(-1).at(-1);
      for(const option of [
        {prepend:false,reverse:false,d:gap(last,line[0])},
        {prepend:false,reverse:true,d:gap(last,line.at(-1))},
        {prepend:true,reverse:false,d:gap(first,line.at(-1))},
        {prepend:true,reverse:true,d:gap(first,line[0])}
      ]) if(!best||option.d<best.d) best={...option,index};
    });
    const [line]=remaining.splice(best.index,1);
    if(best.reverse) line.reverse();
    if(best.prepend) lines.unshift(line); else lines.push(line);
  }
  const first=point(lines[0][0]),last=point(lines.at(-1).at(-1));
  const props=feature.properties||{};
  const identity=stage||{name:props['name:ru']||props.name_ru||props.name||props.title||props.caption||'',key:''};
  const anchors={start:[],finish:[]};
  for(const candidate of features){
    const coordinate=pointCoordinate(candidate);
    if(!coordinate) continue;
    const text=Object.values(candidate.properties||{}).filter(v=>typeof v==='string').join(' ');
    const isStart=/старт|\bstart\b/i.test(text),isFinish=/финиш|\bfinish\b/i.test(text);
    if(isStart===isFinish) continue;
    const distance=Math.min(distanceMeters(first,coordinate),distanceMeters(last,coordinate));
    if(distance>250) continue;
    // Prefer a matching stage name, then the closest endpoint marker.
    const score=identity.name?stageFeatureScore({geometry,properties:candidate.properties},identity):-1;
    anchors[isStart?'start':'finish'].push({coordinate,score,distance});
  }
  const pick=kind=>anchors[kind].sort((a,b)=>b.score-a.score||a.distance-b.distance)[0]?.coordinate;
  const start=pick('start')||parseCoordinatePair(stage?.scheduleItems?.[0]?.coordinates);
  const finish=pick('finish');
  const forward=(start?distanceMeters(first,start):0)+(finish?distanceMeters(last,finish):0);
  const backward=(start?distanceMeters(last,start):0)+(finish?distanceMeters(first,finish):0);
  if(backward<forward){lines.reverse();lines.forEach(line=>line.reverse());}
  return geometry.type==='LineString'?{...geometry,coordinates:lines[0]}:{...geometry,coordinates:lines};
}
