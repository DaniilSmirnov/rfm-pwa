// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupServiceWorkerUpdates } from '../../src/app/runtime.js';

const originalServiceWorkerDescriptor=Object.getOwnPropertyDescriptor(navigator,'serviceWorker');

function installDom(){
  document.body.innerHTML='<div id="updateBanner" hidden><span id="updateText"></span></div>';
}

function installServiceWorker({waiting=null,controller={}}={}){
  const swListeners=new Map();
  const registrationListeners=new Map();
  const workerListeners=new Map();
  const installing={
    state:'installing',
    postMessage:vi.fn(),
    addEventListener:(type,handler)=>workerListeners.set(type,handler)
  };
  const registration={
    waiting,
    installing:null,
    update:vi.fn(async()=>{}),
    addEventListener:(type,handler)=>registrationListeners.set(type,handler)
  };
  const serviceWorker={
    controller,
    register:vi.fn(async()=>registration),
    addEventListener:(type,handler)=>swListeners.set(type,handler)
  };
  Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:serviceWorker});
  return {serviceWorker,registration,installing,swListeners,registrationListeners,workerListeners};
}

beforeEach(()=>{
  vi.useFakeTimers();
  installDom();
});

afterEach(()=>{
  vi.clearAllTimers();
  vi.useRealTimers();
  if(originalServiceWorkerDescriptor) Object.defineProperty(navigator,'serviceWorker',originalServiceWorkerDescriptor);
  else delete navigator.serviceWorker;
  document.body.innerHTML='';
  vi.restoreAllMocks();
});

describe('service worker update runtime',()=>{
  it('activates an already waiting worker and shows the update banner',async()=>{
    const waiting={postMessage:vi.fn()};
    const {serviceWorker}=installServiceWorker({waiting});

    const registration=await setupServiceWorkerUpdates();

    expect(registration).toBeTruthy();
    expect(serviceWorker.register).toHaveBeenCalledWith('/sw.js',{updateViaCache:'none'});
    expect(waiting.postMessage).toHaveBeenCalledWith({type:'SKIP_WAITING'});
    expect(document.getElementById('updateBanner').hidden).toBe(false);
    expect(document.getElementById('updateText').textContent).toContain('Обновляю приложение');
  });

  it('asks a newly installed update to skip waiting when the page is already controlled',async()=>{
    const env=installServiceWorker({controller:{}});
    await setupServiceWorkerUpdates();

    env.registration.installing=env.installing;
    env.registrationListeners.get('updatefound')?.();
    env.installing.state='installed';
    env.workerListeners.get('statechange')?.();

    expect(env.installing.postMessage).toHaveBeenCalledWith({type:'SKIP_WAITING'});
    expect(document.getElementById('updateBanner').hidden).toBe(false);
  });

  it('bridges periodic update messages from the worker into an application event',async()=>{
    const env=installServiceWorker();
    const listener=vi.fn();
    window.addEventListener('rfm:periodic-update',listener,{once:true});
    await setupServiceWorkerUpdates();

    env.swListeners.get('message')?.({data:{type:'RFM_PERIODIC_UPDATE',raceId:1}});

    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0].detail).toEqual({type:'RFM_PERIODIC_UPDATE',raceId:1});
  });

  it('checks for worker updates again when the app returns online',async()=>{
    const env=installServiceWorker();
    await setupServiceWorkerUpdates();
    expect(env.registration.update).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event('online'));
    await Promise.resolve();

    expect(env.registration.update).toHaveBeenCalledTimes(2);
  });
});
