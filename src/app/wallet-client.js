import { stageIdentity, stageWalletPayload } from './schedule.js';
import { walletStageKeys } from './preferences.js';
import { isIOSDevice } from './pwa.js';
import { fetchWithTimeout } from './net.js';

const asArray = v => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
const WALLET_STAGE_FEATURE_ENABLED=false;

export async function syncWalletStage(pkg,item,stage,{openPass=false}={}){
  const payload=stageWalletPayload(pkg,item,stage);
  const res=await fetchWithTimeout('/api/wallet/stage',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(payload)
  },8000);
  const data=await res.json().catch(()=>({}));
  if(!res.ok || !data?.ok) throw new Error(data?.error || 'Не удалось подготовить Wallet pass');
  if(openPass && !data.configured) throw new Error('Apple Wallet ещё не настроен на сервере');
  if(openPass && data.addUrl) window.location.href=data.addUrl;
  return data;
}

export async function syncWalletPassesForPackage(pkg){
  if(!WALLET_STAGE_FEATURE_ENABLED || !isIOSDevice()) return 0;
  const selected=walletStageKeys(pkg);
  if(!selected.size) return 0;
  let synced=0;
  for(const item of asArray(pkg?.original?.schedule)){
    const stage=stageIdentity(item);
    if(!stage || !selected.has(stage.key)) continue;
    try{
      await syncWalletStage(pkg,item,stage);
      synced++;
    }catch(e){
      console.warn('Could not refresh Wallet pass',stage.name,e);
    }
  }
  return synced;
}
