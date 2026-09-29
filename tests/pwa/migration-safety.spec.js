import { test, expect } from '@playwright/test';

async function waitForAppWorker(page) {
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
    return worker.scriptURL;
  });
}

async function openTab(page, label) {
  if (label === 'Гонки') {
    await page.getByRole('button', { name: 'Ещё', exact: true }).click();
    await page.getByRole('button', { name: 'Гонки и Rally Pack' }).click();
    return;
  }
  await page.getByRole('button', { name: label, exact: true }).click();
  if (label === 'Карта') {
    const gate = page.locator('.safety-gate');
    if (await gate.isVisible()) {
      await gate.locator('.safety-gate-content').evaluate(node => {
        node.scrollTop = node.scrollHeight;
        node.dispatchEvent(new Event('scroll'));
      });
      await expect(gate.locator('.safety-accept')).toBeEnabled();
      await gate.locator('.safety-accept').click();
      await gate.waitFor({ state: 'hidden' });
    }
  }
}

async function openMapTools(page) {
  await page.getByRole('button', { name: 'Инструменты карты' }).click();
}

async function seedSavedRace(
  page,
  { offlineMap = false, withAssets = false, terrain = false } = {},
) {
  await page.evaluate(
    async ({ offlineMap, withAssets, terrain }) => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('rallyfans-offline');
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains('packages'))
            database.createObjectStore('packages', { keyPath: 'id' });
          if (!database.objectStoreNames.contains('maptiles')) {
            const store = database.createObjectStore('maptiles', { keyPath: 'key' });
            store.createIndex('raceId', 'raceId', { unique: false });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const storageId = 'race-901@e2e-map';
      const pkg = {
        id: 'race-901',
        raceId: 901,
        name: 'Offline Migration Rally',
        savedAt: '2026-09-24T10:00:00.000Z',
        size: 512,
        source: 'e2e',
        original: {
          id: 901,
          name: 'Offline Migration Rally',
          schedule: [],
          coordinates: [{ id: 1, name: 'Offline spectator point', coordinates: '61.700,30.690' }],
          results: [],
          lists: [],
          how_it_was: '',
          ...(withAssets
            ? {
                image: 'hero.svg',
                mapsimg: 'organizer-map.svg',
                safety_leaflet: 'safety.svg',
              }
            : {}),
        },
        summary: {
          category: 'test',
          stage: 'migration',
          status: 'saved',
          dates: '26.09.2026',
          city: 'Sortavala',
        },
        assetNames: withAssets ? ['hero.svg', 'organizer-map.svg', 'safety.svg'] : [],
        geojson: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: { kind: 'race-point', name: 'Offline spectator point' },
              geometry: { type: 'Point', coordinates: [30.69, 61.7] },
            },
          ],
        },
        ...(offlineMap
          ? {
              offlineMap: {
                ready: true,
                storageId,
                tileCount: 1,
                bytes: 0,
                minZoom: 6,
                maxZoom: 14,
                bounds: { minLon: 30.5, minLat: 61.5, maxLon: 30.9, maxLat: 61.9 },
                vectorLayers: [{ id: 'roads', fields: {} }],
                downloadedAt: '2026-09-24T10:00:00.000Z',
              },
            }
          : {}),
        ...(terrain
          ? {
              terrain: {
                ready: true,
                storageId: 'race-901@terrain@e2e',
                tileCount: 1,
                bytes: 4,
                minZoom: 6,
                maxZoom: 12,
                tileSize: 512,
                encoding: 'terrarium',
                bounds: { minLon: 30.5, minLat: 61.5, maxLon: 30.9, maxLat: 61.9 },
                downloadedAt: '2026-09-24T10:00:00.000Z',
              },
            }
          : {}),
      };

      await new Promise((resolve, reject) => {
        const tx = db.transaction('packages', 'readwrite');
        tx.objectStore('packages').put(pkg);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      if (offlineMap) {
        await new Promise((resolve, reject) => {
          const tx = db.transaction('maptiles', 'readwrite');
          tx.objectStore('maptiles').put({
            key: `${storageId}:14:9588:4599`,
            raceId: storageId,
            z: 14,
            x: 9588,
            y: 4599,
            data: new ArrayBuffer(0),
            bytes: 0,
          });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      }

      if (withAssets) {
        const cache = await caches.open('rfm-race-assets-v1');
        const svg = name =>
          `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="white"/><text x="1" y="12" font-size="4">${name}</text></svg>`;
        for (const name of ['hero.svg', 'organizer-map.svg', 'safety.svg']) {
          await cache.put(
            `/api/rallyfans/public/${encodeURIComponent(name)}`,
            new Response(svg(name), { status: 200, headers: { 'content-type': 'image/svg+xml' } }),
          );
        }
      }

      localStorage.setItem(
        'rfm-favorite-points-v1',
        JSON.stringify({
          'race-901': [
            {
              name: 'Offline spectator point',
              lat: 61.7,
              lon: 30.69,
            },
          ],
        }),
      );
    },
    { offlineMap, withAssets, terrain },
  );
}

async function registerHarnessWorker(page, script) {
  return page.evaluate(async script => {
    const previous = navigator.serviceWorker.controller?.scriptURL || null;
    const registration = await navigator.serviceWorker.register(script, {
      scope: '/migration-test/',
    });
    await navigator.serviceWorker.ready;
    if (registration.installing) {
      await new Promise(resolve => {
        const worker = registration.installing;
        const done = () => worker.state === 'activated' && resolve();
        worker.addEventListener('statechange', done);
        done();
      });
    }
    if (
      !navigator.serviceWorker.controller ||
      navigator.serviceWorker.controller.scriptURL === previous
    ) {
      await new Promise(resolve => {
        const timeout = setTimeout(resolve, 5000);
        navigator.serviceWorker.addEventListener(
          'controllerchange',
          () => {
            clearTimeout(timeout);
            resolve();
          },
          { once: true },
        );
      });
    }
    return navigator.serviceWorker.controller?.scriptURL || null;
  }, script);
}

test.describe('PWA migration safety', () => {
  test.beforeEach(async ({ context }) => {
    // Keep migration tests focused on data and offline map continuity. Consent
    // requirements are asserted separately in the safety-gate UI tests.
    await context.addInitScript(() => {
      const getItem = Storage.prototype.getItem;
      Storage.prototype.getItem = function (key) {
        if (String(key).startsWith('rfm:safety-accepted:v1:')) return 'accepted';
        return getItem.call(this, key);
      };
    });
  });

  test('saved Rally Pack survives a cold start with the browser offline', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    await waitForAppWorker(page);
    await seedSavedRace(page);

    await page.close();
    await context.setOffline(true);

    const reopened = await context.newPage();
    await reopened.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(reopened.locator('#networkBadge')).toHaveCount(0);
    await openTab(reopened, 'Гонки');
    await expect(reopened.locator('#packageList')).toContainText('Offline Migration Rally');
    await openTab(reopened, 'Карта');
    await expect(reopened.locator('#raceDetails')).toBeVisible();
    await openTab(reopened, 'Карта');
    await expect(reopened.locator('#pointList')).toContainText('Offline spectator point');
    await expect(reopened.locator('#favoritesList')).toContainText('Offline spectator point');
  });

  test('reopens a saved offline map after restart, reads local tiles and restores race points', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    await waitForAppWorker(page);
    await seedSavedRace(page, { offlineMap: true });

    await page.close();
    await context.setOffline(true);

    const requests = [];
    const reopened = await context.newPage();
    reopened.on('request', request => requests.push(request.url()));
    await reopened.goto('/', { waitUntil: 'domcontentloaded' });

    await openTab(reopened, 'Гонки');
    await reopened.locator('#packageList .downloaded-race-open').first().click();
    await openTab(reopened, 'Карта');

    await expect(reopened.locator('#mapSubtitle')).toContainText('ИСПОЛЬЗУЕТСЯ офлайн-подложка');
    await expect(reopened.locator('.maplibregl-canvas')).toBeVisible();
    await expect(
      reopened.locator('.map-race-label').filter({ hasText: 'Offline spectator point' }),
    ).toBeVisible();
    expect(requests.some(url => url.includes('/api/basemap.pmtiles'))).toBe(false);
    await openTab(reopened, 'Ещё');
    await reopened.getByRole('button', { name: /Настройки и диагностика/ }).click();
    await expect(reopened.locator('.settings-diagnostics')).toContainText('Состояние карты');
    await expect(reopened.locator('.settings-diagnostics')).toBeVisible();
  });

  test('restores race points and offline basemap when terrain metadata is enabled after restart', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    await waitForAppWorker(page);
    await seedSavedRace(page, { offlineMap: true, terrain: true });

    await page.close();
    await context.setOffline(true);

    const reopened = await context.newPage();
    await reopened.goto('/', { waitUntil: 'domcontentloaded' });
    await openTab(reopened, 'Гонки');
    await reopened.locator('#packageList .downloaded-race-open').first().click();
    await openTab(reopened, 'Карта');

    await expect(reopened.locator('#mapSubtitle')).toContainText('ИСПОЛЬЗУЕТСЯ офлайн-подложка');
    await expect(reopened.locator('#mapSubtitle')).toContainText('рельеф ✓');
    await expect(reopened.locator('.terrain-mode-button')).toBeVisible();
    await expect(
      reopened.locator('.map-race-label').filter({ hasText: 'Offline spectator point' }),
    ).toBeVisible();
  });

  test('cached Rally Pack materials remain available after an offline restart', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    await waitForAppWorker(page);
    await seedSavedRace(page, { withAssets: true });

    await page.close();
    await context.setOffline(true);

    const reopened = await context.newPage();
    await reopened.goto('/', { waitUntil: 'domcontentloaded' });
    await openTab(reopened, 'Гонки');
    await expect(reopened.locator('#packageList')).toContainText('Offline Migration Rally');
    await openTab(reopened, 'Карта');
    await expect(reopened.locator('#raceDetails')).toBeVisible();

    const hero = reopened.locator('#raceDetails .race-hero');
    const heroImageUrl = await hero.evaluate(element => {
      const value = getComputedStyle(element).backgroundImage;
      return value.match(/^url\(["']?(.*?)["']?\)$/)?.[1] || '';
    });
    expect(heroImageUrl).toContain('/api/rallyfans/public/hero.svg');
    const heroImage = await reopened.evaluate(async url => {
      const image = new Image();
      image.src = url;
      await image.decode();
      return { complete: image.complete, naturalWidth: image.naturalWidth };
    }, heroImageUrl);
    expect(heroImage.complete).toBe(true);
    expect(heroImage.naturalWidth).toBeGreaterThan(0);

    await openTab(reopened, 'Ещё');
    await reopened.getByRole('button', { name: 'Документы и материалы' }).click();
    const organizer = reopened
      .locator('.react-tab-content .race-material')
      .filter({ hasText: 'КАРТА ОРГАНИЗАТОРА' });
    await organizer.locator('summary').click();
    const mediaImage = organizer.locator('img').first();
    await expect(mediaImage).toBeVisible();
    await expect
      .poll(() => mediaImage.evaluate(img => img.complete && img.naturalWidth > 0))
      .toBe(true);

    const cached = await reopened.evaluate(async () => {
      const cache = await caches.open('rfm-race-assets-v1');
      return Boolean(await cache.match('/api/rallyfans/public/organizer-map.svg'));
    });
    expect(cached).toBe(true);
  });

  test('offline export still produces Rally Pack GeoJSON and GPX files', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    await waitForAppWorker(page);
    await seedSavedRace(page);

    await page.close();
    await context.setOffline(true);

    const reopened = await context.newPage();
    await reopened.goto('/', { waitUntil: 'domcontentloaded' });
    await openTab(reopened, 'Карта');
    await openMapTools(reopened);

    const geoDownloadPromise = reopened.waitForEvent('download');
    await reopened.locator('#exportGeoJsonBtn').click();
    const geoDownload = await geoDownloadPromise;
    expect(geoDownload.suggestedFilename()).toMatch(/\.geojson$/);
    const geoStream = await geoDownload.createReadStream();
    const geoChunks = [];
    for await (const chunk of geoStream) geoChunks.push(chunk);
    const geojson = JSON.parse(Buffer.concat(geoChunks).toString('utf8'));
    expect(
      geojson.features.some(feature => feature?.properties?.name === 'Offline spectator point'),
    ).toBe(true);

    const gpxDownloadPromise = reopened.waitForEvent('download');
    await reopened.locator('#exportGpxBtn').click();
    const gpxDownload = await gpxDownloadPromise;
    expect(gpxDownload.suggestedFilename()).toMatch(/\.gpx$/);
    const gpxStream = await gpxDownload.createReadStream();
    const gpxChunks = [];
    for await (const chunk of gpxStream) gpxChunks.push(chunk);
    const gpx = Buffer.concat(gpxChunks).toString('utf8');
    expect(gpx).toContain('Offline spectator point');
    expect(gpx).toContain('<gpx');
  });

  test('switching from online to offline keeps the opened saved race usable without reload', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    await waitForAppWorker(page);
    await seedSavedRace(page);
    await page.reload({ waitUntil: 'domcontentloaded' });

    await openTab(page, 'Гонки');
    await page.locator('#packageList .downloaded-race-open').first().click();
    await expect(page.locator('#raceTitle')).toHaveText('Offline Migration Rally');
    await expect(page.locator('#networkBadge')).toHaveCount(0);

    await context.setOffline(true);

    await expect(page.locator('#networkBadge')).toHaveCount(0);
    await openTab(page, 'Карта');
    await expect(page.locator('#raceDetails')).toBeVisible();
    await expect(page.locator('#pointList')).toContainText('Offline spectator point');
    await expect(page.locator('#favoritesList')).toContainText('Offline spectator point');

    await openMapTools(page);
    await page.getByText('ГДЕ СМОТРЕТЬ?').click();
    await page
      .locator('.point-row')
      .filter({ hasText: 'Offline spectator point' })
      .locator('.point-row-copy')
      .click();
    await expect(page.locator('#pointActions')).toBeVisible();
    await page.getByRole('button', { name: 'Показать детали' }).click();
    await expect(page.locator('#pointCoords')).toContainText('61.700000');
  });

  test('saved offline data can be deleted while the device has no network', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    await waitForAppWorker(page);
    await seedSavedRace(page, { offlineMap: true });

    await page.close();
    await context.setOffline(true);
    const reopened = await context.newPage();
    await reopened.goto('/', { waitUntil: 'domcontentloaded' });

    await openTab(reopened, 'Гонки');
    await expect(reopened.locator('#packageList')).toContainText('Offline Migration Rally');
    reopened.once('dialog', dialog => dialog.accept());
    await reopened.locator('#clearBtn').click();

    await openTab(reopened, 'Гонки');
    await expect(reopened.locator('#packageList')).toContainText('Скачанных гонок пока нет');
    await expect(reopened.locator('#raceDetails')).toBeHidden();

    const state = await reopened.evaluate(async () => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('rallyfans-offline');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return new Promise((resolve, reject) => {
        const tx = db.transaction(['packages', 'maptiles'], 'readonly');
        const packages = tx.objectStore('packages').getAll();
        const tiles = tx.objectStore('maptiles').getAll();
        tx.oncomplete = () =>
          resolve({
            packages: packages.result?.length || 0,
            tiles: tiles.result?.length || 0,
            favorites: localStorage.getItem('rfm-favorite-points-v1'),
          });
        tx.onerror = () => reject(tx.error);
      });
    });

    expect(state.packages).toBe(0);
    expect(state.tiles).toBe(0);
    expect(state.favorites).toBeNull();
  });

  test('a newly installed service worker takes control of an already open client', async ({
    page,
  }) => {
    await page.goto('/migration-test/migration-harness.html');
    const first = await registerHarnessWorker(page, '/migration-test/sw-upgrade-v1.js');
    expect(first).toContain('/migration-test/sw-upgrade-v1.js');
    await expect
      .poll(() => page.evaluate(() => fetch('/__sw-version').then(r => r.text())))
      .toBe('v1');

    const controllerChanges = await page.evaluate(async () => {
      let changes = 0;
      navigator.serviceWorker.addEventListener('controllerchange', () => changes++);
      const registration = await navigator.serviceWorker.register(
        '/migration-test/sw-upgrade-v2.js',
        { scope: '/migration-test/' },
      );
      if (registration.installing) {
        await new Promise((resolve, reject) => {
          const worker = registration.installing;
          const timeout = setTimeout(() => reject(new Error('v2 worker did not activate')), 5000);
          worker.addEventListener('statechange', () => {
            if (worker.state === 'activated') {
              clearTimeout(timeout);
              resolve();
            }
          });
        });
      }
      await new Promise(resolve => setTimeout(resolve, 50));
      return changes;
    });

    expect(controllerChanges).toBeGreaterThanOrEqual(1);
    await expect
      .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL || ''))
      .toContain('/migration-test/sw-upgrade-v2.js');
    await expect
      .poll(() => page.evaluate(() => fetch('/__sw-version').then(r => r.text())))
      .toBe('v2');
  });

  test('application data survives a service worker version upgrade', async ({ page }) => {
    await page.goto('/migration-test/migration-harness.html');
    await registerHarnessWorker(page, '/migration-test/sw-upgrade-v1.js');

    await seedSavedRace(page);
    const before = await page.evaluate(async () => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('rallyfans-offline');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return new Promise((resolve, reject) => {
        const tx = db.transaction('packages', 'readonly');
        const request = tx.objectStore('packages').get('race-901');
        request.onsuccess = () =>
          resolve({
            name: request.result?.name,
            favorites: localStorage.getItem('rfm-favorite-points-v1'),
          });
        request.onerror = () => reject(request.error);
      });
    });

    await registerHarnessWorker(page, '/migration-test/sw-upgrade-v2.js');
    await expect
      .poll(() => page.evaluate(() => fetch('/__sw-version').then(r => r.text())))
      .toBe('v2');

    const after = await page.evaluate(async () => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('rallyfans-offline');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return new Promise((resolve, reject) => {
        const tx = db.transaction('packages', 'readonly');
        const request = tx.objectStore('packages').get('race-901');
        request.onsuccess = () =>
          resolve({
            name: request.result?.name,
            favorites: localStorage.getItem('rfm-favorite-points-v1'),
          });
        request.onerror = () => reject(request.error);
      });
    });

    expect(after).toEqual(before);
    expect(after.name).toBe('Offline Migration Rally');
    expect(after.favorites).toContain('Offline spectator point');
  });
});
