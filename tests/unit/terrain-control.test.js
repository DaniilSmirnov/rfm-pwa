// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { TerrainModeControl } from '../../src/map/terrain-control.js';

describe('terrain mode control',()=>{
  it('requests a full map style recreation when switching modes',async()=>{
    const onModeChange=vi.fn(async()=>{});
    const control=new TerrainModeControl({onModeChange});
    const map={};
    const root=control.onAdd(map);
    const button=root.querySelector('button');

    expect(button.dataset.mode).toBe('hillshade');
    button.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(onModeChange).toHaveBeenCalledWith('3d',map);
    expect(button.dataset.mode).toBe('3d');
    expect(button.getAttribute('aria-pressed')).toBe('true');

    button.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(onModeChange).toHaveBeenLastCalledWith('hillshade',map);
    expect(button.dataset.mode).toBe('hillshade');
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('does not allow overlapping mode changes',async()=>{
    let release;
    const pending=new Promise(resolve=>{release=resolve;});
    const onModeChange=vi.fn(()=>pending);
    const control=new TerrainModeControl({onModeChange});
    const button=control.onAdd({}).querySelector('button');

    button.click();
    button.click();
    expect(onModeChange).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);

    release();
    await pending;
    await Promise.resolve();
    expect(button.disabled).toBe(false);
    expect(button.dataset.mode).toBe('3d');
  });
});
