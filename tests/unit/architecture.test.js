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

  it('uses Vite for the client production bundle',()=>{
    const pkg=JSON.parse(read('package.json'));
    const config=read('vite.config.js');
    const build=read('scripts/build.mjs');
    expect(pkg.devDependencies.vite).toBeTruthy();
    expect(config).toContain("outDir:'dist'");
    expect(config).toContain("manifest:true");
    expect(build).toContain("build as viteBuild");
  });

  it('injects the built asset graph into the service worker instead of precaching source modules',()=>{
    const sw=read('sw.js');
    const build=read('scripts/build.mjs');
    expect(sw).toContain('/*__BUILD_ASSETS__*/[]');
    expect(sw).not.toContain('/src/app.js');
    expect(sw).not.toContain('/src/map.js');
    expect(build).toContain("const shell=['/'");
    expect(build).toContain("sw.replace(shellPlaceholder,JSON.stringify(uniqueShell))");
  });

  it('keeps Cloudflare Worker modules outside the client Vite bundle',()=>{
    const build=read('scripts/build.mjs');
    expect(build).toContain("resolve(root,'src/worker')");
    expect(build).toContain("resolve(publicDir,'src/worker')");
    expect(build).toContain("path.startsWith('src/worker/')");
  });

  it('configures sampled Cloudflare error traces',()=>{
    const wrangler=read('wrangler.toml');
    expect(wrangler).toContain('binding = "ERROR_TRACES"');
    expect(wrangler).toContain('dataset = "rfm_error_traces"');
    expect(wrangler).toContain('ERROR_TRACE_SAMPLE_RATE = "0.2"');
    expect(wrangler).toContain('upload_source_maps = true');
  });

  it('keeps MapLibre worker and PMTiles as same-origin vendor assets during the Vite migration',()=>{
    const app=read('src/app.js');
    const config=read('vite.config.js');
    const build=read('scripts/build.mjs');
    expect(app).toContain("setWorkerUrl('/vendor/maplibre-gl/maplibre-gl-worker.mjs')");
    expect(config).toContain("id.startsWith('/vendor/')");
    expect(build).toContain("node_modules/maplibre-gl/dist");
    expect(build).toContain("node_modules/pmtiles/dist/pmtiles.js");
  });

  it('defines unit, UI and PWA test scripts',()=>{
    const pkg=JSON.parse(read('package.json'));
    expect(pkg.scripts['test:unit']).toBeTruthy();
    expect(pkg.scripts['test:ui']).toBeTruthy();
    expect(pkg.scripts['test:pwa']).toBeTruthy();
  });
});
