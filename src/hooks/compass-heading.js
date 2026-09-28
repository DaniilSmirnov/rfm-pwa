let heading=null;
const listeners=new Set();
export function getCompassHeading(){return heading;}
export function subscribeCompassHeading(listener){listeners.add(listener);return()=>listeners.delete(listener);}
export function publishCompassHeading(value){
  if(!Number.isFinite(value)||value===heading)return;
  heading=value;
  for(const listener of listeners)listener();
}
