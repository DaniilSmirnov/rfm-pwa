import React, { useState } from 'react';
import Button from './Button.jsx';

export default function TerrainModeButton({ initialMode = 'hillshade', onModeChange, map }) {
  const [mode, setMode] = useState(initialMode === '3d' ? '3d' : 'hillshade');
  const [busy, setBusy] = useState(false);
  const is3d = mode === '3d';
  const label = is3d ? 'Переключить на тени рельефа' : 'Переключить на 3D-рельеф';

  const toggleMode = async () => {
    if (busy) return;
    setBusy(true);
    const next = is3d ? 'hillshade' : '3d';
    try {
      await onModeChange(next, map);
      setMode(next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      className="button compact terrain-mode-button"
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={is3d}
      data-mode={mode}
      disabled={busy}
      onClick={() => void toggleMode()}
    >
      <span className="terrain-mode-icon" aria-hidden="true">{is3d ? '3D' : '2D'}</span>
    </Button>
  );
}
