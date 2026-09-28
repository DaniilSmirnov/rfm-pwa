// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, waitFor } from '@testing-library/react';
import { TerrainModeControl } from '../../src/map/terrain-control.js';

describe('terrain mode control', () => {
  it('requests a full map style recreation when switching modes', async () => {
    const onModeChange = vi.fn(async () => {});
    const control = new TerrainModeControl({ onModeChange });
    const map = {};
    const root = control.onAdd(map);
    const button = root.querySelector('button');

    expect(button.querySelector('svg')).toBeTruthy();
    expect(button.dataset.mode).toBe('hillshade');
    await act(async () => {
      fireEvent.click(button);
    });
    await waitFor(() => expect(button.dataset.mode).toBe('3d'));

    expect(onModeChange).toHaveBeenCalledWith('3d', map);
    expect(button.dataset.mode).toBe('3d');
    expect(button.getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      fireEvent.click(button);
    });
    await waitFor(() => expect(button.dataset.mode).toBe('hillshade'));

    expect(onModeChange).toHaveBeenLastCalledWith('hillshade', map);
    expect(button.dataset.mode).toBe('hillshade');
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('does not allow overlapping mode changes', async () => {
    let release;
    const pending = new Promise(resolve => {
      release = resolve;
    });
    const onModeChange = vi.fn(() => pending);
    const control = new TerrainModeControl({ onModeChange });
    const button = control.onAdd({}).querySelector('button');

    await act(async () => {
      fireEvent.click(button);
    });
    fireEvent.click(button);
    expect(onModeChange).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);

    await act(async () => {
      release();
      await pending;
    });
    expect(button.disabled).toBe(false);
    expect(button.dataset.mode).toBe('3d');
  });

  it('unmounts the React icon when MapLibre removes the control', () => {
    const control = new TerrainModeControl();
    const root = control.onAdd({});
    const unmount = vi.spyOn(control.reactRoot, 'unmount');
    const container = root;
    expect(container.querySelector('button svg')).toBeTruthy();

    control.onRemove();

    expect(unmount).toHaveBeenCalledOnce();
    expect(container.isConnected).toBe(false);
    expect(control.reactRoot).toBeNull();
  });
});
