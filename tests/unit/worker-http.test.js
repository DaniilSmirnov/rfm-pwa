import { afterEach, describe, expect, it, vi } from 'vitest';
import { bytesToBase64Url, textToBase64Url, sha256Base64Url, readJson, commonHeaders, fetchWithTimeout, json } from '../../src/worker/http.js';

afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});

describe('worker HTTP helpers',()=>{
  it('encodes bytes as base64url',()=>expect(bytesToBase64Url(new Uint8Array([255,254,253]))).toBe('__79'));
  it('encodes text without padding',()=>expect(textToBase64Url('test')).toBe('dGVzdA'));
  it('hashes deterministically',async()=>expect(await sha256Base64Url('x')).toBe(await sha256Base64Url('x')));
  it('hashes different inputs differently',async()=>expect(await sha256Base64Url('x')).not.toBe(await sha256Base64Url('y')));
  it('reads valid JSON',async()=>expect(await readJson(new Request('https://x.test',{method:'POST',body:'{"a":1}',headers:{'content-type':'application/json'}}))).toEqual({a:1}));
  it('returns null for invalid JSON',async()=>expect(await readJson(new Request('https://x.test',{method:'POST',body:'bad'}))).toBeNull());
  it('adds security header',()=>expect(commonHeaders()['x-content-type-options']).toBe('nosniff'));
  it('reports current worker version header',()=>expect(commonHeaders()['x-rfm-worker']).toContain('0.6.0'));
  it('allows extra headers',()=>expect(commonHeaders({allow:'GET'}).allow).toBe('GET'));
  it('builds JSON response',async()=>{
    const r=json({ok:true},201);
    expect(r.status).toBe(201);
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(await r.json()).toEqual({ok:true});
  });
  it('aborts upstream requests at their deadline',async()=>{
    vi.useFakeTimers();
    const fetch=vi.fn((url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true})));
    vi.stubGlobal('fetch',fetch);
    const request=fetchWithTimeout('https://upstream.test/',{},5000);
    const assertion=expect(request).rejects.toMatchObject({name:'UpstreamTimeoutError',timeoutMs:5000});
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
  });
});
