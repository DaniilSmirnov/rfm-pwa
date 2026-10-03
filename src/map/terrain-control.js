import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import React from 'react';
import TerrainModeButton from '../components/TerrainModeButton/TerrainModeButton.jsx';

export class TerrainModeControl {
  constructor({ initialMode = 'hillshade', onModeChange = () => {} } = {}) {
    this.mode = initialMode === '3d' ? '3d' : 'hillshade';
    this.onModeChange = onModeChange;
  }

  onAdd(map) {
    this.map = map;
    const container = document.createElement('div');
    container.className = 'maplibregl-ctrl maplibregl-ctrl-group terrain-mode-control';
    const root = createRoot(container);
    flushSync(() =>
      root.render(
        React.createElement(TerrainModeButton, {
          initialMode: this.mode,
          onModeChange: this.onModeChange,
          map,
        }),
      ),
    );
    this.container = container;
    this.reactRoot = root;
    this.button = container.querySelector('button');
    return container;
  }

  onRemove() {
    this.reactRoot?.unmount();
    this.reactRoot = null;
    this.container?.remove();
    this.map = null;
    this.container = null;
    this.button = null;
  }
}
