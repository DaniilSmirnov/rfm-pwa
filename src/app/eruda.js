export const ERUDA_VISIBLE_KEY = 'rfm-eruda-visible-v1';

let erudaInstance = null;
let erudaPromise = null;
let erudaInitialized = false;

export function loadErudaVisibility(storage = globalThis.localStorage) {
  try {
    return storage?.getItem(ERUDA_VISIBLE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveErudaVisibility(visible, storage = globalThis.localStorage) {
  try {
    storage?.setItem(ERUDA_VISIBLE_KEY, visible ? 'true' : 'false');
  } catch {}
  return Boolean(visible);
}

async function getEruda() {
  if (erudaInstance) return erudaInstance;
  if (!erudaPromise) {
    erudaPromise = import('eruda').then(module => {
      erudaInstance = module.default;
      if (!erudaInitialized) {
        erudaInstance.init({ useShadowDom: true });
        erudaInitialized = true;
      }
      return erudaInstance;
    });
  }
  return erudaPromise;
}

export async function setErudaVisible(visible) {
  saveErudaVisibility(visible);
  if (!visible && !erudaInstance && !erudaPromise) return false;
  const eruda = await getEruda();
  if (visible) eruda.show();
  else eruda.hide();
  return Boolean(visible);
}

export function startErudaIfEnabled() {
  if (loadErudaVisibility()) return setErudaVisible(true);
  return Promise.resolve(false);
}
