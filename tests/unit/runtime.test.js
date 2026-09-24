// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ensurePersistentStorage, setupPeriodicBackgroundSync } from '../../src/app/runtime.js';

const originalStorageDescriptor=Object.getOwnPropertyDescriptor(navigator,'storage');
const originalPermissionsDescriptor=Object.getOwnPropertyDescriptor(navigator,'permissions');

function setNavigator(name,value){
  Object.defineProperty(navigator,name,{configurable:true,value});
}

afterEach(()=>{
  if(originalStorageDescriptor) Object.defineProperty(navigator,'storage',originalStorageDescriptor);
  else delete navigator.storage;
  if(originalPermissionsDescriptor) Object.defineProperty(navigator,'permissions',originalPermissionsDescriptor);
  else delete navigator.permissions;
  vi.restoreAllMocks();
});

describe('persistent storage runtime',()=>{
  it('reports unsupported storage',async()=>{
    setNavigator('storage',undefined);
    expect(await ensurePersistentStorage()).toEqual({supported:false,persisted:false});
  });
  it('keeps already persisted storage',async()=>{
    const persist=vi.fn(async()=>false);
    setNavigator('storage',{persisted:async()=>true,persist});
    expect(await ensurePersistentStorage()).toEqual({supported:true,persisted:true});
    expect(persist).not.toHaveBeenCalled();
  });
  it('requests persistence when needed',async()=>{
    const persist=vi.fn(async()=>true);
    setNavigator('storage',{persisted:async()=>false,persist});
    expect(await ensurePersistentStorage()).toEqual({supported:true,persisted:true});
    expect(persist).toHaveBeenCalledOnce();
  });
  it('degrades safely when storage API throws',async()=>{
    setNavigator('storage',{persisted:async()=>{throw new Error('nope')}});
    expect(await ensurePersistentStorage()).toEqual({supported:true,persisted:false});
  });
});

describe('periodic sync runtime',()=>{
  it('reports unsupported registration',async()=>expect(await setupPeriodicBackgroundSync({})).toEqual({supported:false}));
  it('does not register when permission is denied',async()=>{
    setNavigator('permissions',{query:async()=>({state:'denied'})});
    const register=vi.fn();
    expect(await setupPeriodicBackgroundSync({periodicSync:{register}})).toEqual({supported:true,registered:false});
    expect(register).not.toHaveBeenCalled();
  });
  it('registers refresh tag when permission is granted',async()=>{
    setNavigator('permissions',{query:async()=>({state:'granted'})});
    const register=vi.fn(async()=>{});
    expect(await setupPeriodicBackgroundSync({periodicSync:{register}})).toEqual({supported:true,registered:true});
    expect(register).toHaveBeenCalledWith('rfm-refresh-races',{minInterval:12*60*60*1000});
  });
  it('still attempts registration if permissions query is unavailable',async()=>{
    setNavigator('permissions',undefined);
    const register=vi.fn(async()=>{});
    expect(await setupPeriodicBackgroundSync({periodicSync:{register}})).toEqual({supported:true,registered:true});
  });
});
