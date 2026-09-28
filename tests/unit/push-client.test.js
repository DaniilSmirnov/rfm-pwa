// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { base64UrlToUint8Array, pushSupported, getPushSubscription, getPushStatus, refreshPushUi } from '../../src/app/push-client.js';

function setGlobal(name,value){
  Object.defineProperty(window,name,{configurable:true,writable:true,value});
}
function setNavigator(name,value){
  Object.defineProperty(navigator,name,{configurable:true,value});
}

beforeEach(()=>{
  document.body.innerHTML='<button id="pushEnableBtn"></button><button id="pushTestBtn"></button><p id="pushStatus"></p>';
});
afterEach(()=>vi.restoreAllMocks());

describe('push client helpers',()=>{
  it('decodes URL-safe VAPID key material',()=>{
    expect([...base64UrlToUint8Array('SGVsbG8')]).toEqual([72,101,108,108,111]);
  });

  it('reports unsupported browsers',()=>{
    setNavigator('serviceWorker',undefined);
    setGlobal('PushManager',undefined);
    setGlobal('Notification',undefined);
    expect(pushSupported()).toBe(false);
  });

  it('reads the current push subscription',async()=>{
    const subscription={endpoint:'https://example.test/push'};
    setGlobal('PushManager',class {});
    setGlobal('Notification',{permission:'default'});
    setNavigator('serviceWorker',{ready:Promise.resolve({pushManager:{getSubscription:async()=>subscription}})});
    expect(pushSupported()).toBe(true);
    expect(await getPushSubscription()).toBe(subscription);
  });

  it('returns an unsupported state for React to render',async()=>{
    setNavigator('serviceWorker',undefined);
    setGlobal('PushManager',undefined);
    setGlobal('Notification',undefined);
    const state=await refreshPushUi();
    expect(state).toMatchObject({supported:false,testVisible:false});
    expect(getPushStatus().text).toContain('не поддерживаются');
  });

  it('returns an enabled subscription state for React to render',async()=>{
    setGlobal('PushManager',class {});
    setGlobal('Notification',{permission:'granted'});
    setNavigator('serviceWorker',{ready:Promise.resolve({pushManager:{getSubscription:async()=>({endpoint:'https://push.test'})}})});
    const state=await refreshPushUi();
    expect(state).toMatchObject({supported:true,active:true,testVisible:true,label:'Выключить уведомления'});
    expect(getPushStatus().text).toContain('Устройство подписано');
  });
});
