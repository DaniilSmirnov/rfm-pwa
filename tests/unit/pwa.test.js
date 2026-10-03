// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  installInstructions,
  isStandalonePwa,
  mobileBrowser,
  pwaLaunchContext,
} from '../../src/app/pwa.js';

const originalStandalone = Object.getOwnPropertyDescriptor(navigator, 'standalone');
const originalUserAgent = Object.getOwnPropertyDescriptor(navigator, 'userAgent');

afterEach(() => {
  vi.restoreAllMocks();
  if (originalStandalone) Object.defineProperty(navigator, 'standalone', originalStandalone);
  else delete navigator.standalone;
  if (originalUserAgent) Object.defineProperty(navigator, 'userAgent', originalUserAgent);
  else delete navigator.userAgent;
});

describe('PWA launch helpers', () => {
  it('detects normal browser launch', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }));
    expect(pwaLaunchContext()).toMatchObject({ installedLaunch: false, browserMode: true });
    expect(isStandalonePwa()).toBe(false);
  });

  it('detects standalone display mode', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
      matches: query.includes('standalone'),
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }));
    expect(pwaLaunchContext()).toMatchObject({
      installedLaunch: true,
      displayMode: 'standalone',
      browserMode: false,
    });
    expect(isStandalonePwa()).toBe(true);
  });

  it('provides generic browser install instructions', () => {
    const instructions = installInstructions();
    expect(instructions.steps.length).toBeGreaterThan(0);
    expect(instructions.action).toBe('Как установить');
  });

  it('detects Safari, Chrome, and Yandex mobile installation instructions', () => {
    const userAgents = [
      [
        'iPhone Safari',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
        'safari',
        'Установка в Safari',
      ],
      [
        'Chrome Android',
        'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36',
        'chrome',
        'Установка в Chrome',
      ],
      [
        'Yandex Android',
        'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/140.0.0.0 YaBrowser/25.10.1.0 Mobile Safari/537.36',
        'yandex',
        'Установка в Яндекс.Браузере',
      ],
    ];

    for (const [, userAgent, browser, title] of userAgents) {
      Object.defineProperty(navigator, 'userAgent', { configurable: true, value: userAgent });
      expect(mobileBrowser()).toBe(browser);
      expect(installInstructions().title).toBe(title);
    }
  });

  it('keeps browser instructions when beforeinstallprompt is available', () => {
    const instructions = installInstructions({ promptAvailable: true });
    expect(instructions.action).toBe('Как установить');
    expect(instructions.steps.length).toBeGreaterThan(0);
  });
});
