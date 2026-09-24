// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderMap } from '../../src/map.js';

class FakeMap {
  static last=null;
  constructor(options){
    this.options=options;
    this.handlers=new Map();
    this.sources=new Map();
    this.layers=[];
    this.controls=[];
    this.zoom=10;
    FakeMap.last=this;
  }
  on(event,...args){
    const handler=args.at(-1);
    const key=args.length===1?event:`${event}:${args[0]}`;
    this.handlers.set(key,handler);
    return this;
  }
  addControl(control){this.controls.push(control);}
  addSource(id,source){this.sources.set(id,source);}
  addLayer(layer){this.layers.push(layer);}
  fitBounds(){this.didFit=true;}
  getZoom(){return this.zoom;}
  getCenter(){return {lng:30.69,lat:61.7};}
  getBearing(){return 0;}
  getCanvas(){return {style:{}};}
  getStyle(){return {layers:this.options.style.layers||[]};}
  getLayer(id){return this.layers.find(layer=>layer.id===id)||null;}
  queryRenderedFeatures(){return [];}
  remove(){}
}

class FakeMarker {
  static instances=[];
  constructor({element}){this.element=element;FakeMarker.instances.push(this);}
  setLngLat(value){this.lngLat=value;return this;}
  addTo(){return this;}
  remove(){}
  getElement(){return this.element;}
}

class FakePopup {
  setLngLat(){return this;}
  setHTML(){return this;}
  addTo(){return this;}
}

const fc={
  type:'FeatureCollection',
  features:[
    {
      type:'Feature',
      properties:{kind:'race-point',name:'Offline point'},
      geometry:{type:'Point',coordinates:[30.69,61.7]}
    },
    {
      type:'Feature',
      properties:{kind:'race-route',name:'SS1'},
      geometry:{type:'LineString',coordinates:[[30.68,61.69],[30.70,61.71]]}
    }
  ]
};

afterEach(()=>{
  delete window.maplibregl;
  FakeMap.last=null;
  FakeMarker.instances=[];
  vi.restoreAllMocks();
});

function installMapLibre(){
  window.maplibregl={
    Map:FakeMap,
    Marker:FakeMarker,
    Popup:FakePopup,
    NavigationControl:class {},
    addProtocol:vi.fn()
  };
}

describe('offline map overlay bootstrap',()=>{
  it('installs race points and routes on style.load instead of waiting for remote/offline source load',()=>{
    installMapLibre();
    const container=document.createElement('div');

    renderMap(container,fc,null,vi.fn(),{
      offlineMap:{
        ready:true,
        raceId:'race-1@map',
        storageId:'race-1@map',
        minZoom:6,
        maxZoom:14,
        bounds:{minLon:30.5,minLat:61.5,maxLon:30.9,maxLat:61.9},
        vectorLayers:[{id:'roads'}]
      }
    });

    const map=FakeMap.last;
    expect(map.handlers.has('style.load')).toBe(true);
    expect(map.sources.has('rfm-points')).toBe(false);

    map.handlers.get('style.load')();

    expect(map.sources.get('rfm-points')?.type).toBe('geojson');
    expect(map.sources.get('rfm-lines')?.type).toBe('geojson');
    expect(map.layers.some(layer=>layer.id==='rfm-points')).toBe(true);
    expect(map.layers.some(layer=>layer.id==='rfm-lines')).toBe(true);
    expect(map.didFit).toBe(true);
  });


  it('keeps offline race points and route layers visible across the full zoom range',()=>{
    installMapLibre();
    const container=document.createElement('div');

    renderMap(container,fc,null,vi.fn(),{
      offlineMap:{
        ready:true,
        raceId:'race-1@map',
        storageId:'race-1@map',
        minZoom:6,
        maxZoom:14,
        bounds:{minLon:30.5,minLat:61.5,maxLon:30.9,maxLat:61.9},
        vectorLayers:[{id:'roads'}]
      }
    });

    const map=FakeMap.last;
    map.zoom=6;
    map.handlers.get('style.load')();

    const pointLayer=map.layers.find(layer=>layer.id==='rfm-points');
    const routeLayer=map.layers.find(layer=>layer.id==='rfm-lines');
    const routeCasing=map.layers.find(layer=>layer.id==='rfm-lines-casing');

    expect(pointLayer).toMatchObject({minzoom:0,maxzoom:24});
    expect(routeLayer).toMatchObject({minzoom:0,maxzoom:24});
    expect(routeCasing).toMatchObject({minzoom:0,maxzoom:24});
    expect(map.sources.get('rfm-lines')?.data.features).toHaveLength(1);
    expect(map.sources.get('rfm-lines')?.data.features[0].properties.name).toBe('SS1');

    const raceLabel=FakeMarker.instances.find(marker=>marker.getElement().classList.contains('map-race-label'))?.getElement();
    expect(raceLabel).toBeTruthy();
    expect(raceLabel.style.display).toBe('block');

    map.zoom=18;
    map.handlers.get('zoom')();
    expect(raceLabel.style.display).toBe('block');
  });

  it('keeps race overlays above terrain when an offline terrain style is enabled',()=>{
    installMapLibre();
    const container=document.createElement('div');

    renderMap(container,fc,null,vi.fn(),{
      offlineMap:{
        ready:true,
        raceId:'race-1@map',
        minZoom:6,
        maxZoom:14,
        bounds:{minLon:30.5,minLat:61.5,maxLon:30.9,maxLat:61.9},
        vectorLayers:[{id:'roads'}]
      },
      terrain:{
        ready:true,
        storageId:'race-1@terrain',
        minZoom:6,
        maxZoom:12,
        tileSize:512,
        encoding:'terrarium',
        bounds:{minLon:30.5,minLat:61.5,maxLon:30.9,maxLat:61.9}
      }
    });

    const map=FakeMap.last;
    expect(map.options.style.sources['offline-base']).toBeTruthy();
    expect(map.options.style.sources['offline-terrain-hillshade']).toBeTruthy();
    expect(map.options.style.layers.some(layer=>layer.id==='terrain-hillshade')).toBe(true);

    map.handlers.get('style.load')();

    expect(map.layers.some(layer=>layer.id==='rfm-points')).toBe(true);
    expect(map.layers.some(layer=>layer.id==='rfm-lines')).toBe(true);
  });
});
