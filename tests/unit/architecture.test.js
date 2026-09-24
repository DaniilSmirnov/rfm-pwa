import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read=path=>readFileSync(path,'utf8');
const lines=path=>read(path).split(/\r?\n/).length;

describe('architecture guardrails',()=>{
  it('keeps app.js orchestration-focused below 650 lines',()=>expect(lines('src/app.js')).toBeLessThan(650));
  it('keeps map controller below 500 lines',()=>expect(lines('src/map.js')).toBeLessThan(500));
  it('keeps basemap style isolated below 700 lines',()=>expect(lines('src/map/style.js')).toBeLessThan(700));
  it('keeps Worker entrypoint below 100 lines',()=>expect(lines('_worker.js')).toBeLessThan(100));
  it('keeps push logic out of Worker entrypoint',()=>expect(read('_worker.js')).not.toContain('function vapidJwt'));
  it('keeps Wallet logic out of Worker entrypoint',()=>expect(read('_worker.js')).not.toContain('function buildWalletPassJson'));
  it('keeps schedule timezone logic out of app entrypoint',()=>expect(read('src/app.js')).not.toContain('RACE_REGION_TIMEZONES'));
  it('keeps sanitizer out of app entrypoint',()=>expect(read('src/app.js')).not.toContain('SAFE_RICH_HTML_TAGS'));
  it('pre-caches every extracted app module',()=>{
    const sw=read('sw.js');
    for(const path of ['catalog-dates','export','geo','local-points','preferences','push-client','pwa','runtime','sanitize','schedule','wallet-client','race-media','point-list','schedule-ui','rally-pack','rally-pack-ui']){
      expect(sw).toContain('/src/app/'+path+'.js');
    }
  });
  it('pre-caches extracted map style',()=>expect(read('sw.js')).toContain('/src/map/style.js'));
  it('defines unit, UI and PWA test scripts',()=>{
    const pkg=JSON.parse(read('package.json'));
    expect(pkg.scripts['test:unit']).toBeTruthy();
    expect(pkg.scripts['test:ui']).toBeTruthy();
    expect(pkg.scripts['test:pwa']).toBeTruthy();
  });
});
