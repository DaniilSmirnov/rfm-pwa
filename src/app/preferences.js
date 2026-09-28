const STAGE_PUSH_PREFS_KEY='rfm-stage-push-subscriptions-v1';
const WALLET_STAGE_PREFS_KEY='rfm-wallet-stage-passes-v1';
export const THEME_PREF_KEY='rfm-theme-v1';

export function loadThemePreference(storage=null){
  try{
    const theme=(storage??globalThis.localStorage)?.getItem(THEME_PREF_KEY);
    return theme==='light'||theme==='dark' ? theme : null;
  }catch{
    return null;
  }
}

export function resolveTheme(preference,systemDark=false){
  return preference==='light'||preference==='dark' ? preference : systemDark?'dark':'light';
}

export function applyTheme(theme,root=globalThis.document?.documentElement){
  if(theme!=='light'&&theme!=='dark') return;
  root?.setAttribute('data-theme',theme);
  const meta=globalThis.document?.querySelector('meta[name="theme-color"]');
  meta?.setAttribute('content',theme==='dark'?'#111318':'#f5f5f5');
}

export function saveThemePreference(theme,storage=null,root=globalThis.document?.documentElement){
  if(theme!=='light'&&theme!=='dark') return;
  try{(storage??globalThis.localStorage)?.setItem(THEME_PREF_KEY,theme);}catch{}
  applyTheme(theme,root);
}

export function loadStagePushPrefs(){
  try{
    const parsed=JSON.parse(localStorage.getItem(STAGE_PUSH_PREFS_KEY)||'{}');
    return parsed && typeof parsed==='object' ? parsed : {};
  }catch{
    return {};
  }
}

export function racePushPrefId(pkg){
  return String(pkg?.raceId ?? pkg?.id ?? '');
}

export function subscribedStageKeys(pkg){
  const raceId=racePushPrefId(pkg);
  const prefs=loadStagePushPrefs();
  return new Set(Array.isArray(prefs[raceId])?prefs[raceId]:[]);
}

export function setStageSubscribed(pkg,stageKey,enabled){
  const raceId=racePushPrefId(pkg);
  if(!raceId || !stageKey) return;
  const prefs=loadStagePushPrefs();
  const set=new Set(Array.isArray(prefs[raceId])?prefs[raceId]:[]);
  if(enabled) set.add(stageKey); else set.delete(stageKey);
  if(set.size) prefs[raceId]=[...set];
  else delete prefs[raceId];
  localStorage.setItem(STAGE_PUSH_PREFS_KEY,JSON.stringify(prefs));
}


export function loadWalletStagePrefs(){
  try{
    const parsed=JSON.parse(localStorage.getItem(WALLET_STAGE_PREFS_KEY)||'{}');
    return parsed && typeof parsed==='object' ? parsed : {};
  }catch{
    return {};
  }
}

export function walletStageKeys(pkg){
  const raceId=racePushPrefId(pkg);
  const prefs=loadWalletStagePrefs();
  return new Set(Array.isArray(prefs[raceId])?prefs[raceId]:[]);
}

export function setWalletStageAdded(pkg,stageKey){
  const raceId=racePushPrefId(pkg);
  if(!raceId || !stageKey) return;
  const prefs=loadWalletStagePrefs();
  const set=new Set(Array.isArray(prefs[raceId])?prefs[raceId]:[]);
  set.add(stageKey);
  prefs[raceId]=[...set];
  localStorage.setItem(WALLET_STAGE_PREFS_KEY,JSON.stringify(prefs));
}
