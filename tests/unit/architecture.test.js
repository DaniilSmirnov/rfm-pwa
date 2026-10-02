import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { RFM_FONTS } from '../../src/worker/proxies.js';
import { inspectOfflineRevisionSamples } from '../../src/app/offline-diagnostics.js';

const read = path => readFileSync(path, 'utf8');
const lines = path => read(path).split(/\r?\n/).length;

describe('architecture guardrails', () => {
  it('keeps React entrypoint minimal', () => expect(lines('src/main.jsx')).toBeLessThan(40));
  it('keeps React app composition below 500 lines', () =>
    expect(lines('src/views/App/App.jsx')).toBeLessThan(500));
  it('keeps React application hook below 480 lines', () =>
    expect(lines('src/hooks/useRfmApp.js')).toBeLessThan(650));
  it('keeps package selection and browser point effects outside the app hook', () => {
    expect(read('src/hooks/useRfmApp.js')).toContain("from '../app/package-selection.js'");
    expect(read('src/hooks/useRfmApp.js')).toContain("from '../app/point-actions.js'");
    expect(read('src/hooks/useRfmApp.js')).not.toContain('document.createElement');
  });
  it('uses the safe storage boundary for app persistence', () => {
    const sourceFiles = readdirSync('src', { recursive: true })
      .filter(name => /\.(js|jsx)$/.test(name) && !name.endsWith('bootstrap.js'))
      .map(name => `src/${name}`);
    const directAccess = sourceFiles.filter(file =>
      /localStorage\.(getItem|setItem|removeItem|clear)/.test(read(file)),
    );
    expect(directAccess).toEqual([]);
  });
  it('retries only recoverable IndexedDB lifecycle errors', async () => {
    const { isRetryableDbError } = await import('../../src/db.js');
    expect(isRetryableDbError({ name: 'InvalidStateError' })).toBe(true);
    expect(isRetryableDbError({ name: 'VersionError' })).toBe(true);
    expect(isRetryableDbError({ name: 'AbortError' })).toBe(false);
  });
  it('keeps offline storage controls in a dedicated hook', () => {
    expect(lines('src/hooks/useOfflineStorageControls.js')).toBeLessThan(140);
    expect(read('src/hooks/useRfmApp.js')).toContain('useOfflineStorageControls');
  });
  it('keeps offline diagnostics bounded to representative tile samples', () => {
    expect(lines('src/app/offline-diagnostics.js')).toBeLessThan(100);
    expect(read('src/app/offline-diagnostics.js')).toMatch(/limit\s*=\s*12/);
  });
  it('keeps map controller below 700 lines', () => expect(lines('src/map.js')).toBeLessThan(700));
  it('keeps MapLibre React mounting at explicit integration boundaries', () => {
    const files = ['src/main.jsx', 'src/map.js', 'src/map/terrain-control.js'];
    const roots = files.reduce(
      (count, file) => count + (read(file).match(/createRoot\(/g) || []).length,
      0,
    );
    expect(roots).toBe(3);
    const allSource = ['src', 'tests'].flatMap(folder => {
      const entries = readdirSync(folder, { recursive: true });
      return entries.filter(name => /\.(js|jsx)$/.test(name)).map(name => `${folder}/${name}`);
    });
    const unauthorized = allSource.filter(
      file => !files.includes(file) && /createRoot\(/.test(read(file)),
    );
    expect(unauthorized).toEqual([]);
  });
  it('keeps basemap style isolated below 700 lines', () =>
    expect(lines('src/map/style.js')).toBeLessThan(1800));
  it('keeps Worker entrypoint below 100 lines', () =>
    expect(lines('_worker.js')).toBeLessThan(100));
  it('keeps push logic out of Worker entrypoint', () =>
    expect(read('_worker.js')).not.toContain('function vapidJwt'));
  it('keeps Wallet logic out of Worker entrypoint', () =>
    expect(read('_worker.js')).not.toContain('function buildWalletPassJson'));
  it('keeps schedule timezone logic out of React entrypoint', () =>
    expect(read('src/main.jsx')).not.toContain('RACE_REGION_TIMEZONES'));
  it('keeps sanitizer out of React entrypoint', () =>
    expect(read('src/main.jsx')).not.toContain('SAFE_RICH_HTML_TAGS'));
  it('removes the legacy imperative app entrypoint', () =>
    expect(() => read('src/app.js')).toThrow());
  it('mounts the application through React without legacy interface nodes in index.html', () => {
    const html = read('index.html');
    expect(html).toContain('id="reactRoot"');
    expect(html).not.toContain('id="catalogSection"');
    expect(html).not.toContain('id="mapSection"');
    expect(html).not.toContain('id="scheduleList"');
    expect(read('src/main.jsx')).toContain('createRoot');
  });

  it('organizes app UI into components, views, modals and hooks', () => {
    expect(() => read('src/react/App.jsx')).toThrow();
    expect(read('src/views/App/App.jsx')).toContain("from '../../hooks/useRfmApp.js'");
    expect(read('src/modals/SafetyGate/SafetyGate.jsx')).toContain('role="dialog"');
    expect(read('src/components/SafetyMemo/SafetyMemo.jsx')).toContain("import './SafetyMemo.css'");
    expect(read('index.html')).not.toContain('/src/styles.css');
    expect(read('index.html')).not.toContain('id="catalogSection"');
    expect(() => read('tests/pwa/fixtures/migration-harness.html')).toThrow();
  });

  it('enforces shared React button and per-component coverage primitives', () => {
    const jsxFiles = ['components', 'views', 'modals'].flatMap(folder =>
      readdirSync(`src/${folder}`, { recursive: true })
        .filter(name => name.endsWith('.jsx'))
        .map(name => `src/${folder}/${name}`),
    );
    const nativeButtonFiles = jsxFiles.filter(
      file => file !== 'src/components/Button/Button.jsx' && /<button\b/.test(read(file)),
    );
    expect(nativeButtonFiles).toEqual([]);
    const config = read('vitest.config.js');
    expect(config).toContain('perFile: true');
    expect(config).toContain('lines: 70');
    expect(JSON.parse(read('package.json')).scripts['test:unit']).toContain('--coverage');
  });

  it('keeps component styles split and declares shared cascade layers', () => {
    const cssFiles = [
      'src/styles/base.css',
      ...['components', 'views', 'modals'].flatMap(folder =>
        readdirSync(`src/${folder}`, { recursive: true })
          .filter(name => name.endsWith('.css'))
          .map(name => `src/${folder}/${name}`),
      ),
    ];
    cssFiles.push('src/styles/app-shell.css', 'src/styles/shared-controls.css');
    const css = cssFiles.map(read).join('\n');
    expect(cssFiles).toContain('src/components/CrewResults/CrewResults.css');
    expect(cssFiles).toContain('src/views/SettingsView/SettingsView.css');
    expect(cssFiles).toContain('src/modals/SafetyGate/SafetyGate.css');
    expect(read('src/components/CrewResults/CrewResults.jsx')).toContain("import './CrewResults.css'");
    expect(read('src/components/BasemapPopup/BasemapPopup.jsx')).toContain("import './BasemapPopup.css'");
    expect(read('src/views/SettingsView/SettingsView.jsx')).toContain("import './SettingsView.css'");
    expect(read('src/modals/SafetyGate/SafetyGate.jsx')).toContain("import './SafetyGate.css'");
    expect(css).toContain('@layer base, components, views, modals, theme, responsive');
    const base = read('src/styles/base.css');
    expect(base.match(/\.app-shell\[data-active-tab='today'\] \.legacy-more/g)).toHaveLength(1);
    expect(read('src/components/SafetyMemo/SafetyMemo.jsx')).toContain("import './SafetyMemo.css'");
  });

  it('keeps every React UI component in its own folder with paired JSX and CSS', () => {
    const jsxFiles = ['components', 'views', 'modals'].flatMap(folder =>
      readdirSync(`src/${folder}`, { recursive: true })
        .filter(name => name.endsWith('.jsx'))
        .map(name => `src/${folder}/${name}`),
    );
    for (const file of jsxFiles) {
      const componentName = file.split('/').pop().replace(/\.jsx$/, '');
      expect(file.split('/').slice(-2, -1)[0]).toBe(componentName);
      expect(read(file)).toContain(`import './${componentName}.css'`);
      expect(() => read(file.replace(/\.jsx$/, '.css'))).not.toThrow();
    }
  });

  it('forbids direct DOM mutation in React UI files', () => {
    const uiFiles = ['components', 'views', 'modals'].flatMap(folder =>
      readdirSync(`src/${folder}`, { recursive: true })
        .filter(name => name.endsWith('.jsx'))
        .map(name => `src/${folder}/${name}`),
    );
    const forbidden = uiFiles.flatMap(file => {
      const source = read(file);
      return [
        /document\.body/,
        /\.classList\.(add|remove|toggle|replace)\(/,
        /\.dataset\.[A-Za-z_$][\w$]*\s*=/,
        /\.setAttribute\(/,
      ]
        .filter(pattern => pattern.test(source))
        .map(pattern => `${file}: ${pattern}`);
    });
    expect(forbidden).toEqual([]);
  });

  it('uses Vite for the client production bundle', () => {
    const pkg = JSON.parse(read('package.json'));
    const config = read('vite.config.js');
    const build = read('scripts/build.mjs');
    expect(pkg.devDependencies.vite).toBeTruthy();
    expect(config).toMatch(/outDir:\s*['"]dist['"]/);
    expect(config).toMatch(/manifest:\s*true/);
    expect(build).toContain('build as viteBuild');
  });

  it('injects the built asset graph into the service worker instead of precaching source modules', () => {
    const sw = read('sw.js');
    const build = read('scripts/build.mjs');
    expect(sw).toMatch(/\/\*__BUILD_ASSETS__\*\/\s*\[\]/);
    expect(sw).not.toContain('/src/app.js');
    expect(sw).not.toContain('/src/main.jsx');
    expect(sw).not.toContain('/src/map.js');
    expect(build).toMatch(/const shell = \[\s*['"]\/['"]/);
    expect(build).toMatch(/sw\.replace\(shellPlaceholder,\s*JSON\.stringify\(uniqueShell\)\)/);
  });

  it('prunes obsolete Vite chunks without clearing unrelated runtime cache entries', () => {
    const sw = read('sw.js');
    expect(sw).toContain("url.pathname.startsWith('/assets/')");
    expect(sw).toContain('!expected.has(url.pathname)');
    expect(sw).toContain('cache.delete(request)');
  });

  it('keeps Cloudflare Worker modules outside the client Vite bundle', () => {
    const build = read('scripts/build.mjs');
    expect(build).toMatch(/resolve\(root,\s*['"]src\/worker['"]\)/);
    expect(build).toMatch(/resolve\(publicDir,\s*['"]src\/worker['"]\)/);
    expect(build).toMatch(/path\.startsWith\(['"]src\/worker\/['"]\)/);
  });

  it('configures sampled Cloudflare error traces', () => {
    const wrangler = read('wrangler.toml');
    expect(wrangler).toContain('binding = "ERROR_TRACES"');
    expect(wrangler).toContain('dataset = "rfm_error_traces"');
    expect(wrangler).toContain('ERROR_TRACE_SAMPLE_RATE = "0.2"');
    expect(wrangler).toContain('upload_source_maps = true');
  });

  it('keeps runtime font URLs aligned with the Cloudflare Worker allowlist', () => {
    const css = read('src/styles/base.css');
    const fonts = [...css.matchAll(/url\('\/rfm\/fonts\/([^']+)'\)/g)]
      .map(match => match[1])
      .sort();
    expect(fonts).toEqual([...RFM_FONTS].sort());
  });

  it('samples representative tiles without scanning entire offline revisions', async () => {
    let calls = 0;
    const getTile = async (_id, z, x, y) => {
      calls++;
      return z === 8 && x === 2 ? null : { data: new Uint8Array([1]).buffer };
    };
    const buildPlan = () => ({
      tiles: [
        { z: 7, x: 1, y: 1 },
        { z: 8, x: 2, y: 2 },
        { z: 9, x: 3, y: 3 },
        { z: 10, x: 4, y: 4 },
      ],
    });
    const result = await inspectOfflineRevisionSamples(
      [
        {
          id: 'race-1',
          name: 'Rally 1',
          geojson: {},
          offlineMap: { ready: true, storageId: 'map-1' },
        },
      ],
      { getTile, buildMapPlan: buildPlan, buildTerrainPlan: buildPlan },
    );
    expect(result.checkedRevisions).toBe(1);
    expect(result.samples[0]).toMatchObject({ kind: 'map', checked: 3, missing: 1 });
    expect(calls).toBe(3);
  });

  it('keeps MapLibre worker and PMTiles as same-origin vendor assets during the Vite migration', () => {
    const app = read('src/hooks/useRfmApp.js');
    const config = read('vite.config.js');
    const build = read('scripts/build.mjs');
    expect(app).toContain("import('/vendor/maplibre-gl/maplibre-gl.mjs')");
    expect(app).toContain("setWorkerUrl('/vendor/maplibre-gl/maplibre-gl-worker.mjs')");
    expect(config).toContain("id.startsWith('/vendor/')");
    expect(build).toContain('node_modules/maplibre-gl/dist');
    expect(build).toContain('node_modules/pmtiles/dist/pmtiles.js');
  });

  it('defines unit, UI, PWA and migration test scripts', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.scripts['test:unit']).toBeTruthy();
    expect(pkg.scripts['test:ui']).toBeTruthy();
    expect(pkg.scripts['test:pwa']).toBeTruthy();
    expect(pkg.scripts['test:migration']).toBeTruthy();
  });

  it('documents offline data ownership and uses one shared tile revision engine', () => {
    const doc = read('docs/architecture/offline-storage.md');
    expect(doc).toContain('Package metadata is the commit record');
    expect(doc).toContain('Other `/api/*` endpoints are network-only');
    expect(read('src/offline-map.js')).toContain("from './tile-revision-downloader.js'");
    expect(read('src/terrain-offline.js')).toContain("from './tile-revision-downloader.js'");
    expect(read('src/offline-map.js')).toContain("from './app/tile-grid.js'");
    expect(read('src/terrain-offline.js')).toContain("from './app/tile-grid.js'");
  });

  it('updates offline map revisions through a staged metadata commit', () => {
    const hook = read('src/hooks/useOfflineStorageControls.js');
    const revision = read('src/app/offline-revision.js');
    expect(hook).toContain('replaceOfflineRevision');
    expect(hook).toMatch(/previousMap:\s*currentPackage\.offlineMap\s*\|\|\s*null/);
    expect(revision.indexOf('await savePackage(next)')).toBeLessThan(
      revision.indexOf('await discardRevision(previous'),
    );
  });
});
