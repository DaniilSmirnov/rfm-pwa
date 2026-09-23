export function normalizePoint(point) {
  const lat = Number(point?.lat ?? point?.latitude);
  const lon = Number(point?.lon ?? point?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('Invalid coordinates');
  return { lat, lon, name: String(point?.name || point?.title || 'Точка RallyFansMap') };
}

export function googleMapsDirections(point) {
  const {lat,lon}=normalizePoint(point);
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lon}`)}&travelmode=driving`;
}

export function googleMapsPoint(point) {
  const {lat,lon}=normalizePoint(point);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lon}`)}`;
}

export function yandexNavigatorLink(point) {
  const {lat,lon}=normalizePoint(point);
  return `yandexnavi://build_route_on_map?lat_to=${encodeURIComponent(lat)}&lon_to=${encodeURIComponent(lon)}`;
}

export function yandexWebFallback(point) {
  const {lat,lon}=normalizePoint(point);
  return `https://yandex.ru/maps/?pt=${encodeURIComponent(`${lon},${lat}`)}&z=15&l=map`;
}

export function mapsMeLink(point) {
  const {lat,lon,name}=normalizePoint(point);
  return `mapsme://map?v=1&ll=${encodeURIComponent(`${lat},${lon}`)}&n=${encodeURIComponent(name)}`;
}

export function mapsMeWebFallback() {
  return 'https://maps.me/';
}

export function coordinateText(point) {
  const {lat,lon}=normalizePoint(point);
  return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}

export function openCustomSchemeWithFallback(primary, fallback, delay=900) {
  const startedAt = Date.now();
  let timer;
  const cancel = () => { if (timer) clearTimeout(timer); timer=null; };
  const onVisibility = () => { if (document.hidden) cancel(); };
  document.addEventListener('visibilitychange', onVisibility, {once:true});
  window.location.href = primary;
  timer = setTimeout(() => {
    document.removeEventListener('visibilitychange', onVisibility);
    if (!document.hidden && Date.now()-startedAt >= delay-100) window.location.href = fallback;
  }, delay);
}
