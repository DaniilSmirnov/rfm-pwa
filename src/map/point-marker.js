// Preserve source semantics: an unclassified point stays a generic location.
export function pointMarkerKind(properties = {}, name = '') {
  const description = `${properties.kind || ''} ${properties.type || ''} ${name}`;
  if (/parking|парков|стоянк/i.test(description)) return 'parking';
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
  } else
    icon.textContent = { parking: 'P', finish: '⚑', start: '⚑', closure: '!', location: '•' }[kind];
  const label = document.createElement('span');
  label.className = 'map-point-label';
  label.textContent = name;
  element.append(icon, label);
}
