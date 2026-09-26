import { distanceMeters } from '../app/geo.js';
import { buildStageDescriptors, findStageDescriptorByFeature } from '../app/schedule.js';
import { orientStageRoute } from './route-orientation.js';

const mercatorY=lat=>Math.log(Math.tan(Math.PI/4+lat*Math.PI/360));
const valid=c=>Array.isArray(c)&&Number.isFinite(c[0])&&Number.isFinite(c[1])&&Math.abs(c[1])<90;

export function routeKilometreMarkers(geometry){
  const lines=geometry?.type==='LineString'?[geometry.coordinates]
    :geometry?.type==='MultiLineString'?geometry.coordinates:[];
  const markers=[];
  let travelled=0,next=1500;
  for(const line of lines){
    for(let i=1;i<(line||[]).length;i++){
      const a=line[i-1],b=line[i];
      if(!valid(a)||!valid(b)) continue;
      const length=distanceMeters({lon:a[0],lat:a[1]},{lon:b[0],lat:b[1]});
      if(!length) continue;
      // A north-facing arrow follows the exact direction of the projected road.
      const dx=(b[0]-a[0])*Math.PI/180,dy=mercatorY(b[1])-mercatorY(a[1]);
      const rotation=Math.atan2(dx,dy)*180/Math.PI;
      while(next<=travelled+length){
        const t=(next-travelled)/length;
        const lat=(2*Math.atan(Math.exp(mercatorY(a[1])+dy*t))-Math.PI/2)*180/Math.PI;
        markers.push({coordinates:[a[0]+(b[0]-a[0])*t,lat],rotation,distance:next});
        next+=1500;
      }
      travelled+=length;
    }
  }
  return markers;
}

export function installRouteDirections(map,maplibregl,collections,pkg={}){
  if(!maplibregl?.Marker) return [];
  const markers=[];
  const stages=buildStageDescriptors(pkg);
  for(const collection of collections){
    for(const feature of collection?.features||[]){
      const props=feature.properties||{};
      const name=props['name:ru']||props.name_ru||props.name||props.title||props.caption||'СУ';
      const stage=findStageDescriptorByFeature(stages,feature);
      const geometry=orientStageRoute(feature,pkg.geojson?.features,stage);
      for(const point of routeKilometreMarkers(geometry)){
        const el=document.createElement('div');
        el.className='map-route-direction';
        el.setAttribute('role','img');
        el.setAttribute('aria-label',`Направление движения: ${name}, ${point.distance/1000} км`);
        markers.push(new maplibregl.Marker({
          element:el,anchor:'center',rotation:point.rotation,
          rotationAlignment:'map',pitchAlignment:'map'
        }).setLngLat(point.coordinates).addTo(map));
      }
    }
  }
  return markers;
}
