let deferredPrompt = null;
let installedFromEvent = false;
const listeners = new Set();
let removeInstallListeners = null;

export function isIOSDevice() {
  return (
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function pwaLaunchContext() {
  const displayModes = ['standalone', 'fullscreen', 'minimal-ui'];
  const displayMode =
    displayModes.find(mode => window.matchMedia?.(`(display-mode: ${mode})`).matches) || null;
  const iosStandalone = window.navigator.standalone === true;
  const androidAppReferrer = String(document.referrer || '').startsWith('android-app://');
  const installedLaunch = Boolean(displayMode || iosStandalone || androidAppReferrer);
  return {
    installedLaunch,
    displayMode,
    iosStandalone,
    androidAppReferrer,
    browserMode: !installedLaunch,
  };
}

export function isStandalonePwa() {
  return pwaLaunchContext().installedLaunch;
}

export function mobileBrowser() {
  const userAgent = String(navigator.userAgent || '');
  if (/YaBrowser/i.test(userAgent)) return 'yandex';
  if (/CriOS|Chrome/i.test(userAgent) && !/Edg|OPR|SamsungBrowser/i.test(userAgent)) {
    return 'chrome';
  }
  if (isIOSDevice() || (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent))) {
    return 'safari';
  }
  return 'browser';
}

export function installInstructions({ promptAvailable = Boolean(deferredPrompt) } = {}) {
  if (promptAvailable) {
    return {
      browser: null,
      title: 'Установи Rally Fans Map Offline',
      text: 'Сейчас приложение открыто в браузере. Установи приложение, чтобы запускать его отдельно и надёжнее использовать офлайн-режим и уведомления.',
      steps: [],
      action: 'Установить приложение',
    };
  }

  const browser = mobileBrowser();
  const instructions = {
    safari: {
      title: 'Установка в Safari',
      text: 'На iPhone или iPad установи приложение через меню «Поделиться».',
      steps: [
        'Нажми «Поделиться» в Safari.',
        'Выбери «На экран Домой».',
        'Нажми «Добавить», затем открой Rally Fans Map с новой иконки.',
      ],
    },
    chrome: {
      title: 'Установка в Chrome',
      text: 'Открой меню Chrome и добавь Rally Fans Map на главный экран устройства.',
      steps: [
        'Открой меню Chrome ⋮.',
        'Выбери «Установить приложение» или «Добавить на главный экран».',
        'Подтверди установку и открой Rally Fans Map с новой иконки.',
      ],
    },
    yandex: {
      title: 'Установка в Яндекс.Браузере',
      text: 'Открой меню Яндекс.Браузера и добавь Rally Fans Map на главный экран.',
      steps: [
        'Открой меню Яндекс.Браузера ☰.',
        'Выбери «Добавить на главный экран» или «Установить приложение».',
        'Подтверди установку и открой Rally Fans Map с новой иконки.',
      ],
    },
    browser: {
      title: 'Установка через меню браузера',
      text: 'Открой меню браузера и добавь Rally Fans Map на главный экран устройства.',
      steps: [
        'Открой меню браузера.',
        'Выбери «Установить приложение» или «Добавить на главный экран».',
        'Подтверди установку и открой Rally Fans Map с новой иконки.',
      ],
    },
  }[browser];

  return { browser, ...instructions, action: 'Как установить' };
}

export function getPwaInstallSnapshot() {
  const context = pwaLaunchContext();
  const promptAvailable = Boolean(deferredPrompt);
  const installedLaunch = context.installedLaunch || installedFromEvent;
  return {
    ...context,
    installedLaunch,
    browserMode: !installedLaunch,
    promptAvailable,
    instructions: installInstructions({ promptAvailable }),
  };
}

function publishInstallState() {
  const snapshot = getPwaInstallSnapshot();
  for (const listener of listeners) listener(snapshot);
}

export function subscribePwaInstall(listener) {
  listeners.add(listener);
  listener(getPwaInstallSnapshot());
  if (!removeInstallListeners) {
    const onBeforeInstallPrompt = event => {
      event.preventDefault();
      if (isStandalonePwa()) return;
      deferredPrompt = event;
      publishInstallState();
    };
    const onInstalled = () => {
      installedFromEvent = true;
      deferredPrompt = null;
      publishInstallState();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') publishInstallState();
    };
    const mediaQueries = ['standalone', 'fullscreen', 'minimal-ui']
      .map(mode => window.matchMedia?.(`(display-mode: ${mode})`))
      .filter(Boolean);
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('pageshow', publishInstallState);
    window.addEventListener('rfm:pwa-install-help', publishInstallState);
    document.addEventListener('visibilitychange', onVisibility);
    for (const media of mediaQueries) media.addEventListener?.('change', publishInstallState);
    removeInstallListeners = () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('pageshow', publishInstallState);
      window.removeEventListener('rfm:pwa-install-help', publishInstallState);
      document.removeEventListener('visibilitychange', onVisibility);
      for (const media of mediaQueries) media.removeEventListener?.('change', publishInstallState);
      removeInstallListeners = null;
    };
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) removeInstallListeners?.();
  };
}

export async function requestPwaInstall({ onInstructions } = {}) {
  if (isStandalonePwa()) return { installed: true, prompted: false };
  if (!deferredPrompt) {
    onInstructions?.();
    window.dispatchEvent(new Event('rfm:pwa-install-help'));
    return { installed: false, prompted: false, instructions: true };
  }
  const promptEvent = deferredPrompt;
  deferredPrompt = null;
  publishInstallState();
  promptEvent.prompt();
  const choice = await promptEvent.userChoice.catch(() => null);
  publishInstallState();
  return { installed: isStandalonePwa(), prompted: true, choice };
}
