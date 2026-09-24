import { describe, expect, it } from 'vitest';
import { bytesToBase64Url, textToBase64Url, sha256Base64Url, readJson, commonHeaders, json } from '../../src/worker/http.js';

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
});
