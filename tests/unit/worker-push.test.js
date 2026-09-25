import { afterEach, describe, expect, it, vi } from 'vitest';
import { pushEndpointAllowed, pushConfigured, validReminder, reminderPrefix, countPushSubscriptions, adminTokenMatches, handlePushApi } from '../../src/worker/push.js';

afterEach(()=>vi.useRealTimers());

class FakeKV {
  constructor(){this.map=new Map();}
  async put(key,value){this.map.set(key,value);}
  async get(key,type){const v=this.map.get(key);if(v==null)return null;return type==='json'?JSON.parse(v):v;}
  async delete(key){this.map.delete(key);}
  async list({prefix=''}={}){return {keys:[...this.map.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true};}
}

const makeEnv=()=>({
  VAPID_PUBLIC_KEY:'pub',
  VAPID_PRIVATE_JWK:'{}',
  VAPID_SUBJECT:'mailto:test@example.com',
  PUSH_ADMIN_TOKEN:'secret',
  PUSH_SUBSCRIPTIONS:new FakeKV()
});

describe('push validation',()=>{
  it.each([
    'https://web.push.apple.com/x',
    'https://foo.push.apple.com/x',
    'https://fcm.googleapis.com/fcm/send/x',
    'https://updates.push.services.mozilla.com/wpush/v2/x'
  ])('allows known endpoint',endpoint=>expect(pushEndpointAllowed(endpoint)).toBe(true));
  it.each([
    'http://fcm.googleapis.com/x',
    'https://example.com/push',
    'not a url',
    ''
  ])('rejects unknown endpoint',endpoint=>expect(pushEndpointAllowed(endpoint)).toBe(false));
  it('detects complete VAPID config',()=>expect(pushConfigured(makeEnv())).toBe(true));
  it('detects missing VAPID config',()=>expect(pushConfigured({VAPID_PUBLIC_KEY:'x'})).toBe(false));
  it('builds reminder prefix',()=>expect(reminderPrefix('abc','42')).toBe('reminder:abc:42:'));
  it('compares admin tokens without accepting empty or prefix-only credentials',()=>{
    expect(adminTokenMatches('secret','secret')).toBe(true);
    expect(adminTokenMatches('secretx','secret')).toBe(false);
    expect(adminTokenMatches('','')).toBe(false);
  });

  it('validates a future reminder',()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-10T00:00:00Z'));
    expect(validReminder({dueAt:Date.now()+60000,title:'A',body:'B'})).toBe(true);
  });
  it('rejects too-distant reminder',()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-10T00:00:00Z'));
    expect(validReminder({dueAt:Date.now()+15*86400000,title:'A',body:'B'})).toBe(false);
  });
  it('rejects oversized title and body',()=>{
    expect(validReminder({dueAt:Date.now()+60000,title:'A'.repeat(121),body:'B'})).toBe(false);
    expect(validReminder({dueAt:Date.now()+60000,title:'A',body:'B'.repeat(241)})).toBe(false);
  });
});

describe('push subscription stats',()=>{
  it('counts subscriptions across KV pages',async()=>{
    const pages=[
      {keys:[{name:'sub:a'},{name:'sub:b'}],list_complete:false,cursor:'next'},
      {keys:[{name:'sub:c'}],list_complete:true}
    ];
    const store={list:vi.fn().mockResolvedValueOnce(pages[0]).mockResolvedValueOnce(pages[1])};
    await expect(countPushSubscriptions(store)).resolves.toBe(3);
    expect(store.list).toHaveBeenNthCalledWith(1,{prefix:'sub:',cursor:undefined,limit:1000});
    expect(store.list).toHaveBeenNthCalledWith(2,{prefix:'sub:',cursor:'next',limit:1000});
  });
  it('fails safely when KV pagination repeats a cursor',async()=>{
    const store={list:vi.fn().mockResolvedValue({keys:[{name:'sub:a'}],list_complete:false,cursor:'same'})};
    await expect(countPushSubscriptions(store)).rejects.toThrow(/repeated cursor/);
  });
  it('bounds long KV scans',async()=>{
    const store={list:vi.fn(({cursor})=>Promise.resolve({keys:[{name:`sub:${cursor||'first'}`}],list_complete:false,cursor:`next-${store.list.mock.calls.length}`}))};
    await expect(countPushSubscriptions(store,{maxPages:2})).rejects.toThrow(/exceeded 2 pages/);
    expect(store.list).toHaveBeenCalledTimes(2);
  });
});

describe('push API without network delivery',()=>{
  it('returns config state',async()=>{
    const e=makeEnv();
    const req=new Request('https://app.test/api/push/config');
    const r=await handlePushApi(req,e,new URL(req.url),{});
    expect(await r.json()).toMatchObject({ok:true,enabled:true,storage:true,publicKey:'pub'});
  });
  it('rejects unsupported endpoint on subscribe',async()=>{
    const e=makeEnv();
    const req=new Request('https://app.test/api/push/subscribe',{method:'POST',body:JSON.stringify({subscription:{endpoint:'https://evil.test/x'}})});
    const r=await handlePushApi(req,e,new URL(req.url),{});
    expect(r.status).toBe(400);
  });
  it('stores valid subscription',async()=>{
    const e=makeEnv();
    const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{p256dh:'x',auth:'y'}};
    const req=new Request('https://app.test/api/push/subscribe',{method:'POST',body:JSON.stringify({subscription})});
    const r=await handlePushApi(req,e,new URL(req.url),{});
    expect(r.status).toBe(200);
    expect([...e.PUSH_SUBSCRIPTIONS.map.keys()].some(k=>k.startsWith('sub:'))).toBe(true);
  });
  it('stores scheduled reminders',async()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-10T00:00:00Z'));
    const e=makeEnv();
    const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{p256dh:'x',auth:'y'}};
    const body={subscription,raceId:'42',reminders:[{dueAt:Date.now()+60000,title:'Race',body:'Close',url:'/',tag:'x'}]};
    const req=new Request('https://app.test/api/push/schedule',{method:'POST',body:JSON.stringify(body)});
    const r=await handlePushApi(req,e,new URL(req.url),{});
    expect((await r.json()).stored).toBe(1);
    expect([...e.PUSH_SUBSCRIPTIONS.map.keys()].filter(k=>k.startsWith('reminder:'))).toHaveLength(1);
  });
  it('returns authenticated push subscription stats',async()=>{
    const e=makeEnv();
    await e.PUSH_SUBSCRIPTIONS.put('sub:a',JSON.stringify({subscription:{endpoint:'https://fcm.googleapis.com/fcm/send/a'}}));
    await e.PUSH_SUBSCRIPTIONS.put('sub:b',JSON.stringify({subscription:{endpoint:'https://fcm.googleapis.com/fcm/send/b'}}));
    await e.PUSH_SUBSCRIPTIONS.put('pending:x','{}');
    const req=new Request('https://app.test/api/push/stats',{headers:{authorization:'Bearer secret'}});
    const r=await handlePushApi(req,e,new URL(req.url),{});
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ok:true,subscriptions:2,pushConfigured:true,storage:true});
  });
  it('rejects push stats without admin token',async()=>{
    const e=makeEnv();
    const req=new Request('https://app.test/api/push/stats');
    const r=await handlePushApi(req,e,new URL(req.url),{});
    expect(r.status).toBe(401);
  });
  it('rejects run-due without admin token',async()=>{
    const e=makeEnv();
    const req=new Request('https://app.test/api/push/run-due');
    const r=await handlePushApi(req,e,new URL(req.url),{});
    expect(r.status).toBe(401);
  });
  it('rejects broadcast without admin token',async()=>{
    const e=makeEnv();
    const req=new Request('https://app.test/api/push/broadcast',{method:'POST',body:JSON.stringify({body:'hello'})});
    const r=await handlePushApi(req,e,new URL(req.url),{});
    expect(r.status).toBe(401);
  });
  it('signs VAPID JWT and sends a broadcast',async()=>{
    const keys=await crypto.subtle.generateKey(
      {name:'ECDSA',namedCurve:'P-256'},
      true,
      ['sign','verify']
    );
    const privateJwk=await crypto.subtle.exportKey('jwk',keys.privateKey);
    const publicJwk=await crypto.subtle.exportKey('jwk',keys.publicKey);
    const publicBytes=new Uint8Array(65);
    publicBytes[0]=4;
    const decode=value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4)),c=>c.charCodeAt(0));
    publicBytes.set(decode(publicJwk.x),1);
    publicBytes.set(decode(publicJwk.y),33);
    const publicKey=btoa(String.fromCharCode(...publicBytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');

    const e=makeEnv();
    e.VAPID_PUBLIC_KEY=publicKey;
    e.VAPID_PRIVATE_JWK=JSON.stringify(privateJwk);
    const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{p256dh:'x',auth:'y'}};
    await e.PUSH_SUBSCRIPTIONS.put('sub:test',JSON.stringify({subscription}));

    const fetchSpy=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(null,{status:201}));
    const req=new Request('https://app.test/api/push/broadcast',{
      method:'POST',
      headers:{authorization:'Bearer secret'},
      body:JSON.stringify({body:'hello'})
    });
    const r=await handlePushApi(req,e,new URL(req.url),{});
    expect(await r.json()).toMatchObject({ok:true,sent:1,failed:0});
    expect(fetchSpy).toHaveBeenCalledOnce();
    fetchSpy.mockRestore();
  });
});
