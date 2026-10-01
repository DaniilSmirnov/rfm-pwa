// Preserve source semantics: an unclassified point stays a generic location.
export function pointMarkerKind(properties = {}, name = '') {
  const description = `${properties.kind || ''} ${properties.type || ''} ${name}`;
  if (/parking|парков|стоянк/i.test(description)) return 'parking';
  if (/communication|radio|радио|связ/i.test(description)) return 'communication';
  if (/passport|паспорт|id[-_ ]?card|identity/i.test(description)) return 'passport';
  if (/finish|финиш/i.test(description)) return 'finish';
  if (/start|старт/i.test(description)) return 'start';
  if (/closure|закрыт|перекрыт/i.test(description)) return 'closure';
  const normalizedName = String(name).trim().toLowerCase();
  if (
    /spectator|viewpoint|зрител|смотров|трамплин|вылет|машинопад/i.test(description) ||
    normalizedName === '90'
  )
    return 'spectator';
  return 'location';
}

export function pointWithMarkerIcon(feature) {
  if (!feature || feature.geometry?.type !== 'Point') return feature;
  const properties = feature.properties || {};
  const name =
    properties['name:ru'] ||
    properties.name_ru ||
    properties.name ||
    properties.title ||
    properties.caption ||
    '';
  return {
    ...feature,
    properties: {
      ...properties,
      markerIcon: properties.markerIcon || pointMarkerKind(properties, name),
    },
  };
}

export function createPointMarkerContent(element, name, markerIcon = 'location') {
  element.setAttribute('aria-label', name);
  element.dataset.pointIcon = markerIcon;

  const label = document.createElement('span');
  label.className = 'map-point-label';
  label.textContent = name;
  element.append(label);
}
