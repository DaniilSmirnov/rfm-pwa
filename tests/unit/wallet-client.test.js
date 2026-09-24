// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { syncWalletStage, syncWalletPassesForPackage } from '../../src/app/wallet-client.js';

afterEach(()=>vi.restoreAllMocks());

const pkg={id:'race-1',raceId:1,name:'Rally Test',original:{schedule:[]}};
const item={date:'10.10.2026',location:'СУ 1',events:[]};
const stage={key:'су-1',name:'СУ 1'};

describe('wallet client',()=>{
  it('posts generated stage payload',async()=>{
    const fetchMock=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({ok:true,configured:true}),{
      status:200,headers:{'content-type':'application/json'}
    }));
    const data=await syncWalletStage(pkg,item,stage);
    expect(data.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url,options]=fetchMock.mock.calls[0];
    expect(url).toBe('/api/wallet/stage');
    expect(options.method).toBe('POST');
    const body=JSON.parse(options.body);
    expect(body).toMatchObject({raceId:'1',raceName:'Rally Test',stageKey:'су-1',stageName:'СУ 1'});
  });

  it('surfaces server-side Wallet errors',async()=>{
    vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({ok:false,error:'disabled'}),{
      status:503,headers:{'content-type':'application/json'}
    }));
    await expect(syncWalletStage(pkg,item,stage)).rejects.toThrow('disabled');
  });

  it('requires configured Wallet before opening pass',async()=>{
    vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({ok:true,configured:false}),{
      status:200,headers:{'content-type':'application/json'}
    }));
    await expect(syncWalletStage(pkg,item,stage,{openPass:true})).rejects.toThrow('ещё не настроен');
  });

  it('does no background refresh while Wallet feature is disabled',async()=>{
    expect(await syncWalletPassesForPackage(pkg)).toBe(0);
  });
});
