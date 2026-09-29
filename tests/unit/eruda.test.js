// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const eruda = vi.hoisted(() => ({
  init: vi.fn(),
  show: vi.fn(),
  hide: vi.fn(),
}));

vi.mock('eruda', () => ({ default: eruda }));

import {
  ERUDA_VISIBLE_KEY,
  loadErudaVisibility,
  saveErudaVisibility,
  setErudaVisible,
} from '../../src/app/eruda.js';

beforeEach(() => {
  localStorage.clear();
  eruda.init.mockClear();
  eruda.show.mockClear();
  eruda.hide.mockClear();
});

describe('Eruda debug console', () => {
  it('keeps the floating button hidden unless enabled', () => {
    expect(loadErudaVisibility()).toBe(false);
    expect(saveErudaVisibility(true)).toBe(true);
    expect(localStorage.getItem(ERUDA_VISIBLE_KEY)).toBe('true');
    expect(loadErudaVisibility()).toBe(true);
  });

  it('initializes and shows Eruda when enabled, then hides it when disabled', async () => {
    await setErudaVisible(true);
    expect(eruda.init).toHaveBeenCalledWith({ useShadowDom: true });
    expect(eruda.show).toHaveBeenCalledOnce();

    await setErudaVisible(false);
    expect(eruda.hide).toHaveBeenCalledOnce();
    expect(loadErudaVisibility()).toBe(false);
  });
});
