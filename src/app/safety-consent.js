const PREFIX='rfm:safety-accepted:v1:';

export function safetyConsentKey(pkg){
  const race=String(pkg?.raceId??pkg?.original?.id??pkg?.id??'general');
  const leaflet=String(pkg?.original?.safety_leaflet||'general').trim();
  return `${PREFIX}${encodeURIComponent(race)}:${encodeURIComponent(leaflet)}`;
}

export function hasSafetyConsent(pkg,storage=globalThis.localStorage){
  try{return storage?.getItem(safetyConsentKey(pkg))==='accepted';}catch{return false;}
}

export function saveSafetyConsent(pkg,storage=globalThis.localStorage){
  try{storage?.setItem(safetyConsentKey(pkg),'accepted');return true;}catch{return false;}
}
