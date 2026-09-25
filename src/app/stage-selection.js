import { renderSchedule } from './schedule-ui.js';
import { buildStageDescriptors, findStageDescriptorByFeature } from './schedule.js';
import { renderStagePanel } from './stage-panel.js';
import { showRouteElevationProfile } from './elevation-ui.js';
import { selectStageOnMap, clearStageOnMap } from '../map.js';

export function createStageSelection(){
  let selectedStageKey=null;
  let pkg=null;
  let terrain=null;
  let descriptors=[];

  const scheduleOptions=()=>({
    selectedStageKey,
    onStageSelect:(stageKey,meta)=>select(stageKey,meta)
  });

  async function select(stageKey,{source='map'}={}){
    const stage=descriptors.find(item=>item.key===stageKey);
    if(!stage) return false;
    selectedStageKey=stage.key;
    selectStageOnMap(stage,{fit:source==='schedule'});
    await renderStagePanel(stage,terrain);
    if(pkg) renderSchedule(pkg,scheduleOptions());
    if(source==='schedule') document.querySelector('.map-card')?.scrollIntoView({behavior:'smooth',block:'start'});
    return true;
  }

  async function selectRoute(route){
    const feature=route?.feature || (route?.geometry?{
      type:'Feature',
      properties:route.properties||{},
      geometry:route.geometry
    }:null);
    const stage=findStageDescriptorByFeature(descriptors,feature);
    if(stage) return select(stage.key,{source:'map'});
    return showRouteElevationProfile(terrain,route);
  }

  async function clear(){
    selectedStageKey=null;
    clearStageOnMap();
    await renderStagePanel(null,terrain);
    if(pkg) renderSchedule(pkg,scheduleOptions());
  }

  async function setPackage(nextPkg,nextTerrain){
    pkg=nextPkg||null;
    terrain=nextTerrain||null;
    descriptors=buildStageDescriptors(pkg);
    selectedStageKey=null;
    clearStageOnMap();
    await renderStagePanel(null,terrain);
  }

  return {
    get key(){return selectedStageKey;},
    get descriptors(){return descriptors;},
    scheduleOptions,
    select,
    selectRoute,
    clear,
    setPackage
  };
}
