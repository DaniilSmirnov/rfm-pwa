import { describe, expect, it } from 'vitest';
import { walletConfigured, walletSerialSafe, buildWalletPassJson } from '../../src/worker/wallet.js';

describe('Wallet helpers',()=>{
  it('requires signer identifiers and URL',()=>{
    expect(walletConfigured({WALLET_PASS_TYPE_IDENTIFIER:'p',WALLET_TEAM_IDENTIFIER:'t',WALLET_SIGNER_URL:'https://sign'})).toBe(true);
    expect(walletConfigured({WALLET_PASS_TYPE_IDENTIFIER:'p'})).toBe(false);
  });
  it.each([
    ['rfm race/1','rfm-race-1'],
    ['a---b','a-b'],
    ['', '']
  ])('sanitizes serial',(raw,expected)=>expect(walletSerialSafe(raw)).toBe(expected));
  it('caps serial length',()=>expect(walletSerialSafe('a'.repeat(200))).toHaveLength(120));
  it('builds an event ticket pass',()=>{
    const env={WALLET_PASS_TYPE_IDENTIFIER:'pass.test',WALLET_TEAM_IDENTIFIER:'TEAM'};
    const record={serialNumber:'r1',authenticationToken:'token',state:{raceName:'Rally',stageName:'СУ 1',date:'10.10.2026',events:[]}};
    const pass=buildWalletPassJson(env,new URL('https://app.test/x'),record);
    expect(pass).toMatchObject({formatVersion:1,passTypeIdentifier:'pass.test',teamIdentifier:'TEAM',serialNumber:'r1',webServiceURL:'https://app.test/api/wallet/v1'});
    expect(pass.eventTicket.primaryFields[0].value).toBe('СУ 1');
  });
  it('adds start and finish locations',()=>{
    const env={WALLET_PASS_TYPE_IDENTIFIER:'p',WALLET_TEAM_IDENTIFIER:'t'};
    const record={serialNumber:'r',authenticationToken:'x',state:{stageName:'SS1',startLocation:{lat:1,lon:2},finishLocation:{lat:3,lon:4},events:[]}};
    expect(buildWalletPassJson(env,new URL('https://app.test'),record).locations).toHaveLength(2);
  });
  it('omits invalid locations',()=>{
    const env={WALLET_PASS_TYPE_IDENTIFIER:'p',WALLET_TEAM_IDENTIFIER:'t'};
    const record={serialNumber:'r',authenticationToken:'x',state:{stageName:'SS1',startLocation:{lat:'x',lon:2},events:[]}};
    expect(buildWalletPassJson(env,new URL('https://app.test'),record).locations).toBeUndefined();
  });
  it('renders schedule into back fields',()=>{
    const env={WALLET_PASS_TYPE_IDENTIFIER:'p',WALLET_TEAM_IDENTIFIER:'t'};
    const record={serialNumber:'r',authenticationToken:'x',state:{stageName:'SS1',events:[{time:'10:00',text:'Старт'}]}};
    const fields=buildWalletPassJson(env,new URL('https://app.test'),record).eventTicket.backFields;
    expect(fields.find(x=>x.key==='schedule')?.value).toContain('10:00 · Старт');
  });
});
