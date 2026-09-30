// Preserve source semantics: an unclassified point stays a generic location.
export function pointMarkerKind(properties = {}, name = '') {
  const description = `${properties.kind || ''} ${properties.type || ''} ${name}`;
  if (/parking|парков|стоянк/i.test(description)) return 'parking';
  if (/communication|radio|радио|связ/i.test(description)) return 'communication';
  if (/passport|паспорт|id[-_ ]?card|identity/i.test(description)) return 'passport';
  if (/finish|финиш/i.test(description)) return 'finish';
  if (/start|старт/i.test(description)) return 'start';
  if (/closure|закрыт|перекрыт/i.test(description)) return 'closure';
  if (/spectator|viewpoint|зрител|смотров|трамплин/i.test(description)) return 'spectator';
  return 'location';
}

export function createPointMarkerContent(element, name, kind) {
  element.setAttribute('aria-label', name);
  const icon = document.createElement('span');
  icon.className = `map-point-symbol is-${kind}`;
  icon.setAttribute('aria-hidden', 'true');
  if (kind === 'spectator') {
    const image = document.createElement('img');
    image.src = '/assets/spectator.svg';
    image.alt = '';
    icon.append(image);
  } else if (kind === 'communication') {
    icon.innerHTML =
      '<svg class="map-point-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="m13 2-9 12h8l-1 8 9-12h-8l1-8Z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  } else if (kind === 'passport') {
    icon.innerHTML =
      '<svg class="map-point-svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="11" r="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5.5 16c.7-1.6 1.8-2.4 3-2.4s2.3.8 3 2.4M14 9h4M14 13h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  } else if (kind === 'start') {
    icon.innerHTML =
      '<svg class="map-point-svg map-point-flag-left" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3v18M6 4h11l-3 4 3 4H6" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  } else if (kind === 'finish') {
    icon.innerHTML =
      '<svg class="map-point-svg map-point-finish-flag" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3v18M6 4h11v9H6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 5h3v3H7zm6 0h3v3h-3zm-3 3h3v3h-3zm6 0h1v3h-1z" fill="currentColor"/></svg>';
  } else icon.textContent = { parking: 'P', closure: '!', location: '•' }[kind];
  const label = document.createElement('span');
  label.className = 'map-point-label';
  label.textContent = name;
  element.append(icon, label);
}
