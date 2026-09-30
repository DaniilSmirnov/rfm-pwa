// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import {
  pointMarkerKind,
  pointWithMarkerIcon,
  createPointMarkerContent,
} from '../../src/map/point-marker.js';

describe('spectator map symbols', () => {
  it.each([
    ['Парковка зрителей', 'parking'],
    ['Пост связи', 'communication'],
    ['Паспорт', 'passport'],
    ['Смотровая точка', 'spectator'],
    ['Вылет', 'spectator'],
    ['Машинопад', 'spectator'],
    ['90', 'spectator'],
    ['Финиш СУ 1', 'finish'],
    ['Старт', 'start'],
    ['Дорога закрыта', 'closure'],
    ['Неизвестная точка', 'location'],
  ])('keeps the meaning of %s', (name, kind) => expect(pointMarkerKind({}, name)).toBe(kind));


  it('does not classify arbitrary numbers containing 90 as spectator points', () => {
    expect(pointMarkerKind({}, 'СУ 90')).toBe('location');
    expect(pointMarkerKind({}, '190')).toBe('location');
  });

  it.each([
    [{ caption: 'Пост связи' }, 'communication'],
    [{ 'name:ru': 'Пост связи' }, 'communication'],
    [{ name_ru: 'Пост связи' }, 'communication'],
    [{ title: 'Пост связи' }, 'communication'],
  ])('uses display-name aliases for marker classification', (properties, expected) => {
    const feature = pointWithMarkerIcon({
      type: 'Feature',
      properties,
      geometry: { type: 'Point', coordinates: [30, 60] },
    });
    expect(feature.properties.markerIcon).toBe(expected);
  });

  it('stores the icon as a point property and renders no separate icon node', () => {
    const feature = pointWithMarkerIcon({
      type: 'Feature',
      properties: { name: 'Пост связи' },
      geometry: { type: 'Point', coordinates: [30, 60] },
    });
    expect(feature.properties.markerIcon).toBe('communication');

    const el = document.createElement('button');
    createPointMarkerContent(el, feature.properties.name, feature.properties.markerIcon);
    expect(el.dataset.pointIcon).toBe('communication');
    expect(el.querySelector('.map-point-symbol')).toBeNull();
    expect(el.querySelector('.map-point-svg')).toBeNull();
  });

  it('uses source type and keeps an accessible safe label', () => {
    const el = document.createElement('button');
    const name = '<img src=x onerror=alert(1)>';
    createPointMarkerContent(el, name, pointMarkerKind({ type: 'spectator' }));
    expect(el.getAttribute('aria-label')).toBe(name);
    expect(el.querySelector('.map-point-label').textContent).toBe(name);
    expect(el.dataset.pointIcon).toBe('spectator');
    expect(el.querySelectorAll('img')).toHaveLength(0);
  });
});
