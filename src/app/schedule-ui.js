import { stageIdentity } from './schedule.js';
import { subscribedStageKeys, setStageSubscribed, walletStageKeys, setWalletStageAdded } from './preferences.js';
import { isIOSDevice } from './pwa.js';
import {
  getPushSubscription,
  setPushStatus,
  scheduleRaceReminders,
  enablePushNotifications
} from './push-client.js';
import { syncWalletStage } from './wallet-client.js';

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const asArray=v=>Array.isArray(v)?v:(v&&typeof v==='object'?Object.values(v):[]);
const WALLET_STAGE_FEATURE_ENABLED=false;

export function renderSchedule(pkg){
  const schedule=asArray(pkg.original?.schedule);
  const root=$('scheduleList');
  root.innerHTML='';
  if(!schedule.length){
    root.innerHTML='<p class="muted">Расписание отсутствует.</p>';
    return;
  }

  const subscribed=subscribedStageKeys(pkg);
  const walletAdded=walletStageKeys(pkg);
  const showWallet=WALLET_STAGE_FEATURE_ENABLED&&isIOSDevice();

  for(const item of schedule){
    const events=asArray(item.events);
    const stage=stageIdentity(item);
    const isSubscribed=Boolean(stage&&subscribed.has(stage.key));
    const isInWallet=Boolean(stage&&walletAdded.has(stage.key));

    const node=document.createElement('article');
    node.className='schedule-item';
    node.innerHTML=`${item.date?`<div class="date-header">${esc(item.date)}</div>`:''}
      <div class="schedule-location-row">
        <div class="location">${esc(item.location||'Событие')}</div>
        ${stage?`<div class="stage-actions">
          <button class="button compact stage-push-toggle ${isSubscribed?'subscribed':''}" data-stage-key="${esc(stage.key)}" type="button" aria-label="${isSubscribed?'Выключить уведомления':'Включить уведомления'}">
            <span aria-hidden="true">🔔</span><span>${isSubscribed?'Включены':'Уведомлять'}</span>
          </button>
          ${showWallet?`<button class="button compact stage-wallet-toggle ${isInWallet?'subscribed':''}" data-wallet-stage-key="${esc(stage.key)}" type="button" aria-label="Добавить ${esc(stage.name)} в Apple Wallet">
            <img class="rfm-icon" src="/assets/wallet.svg" alt="" /><span>${isInWallet?'Wallet ✓':'Wallet'}</span>
          </button>`:''}
        </div>`:''}
      </div>
      ${item.coordinates?`<div class="coordinates-line">${esc(item.coordinates)}</div>`:''}
      <div class="event-list">${events.map(e=>`<div><time>${esc(e.time||'')}</time><span>${esc(e.text||'')}</span></div>`).join('')}</div>`;
    root.appendChild(node);

    const toggle=node.querySelector('[data-stage-key]');
    if(toggle&&stage){
      toggle.addEventListener('click',async()=>{
        toggle.disabled=true;
        try{
          const shouldEnable=!subscribedStageKeys(pkg).has(stage.key);
          if(shouldEnable&&!(await getPushSubscription())){
            await enablePushNotifications();
            if(!(await getPushSubscription())) return;
          }
          setStageSubscribed(pkg,stage.key,shouldEnable);
          const result=await scheduleRaceReminders(pkg);
          setPushStatus(
            shouldEnable
              ? `${stage.name}: уведомления включены · за 60, 30 и 15 минут.`
              : `${stage.name}: уведомления выключены.`,
            'geo-ok'
          );
          if(result.stored===0&&shouldEnable){
            setPushStatus(`${stage.name}: подписка сохранена, но будущих событий открытия/закрытия пока нет.`);
          }
          renderSchedule(pkg);
        }catch(error){
          setPushStatus(`Не удалось изменить подписку ${stage.name}: ${error.message}`,'geo-error');
          toggle.disabled=false;
        }
      });
    }

    const walletButton=node.querySelector('[data-wallet-stage-key]');
    if(walletButton&&stage){
      walletButton.addEventListener('click',async()=>{
        walletButton.disabled=true;
        try{
          const data=await syncWalletStage(pkg,item,stage,{openPass:true});
          setWalletStageAdded(pkg,stage.key);
          setPushStatus(
            data.updated
              ? `${stage.name}: карточка Wallet обновлена.`
              : `${stage.name}: карточка Wallet подготовлена.`,
            'geo-ok'
          );
          renderSchedule(pkg);
        }catch(error){
          setPushStatus(`Wallet · ${stage.name}: ${error.message}`,'geo-error');
          walletButton.disabled=false;
        }
      });
    }
  }
}
