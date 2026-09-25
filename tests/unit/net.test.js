import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithTimeout, NetworkTimeoutError } from '../../src/app/net.js';

afterEach(()=>{
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('fetchWithTimeout',()=>{
  it('aborts a stalled request and reports the configured timeout',async()=>{
    vi.useFakeTimers();
    const fetch=vi.fn((url,{signal})=>new Promise((resolve,reject)=>{
      signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});
    }));
    vi.stubGlobal('fetch',fetch);
    const request=fetchWithTimeout('/slow',{cache:'no-store'},2500);
    const assertion=expect(request).rejects.toMatchObject({name:'NetworkTimeoutError',timeoutMs:2500,url:'/slow'});
    await vi.advanceTimersByTimeAsync(2500);
    await assertion;
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps caller cancellation distinct from a timeout',async()=>{
    const controller=new AbortController();
    const fetch=vi.fn((url,{signal})=>new Promise((resolve,reject)=>{
      signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});
    }));
    vi.stubGlobal('fetch',fetch);
    const request=fetchWithTimeout('/cancelled',{signal:controller.signal},10_000);
    controller.abort();
    await expect(request).rejects.toMatchObject({name:'AbortError'});
  });
});

it('exports a distinct timeout error type',()=>expect(new NetworkTimeoutError('/x',1)).toBeInstanceOf(Error));
