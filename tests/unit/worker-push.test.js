import { afterEach, describe, expect, it, vi } from 'vitest';
import { pushEndpointAllowed, pushConfigured, validReminder, reminderPrefix, handlePushApi } from '../../src/worker/push.js';

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
});
