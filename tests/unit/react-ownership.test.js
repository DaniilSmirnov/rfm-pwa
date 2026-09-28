import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import FallbackMap from '../../src/components/FallbackMap.jsx';
import {
  getCompassHeading,
  publishCompassHeading,
  subscribeCompassHeading,
} from '../../src/hooks/compass-heading.js';

const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('React ownership boundaries', () => {
  it('keeps install and update UI in React instead of service modules', () => {
    const pwa = source('../../src/app/pwa.js');
    const runtime = source('../../src/app/runtime.js');
    const layout = source('../../src/views/AppLayout.jsx');
    expect(pwa).not.toMatch(/getElementById|innerHTML|textContent/);
    expect(runtime).not.toMatch(/getElementById|innerHTML|textContent/);
    expect(layout).not.toMatch(/id=["'](?:crewResults|updateBanner|updateText)["']/);
  });

  it('uses a React SVG fallback with accessible point controls', () => {
    const markup = renderToStaticMarkup(
      React.createElement(FallbackMap, {
        geojson: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: { name: 'Start' },
              geometry: { type: 'Point', coordinates: [30, 61] },
            },
            {
              type: 'Feature',
              properties: { name: 'SS1' },
              geometry: {
                type: 'LineString',
                coordinates: [
                  [30, 61],
                  [31, 62],
                ],
              },
            },
          ],
        },
        onPointClick: () => {},
      }),
    );
    expect(markup).toContain('<svg');
    expect(markup).toContain('aria-label="Start"');
    expect(markup).toContain('SS1');
  });

  it('removes legacy imperative renderers from the active source tree', () => {
    expect(() => source('../../src/app/terrain-controls.js')).toThrow();
    expect(() => source('../../src/app/rally-pack-update-ui.js')).toThrow();
    const map = source('../../src/map.js');
    expect(map).not.toContain('renderFallback');
    expect(map).not.toMatch(/return\s+[`'\"]\s*</);
    expect(map).not.toContain('.setHTML(');
    expect(source('../../src/map/terrain-control.js')).not.toContain('innerHTML');
  });

  it('publishes compass heading changes without rerendering the application shell', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeCompassHeading(listener);
    publishCompassHeading(42);
    expect(getCompassHeading()).toBe(42);
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });
});
