// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { pointMarkerKind, createPointMarkerContent } from '../../src/map/point-marker.js';

describe('spectator map symbols', () => {
  it.each([
    ['Парковка зрителей', 'parking'],
    ['Пост связи', 'communication'],
    ['Смотровая точка', 'spectator'],
    ['Финиш СУ 1', 'finish'],
    ['Старт', 'start'],
    ['Дорога закрыта', 'closure'],
    ['Неизвестная точка', 'location'],
  ])('keeps the meaning of %s', (name, kind) => expect(pointMarkerKind({}, name)).toBe(kind));
  it('renders communication, start and finish with dedicated svg icons', () => {
    const communication = document.createElement('button');
    createPointMarkerContent(communication, 'Пост связи', 'communication');
    expect(communication.querySelector('.map-point-symbol').classList.contains('is-communication')).toBe(true);
    expect(communication.querySelector('.map-point-svg')).toBeTruthy();

    const start = document.createElement('button');
    createPointMarkerContent(start, 'Старт', 'start');
    expect(start.querySelector('.map-point-flag-left')).toBeTruthy();

    const finish = document.createElement('button');
    createPointMarkerContent(finish, 'Финиш', 'finish');
    expect(finish.querySelector('.map-point-finish-flag')).toBeTruthy();
    expect(finish.querySelectorAll('.map-point-finish-flag path')).toHaveLength(2);
  });

  it('uses source type and keeps an accessible safe label', () => {
    const el = document.createElement('button');
    const name = '<img src=x onerror=alert(1)>';
    createPointMarkerContent(el, name, pointMarkerKind({ type: 'spectator' }));
    expect(el.getAttribute('aria-label')).toBe(name);
    expect(el.querySelector('.map-point-label').textContent).toBe(name);
    expect(el.querySelectorAll('img')).toHaveLength(1);
    expect(el.querySelector('img').getAttribute('src')).toBe('/assets/spectator.svg');
  });
});
