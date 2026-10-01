import { readJsonStorage, readStorage, writeJsonStorage, writeStorage } from './storage.js';

const STAGE_PUSH_PREFS_KEY = 'rfm-stage-push-subscriptions-v1';
const WALLET_STAGE_PREFS_KEY = 'rfm-wallet-stage-passes-v1';
export const THEME_PREF_KEY = 'rfm-theme-v1';
export const AUTO_DELETE_COMPLETED_RACES_KEY = 'rfm-auto-delete-completed-races-v1';

export function loadAutoDeleteCompletedRaces(storage = globalThis.localStorage) {
  return readStorage(AUTO_DELETE_COMPLETED_RACES_KEY, storage) === 'true';
}

export function saveAutoDeleteCompletedRaces(enabled, storage = globalThis.localStorage) {
  writeStorage(AUTO_DELETE_COMPLETED_RACES_KEY, enabled ? 'true' : 'false', storage);
  return Boolean(enabled);
}

export function loadThemePreference(storage = null) {
  const theme = readStorage(THEME_PREF_KEY, storage ?? globalThis.localStorage);
  return theme === 'light' || theme === 'dark' ? theme : null;
}

export function resolveTheme(preference, systemDark = false) {
  return preference === 'light' || preference === 'dark'
    ? preference
    : systemDark
      ? 'dark'
      : 'light';
}

export function applyTheme(theme, root = globalThis.document?.documentElement) {
  if (theme !== 'light' && theme !== 'dark') return;
  root?.setAttribute('data-theme', theme);
  const meta = globalThis.document?.querySelector('meta[name="theme-color"]');
  meta?.setAttribute('content', theme === 'dark' ? '#111318' : '#f5f5f5');
}

export function saveThemePreference(
  theme,
  storage = null,
  root = globalThis.document?.documentElement,
) {
  if (theme !== 'light' && theme !== 'dark') return;
  writeStorage(THEME_PREF_KEY, theme, storage ?? globalThis.localStorage);
  applyTheme(theme, root);
}

export function loadStagePushPrefs() {
  const parsed = readJsonStorage(STAGE_PUSH_PREFS_KEY, {});
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

export function racePushPrefId(pkg) {
  return String(pkg?.raceId ?? pkg?.id ?? '');
}

export function subscribedStageKeys(pkg) {
  const raceId = racePushPrefId(pkg);
  const prefs = loadStagePushPrefs();
  return new Set(Array.isArray(prefs[raceId]) ? prefs[raceId] : []);
}

export function setStageSubscribed(pkg, stageKey, enabled) {
  const raceId = racePushPrefId(pkg);
  if (!raceId || !stageKey) return;
  const prefs = loadStagePushPrefs();
  const set = new Set(Array.isArray(prefs[raceId]) ? prefs[raceId] : []);
  if (enabled) set.add(stageKey);
  else set.delete(stageKey);
  if (set.size) prefs[raceId] = [...set];
  else delete prefs[raceId];
  writeJsonStorage(STAGE_PUSH_PREFS_KEY, prefs);
}

export function loadWalletStagePrefs() {
  const parsed = readJsonStorage(WALLET_STAGE_PREFS_KEY, {});
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

export function walletStageKeys(pkg) {
  const raceId = racePushPrefId(pkg);
  const prefs = loadWalletStagePrefs();
  return new Set(Array.isArray(prefs[raceId]) ? prefs[raceId] : []);
}

export function setWalletStageAdded(pkg, stageKey) {
  const raceId = racePushPrefId(pkg);
  if (!raceId || !stageKey) return;
  const prefs = loadWalletStagePrefs();
  const set = new Set(Array.isArray(prefs[raceId]) ? prefs[raceId] : []);
  set.add(stageKey);
  prefs[raceId] = [...set];
  writeJsonStorage(WALLET_STAGE_PREFS_KEY, prefs);
}
