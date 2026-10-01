import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const release = {
  ...JSON.parse(readFileSync(new URL('../../version.json', import.meta.url), 'utf8')),
  ...JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')),
};
const expectedShell = `rfm-companion-v${String(release.version).replace(/\D/g, '')}-${String(
  release.codename,
)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')}`;

async function waitForWorker(page) {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const worker = registration.active;
    if (!worker) throw new Error('Service worker is not active');
    if (worker.state !== 'activated') {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error(`Service worker stayed ${worker.state}`)),
          5000,
        );
        worker.addEventListener('statechange', () => {
          if (worker.state === 'activated') {
            clearTimeout(timeout);
            resolve();
          }
        });
      });
    }
    return { scope: registration.scope, scriptURL: worker.scriptURL, state: worker.state };
  });
}

async function openMoreTab(page) {
  await page.getByRole('button', { name: 'Меню' }).click();
}

async function openSettings(page) {
  await openMoreTab(page);
  await page.getByRole('button', { name: /Настройки и диагностика/ }).click();
}

test.describe('production service worker lifecycle', () => {
  test.beforeEach(async ({ context }) => {
    // These lifecycle tests cover offline boot and caching. The safety gate
    // itself is covered by the UI suite, so seed consent for the map flow.
    await context.addInitScript(() => {
      const getItem = Storage.prototype.getItem;
      Storage.prototype.getItem = function (key) {
        if (String(key).startsWith('rfm:safety-accepted:v1:')) return 'accepted';
        return getItem.call(this, key);
      };
    });
  });

  test('installs and precaches same-origin application shell', async ({ page }) => {
    await page.goto('/');
    const worker = await waitForWorker(page);
    expect(worker.state).toBe('activated');
    expect(worker.scriptURL).toContain('/sw.js');

    const result = await page.evaluate(async () => {
      const names = await caches.keys();
      const shell = names.find(name => name.startsWith('rfm-companion-v'));
      if (!shell) return { shell: null, paths: [] };
      const cache = await caches.open(shell);
      const paths = (await cache.keys()).map(request => new URL(request.url).pathname);
      return { shell, paths };
    });

    expect(result.shell).toBe(expectedShell);
    expect(result.paths).toContain('/index.html');
    expect(result.paths).toContain('/vendor/maplibre-gl/maplibre-gl.mjs');
    expect(result.paths).toContain('/vendor/maplibre-gl/maplibre-gl.css');
    expect(result.paths).toContain('/vendor/pmtiles/pmtiles.js');
    expect(result.paths.some(path => /^\/assets\/.*\.js$/.test(path))).toBe(true);
    expect(result.paths.some(path => /^\/assets\/.*\.css$/.test(path))).toBe(true);
    expect(result.paths).not.toContain('/src/app.js');
  });

  test('removes stale shell caches during activation', async ({ page }) => {
    await page.goto('/version.json');
    await page.evaluate(async () => {
      await caches.open('rfm-companion-v000-stale');
    });
    await page.goto('/');
    await waitForWorker(page);
    await expect
      .poll(() =>
        page.evaluate(async () => (await caches.keys()).includes('rfm-companion-v000-stale')),
      )
      .toBe(false);
  });

  test('reloads the application shell while fully offline', async ({ page, context }) => {
    await page.goto('/');
    await waitForWorker(page);
    await page.reload();
    await expect(page.locator('body')).toBeVisible();

    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await openSettings(page);
    await expect(page.getByRole('heading', { name: 'Настройки и диагностика' })).toBeVisible();
    await expect(page.locator('#networkBadge')).toHaveCount(0);
  });

  test('reopens the application from cache after the last page is closed and the browser goes offline', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    await waitForWorker(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await openSettings(page);
    await expect(page.getByRole('heading', { name: 'Настройки и диагностика' })).toBeVisible();

    await page.close();
    await context.setOffline(true);

    const reopened = await context.newPage();
    await reopened.goto('/', { waitUntil: 'domcontentloaded' });
    await openSettings(reopened);
    await expect(reopened.getByRole('heading', { name: 'Настройки и диагностика' })).toBeVisible();
    await expect(reopened.locator('#networkBadge')).toHaveCount(0);
  });

  test('preserves the selected theme after an offline cold start', async ({ page, context }) => {
    await page.goto('/');
    await waitForWorker(page);
    await openSettings(page);
    await page.getByRole('button', { name: '☾ Тёмная' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.close();
    await context.setOffline(true);
    const reopened = await context.newPage();
    await reopened.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(reopened.locator('#networkBadge')).toHaveCount(0);
    await expect(reopened.locator('html')).toHaveAttribute('data-theme', 'dark');
    await openSettings(reopened);
    await expect(reopened.getByRole('button', { name: '☾ Тёмная' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(reopened.locator('.settings-screen')).toHaveCSS(
      'background-color',
      'rgba(0, 0, 0, 0)',
    );
    await expect(reopened.locator('body')).toHaveCSS('background-color', 'rgb(17, 19, 24)');
  });

  test('refreshes followed ASMG results in the background and serves the cached standings offline', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    await waitForWorker(page);
    const first = await page.evaluate(async () => {
      const response = await fetch('/api/asmg/race/55/results');
      return { ok: response.ok, data: await response.json() };
    });
    expect(first.ok).toBe(true);
    expect(first.data.eventResults[0].results[0].crew.pilot.lastName).toBe('Гаврилов');

    await page.evaluate(async () => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('rallyfans-offline', 3);
        request.onupgradeneeded = () => {
          const value = request.result;
          if (!value.objectStoreNames.contains('packages'))
            value.createObjectStore('packages', { keyPath: 'id' });
          if (!value.objectStoreNames.contains('maptiles'))
            value
              .createObjectStore('maptiles', { keyPath: 'key' })
              .createIndex('raceId', 'raceId', { unique: false });
          if (!value.objectStoreNames.contains('crewSubscriptions'))
            value.createObjectStore('crewSubscriptions', { keyPath: 'key' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const request = db
          .transaction('crewSubscriptions', 'readwrite')
          .objectStore('crewSubscriptions')
          .put({ key: '55:crew-1', asmgRaceId: '55', crewId: 'crew-1' });
        request.onsuccess = resolve;
        request.onerror = () => reject(request.error);
      });
      db.close();
    });
    const refreshed = page.evaluate(
      () =>
        new Promise(resolve => {
          navigator.serviceWorker.addEventListener(
            'message',
            event => {
              if (event.data?.type === 'RFM_PERIODIC_UPDATE' && event.data.scope === 'crew-results')
                resolve(true);
            },
            { once: true },
          );
          navigator.serviceWorker.ready.then(registration =>
            registration.active.postMessage({ type: 'REFRESH_CREW_RESULTS' }),
          );
          setTimeout(() => resolve(false), 5000);
        }),
    );
    expect(await refreshed).toBe(true);

    await context.setOffline(true);
    const offline = await page.evaluate(async () => {
      const response = await fetch('/api/asmg/race/55/results');
      return { ok: response.ok, data: await response.json() };
    });
    expect(offline.ok).toBe(true);
    expect(offline.data.eventResults[0].results[0].formattedTime).toBe('00:04:15:1');
  });

  test('does not require unpkg resources in the production document', async ({ page }) => {
    const requests = [];
    page.on('request', request => requests.push(request.url()));
    await page.goto('/');
    await waitForWorker(page);
    expect(requests.some(url => url.includes('unpkg.com'))).toBe(false);
  });
});
