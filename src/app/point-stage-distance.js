import { normalizePoint } from '../navigation.js';
import { buildStageDescriptors, distanceAlongStage } from './schedule.js';

export function nearestStageDistance(pkg, point){
  if(!pkg || !point) return null;
  let target;
  try{ target=normalizePoint(point); }catch{ return null; }
  const stages=buildStageDescriptors(pkg);
  // Map routes can exist without schedule entries or use different names.
  for(const feature of pkg.geojson?.features||[]){
    if(!['LineString','MultiLineString'].includes(feature.geometry?.type)) continue;
    if(stages.some(stage=>stage.geometryFeature===feature)) continue;
    const props=feature.properties||{};
    stages.push({
      name:String(props['name:ru']||props.name_ru||props.name||props.title||props.caption||'СУ'),
      geometry:feature.geometry
    });
  }
  return stages.map(stage=>({stage,distance:distanceAlongStage(stage,target)}))
    .filter(item=>item.distance)
    .sort((a,b)=>a.distance.offset-b.distance.offset)[0]||null;
}
