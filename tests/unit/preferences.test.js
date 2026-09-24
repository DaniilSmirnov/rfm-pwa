// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { subscribedStageKeys, setStageSubscribed, walletStageKeys, setWalletStageAdded } from '../../src/app/preferences.js';

beforeEach(()=>localStorage.clear());
const pkg={id:'race-1',raceId:1};

describe('preferences',()=>{
  it('starts with no stage subscriptions',()=>expect([...subscribedStageKeys(pkg)]).toEqual([]));
  it('adds stage subscription',()=>{
    setStageSubscribed(pkg,'су-1',true);
    expect([...subscribedStageKeys(pkg)]).toEqual(['су-1']);
  });
  it('keeps multiple stage subscriptions',()=>{
    setStageSubscribed(pkg,'су-1',true);setStageSubscribed(pkg,'су-2',true);
    expect([...subscribedStageKeys(pkg)].sort()).toEqual(['су-1','су-2']);
  });
  it('removes one stage subscription',()=>{
    setStageSubscribed(pkg,'су-1',true);setStageSubscribed(pkg,'су-2',true);setStageSubscribed(pkg,'су-1',false);
    expect([...subscribedStageKeys(pkg)]).toEqual(['су-2']);
  });
  it('cleans race key when last stage is removed',()=>{
    setStageSubscribed(pkg,'су-1',true);setStageSubscribed(pkg,'су-1',false);
    expect(JSON.parse(localStorage.getItem('rfm-stage-push-subscriptions-v1')||'{}')).toEqual({});
  });
  it('separates races',()=>{
    setStageSubscribed({raceId:1},'су-1',true);setStageSubscribed({raceId:2},'су-2',true);
    expect([...subscribedStageKeys({raceId:1})]).toEqual(['су-1']);
  });
  it('recovers from malformed stage storage',()=>{
    localStorage.setItem('rfm-stage-push-subscriptions-v1','{bad');
    expect([...subscribedStageKeys(pkg)]).toEqual([]);
  });
  it('starts with no Wallet stages',()=>expect([...walletStageKeys(pkg)]).toEqual([]));
  it('adds Wallet stage once',()=>{
    setWalletStageAdded(pkg,'су-3');setWalletStageAdded(pkg,'су-3');
    expect([...walletStageKeys(pkg)]).toEqual(['су-3']);
  });
  it('keeps Wallet stages per race',()=>{
    setWalletStageAdded({raceId:1},'су-1');setWalletStageAdded({raceId:2},'су-2');
    expect([...walletStageKeys({raceId:2})]).toEqual(['су-2']);
  });
});
