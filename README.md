# RallyFans Companion

Cloudflare Pages build based on v0.3.4.3.

## What changed

- Visual language is matched to the public RallyFansMap frontend captured in the supplied HAR: RF Dewi Expanded typography, black/white controls, 24px white race content sheet, dark date labels, race-photo cards and section hierarchy.
- Full race materials are rendered from the public race API: safety leaflet, overlap schedule, organiser map image, declared crews (`lists[]` and legacy `list_crews*`), results (`results[]` and legacy `results_race*`), `how_it_was`, plus uncategorised cached race images.
- All known race material images are included in the offline asset cache when the race is downloaded.
- ASMG race standings can be loaded, searched and followed per crew; followed results are cached by the Service Worker for offline use.
- Images open in a fullscreen viewer.
- Existing offline map, Yandex import, GPS, external navigator buttons and automatic PWA updates are retained.

Build the production artifact with:

```bash
npm run build
```

The build requires Node.js 20.19 or newer. Vite is deliberately introduced before React so build/deploy, Service Worker upgrades and offline compatibility can be validated independently of the UI migration.

Deploy only the generated `dist/` directory to Cloudflare Pages. The client is bundled by Vite into hashed JS/CSS assets. MapLibre/PMTiles remain same-origin vendor assets for now, while the Pages Worker entrypoint and `src/worker/*` stay outside the client bundle. The post-build step generates the Service Worker app-shell precache from the actual `dist/` output and validates that tests, source client modules, GitHub metadata, README files, samples and other development tooling do not leak into production.

For Cloudflare Pages Git integration use:

- Build command: `npm run build`
- Build output directory: `dist`
- Production branch: `main`
- Preview branch: `develop`

`wrangler.toml` also pins `pages_build_output_dir = "./dist"` for CLI/config-driven deployments.

Release metadata lives only in `version.json`; the build injects it into the footer, Service Worker cache namespace and `/api/health`.


## Web Share

Spectator points can be shared with the system share sheet (`navigator.share`). If Web Share is unavailable, the app falls back to copying the point name, coordinates and Google Maps URL.

## Web Push on Cloudflare Pages

The current push implementation uses the existing Pages Worker. The first version sends an empty Web Push request; the Service Worker creates the visible RallyFans notification locally. This avoids payload encryption while still validating the full iOS/Android Web Push flow.

Generate a VAPID key pair locally:

```bash
node scripts/generate-vapid.mjs
```

Configure the following Cloudflare Pages variables/secrets:

- `VAPID_PUBLIC_KEY` — public uncompressed P-256 key from the script.
- `VAPID_PRIVATE_JWK` — private JWK from the script. Store as a secret.
- `VAPID_SUBJECT` — contact URI, for example `mailto:you@example.com`.
- `PUSH_ADMIN_TOKEN` — optional secret used by the broadcast endpoint.
- `PUSH_SUBSCRIPTIONS` — optional KV namespace binding. Without KV, per-device test pushes still work, but subscriptions are not stored for broadcasts.

Available Pages endpoints:

- `GET /api/push/config`
- `POST /api/push/subscribe`
- `POST /api/push/unsubscribe`
- `POST /api/push/test`
- `POST /api/push/broadcast` — requires `Authorization: Bearer <PUSH_ADMIN_TOKEN>` and the KV binding.

On iOS, Web Push is intended for the installed Home Screen PWA. Permission is requested only after the user presses the notification button.


## Scheduled race reminders

When Web Push is enabled, saved/downloaded races are scanned for parseable future schedule events. The PWA schedules a reminder 30 minutes before each event via `POST /api/push/schedule`. Reminders are stored in the `PUSH_SUBSCRIPTIONS` KV namespace and are replaced when the same race is re-scheduled, so updating an offline race refreshes its reminder queue.

The Pages project exposes a protected dispatcher:

```text
GET /api/push/run-due?token=<PUSH_ADMIN_TOKEN>
```

or:

```text
POST /api/push/run-due
Authorization: Bearer <PUSH_ADMIN_TOKEN>
```

Call this endpoint once per minute from a scheduler. Cloudflare Pages itself does not support Cron Triggers; Cron Triggers are a Workers feature. A tiny Worker cron or any external HTTP scheduler can call this endpoint while all subscription storage, reminder state and push sending remain in the Pages project.

When a reminder is due, Pages stores the notification text temporarily, sends an empty Web Push, and the Service Worker resolves the pending message from `/api/push/pending`. If that lookup fails, the Service Worker shows the generic RallyFans fallback notification.

Current parser accepts schedule dates such as `dd.mm.yyyy`, `dd/mm/yyyy`, `dd-mm-yyyy`, and `dd.mm`/`dd/mm`/`dd-mm` when a race year can be inferred. Unparseable schedule entries are skipped rather than guessed.


### Per-stage notification subscriptions

Scheduled race reminders are opt-in per special stage. The schedule UI shows a `🔔 Уведомлять` control for detected `СУ`/`SS` entries. Preferences are stored locally in the PWA by race and stage, and only subscribed stages produce opening/closing reminders at T-60, T-30 and T-15 minutes. Updating the choice rebuilds that race's server-side reminder queue without duplicates.


### ASMG crew results

Each saved race can load the public ASMG results table. The ASMG event ID defaults to the Rally Fans Map race ID and can be corrected in the results panel when the two catalogs use different IDs. The latest available special stage is selected initially; the first three classified crews are shown, with search for the remaining crews. Expanding a crew shows its place, class, time, gaps, speed, car and penalties.

Following a crew stores the subscription locally in IndexedDB. The Service Worker caches the complete ASMG standings response when it is opened and refreshes standings for followed events through Periodic Background Sync (15-minute minimum interval where supported). The last successful response remains available offline. Browser scheduling is best effort and controlled by the browser.


### Apple Wallet stage passes

On iOS, each detected special stage shows two side-by-side actions: push notifications and Apple Wallet. A Wallet pass uses a stable serial number per race + stage, stores the stage schedule plus inferred start/finish coordinates, and is refreshed from the PWA whenever the saved race is opened.

The Pages worker implements the Wallet update web-service protocol under `/api/wallet/v1`: device registration/unregistration, listing updated serial numbers, fetching an updated pass, and Wallet logging. Pass state is stored in `WALLET_STORE` KV when bound, otherwise `PUSH_SUBSCRIPTIONS` is reused.

A valid `.pkpass` must be signed with an Apple Pass Type ID certificate. Configure `WALLET_PASS_TYPE_IDENTIFIER`, `WALLET_TEAM_IDENTIFIER`, and `WALLET_SIGNER_URL`. The signer endpoint receives `{ pass, state, assets }` as JSON, where `pass` is the complete dynamic event-ticket payload (including time relevance and inferred start/finish locations), and must return `application/vnd.apple.pkpass`. Optional `WALLET_SIGNER_TOKEN` is sent as a Bearer token.

For automatic Wallet update delivery, configure `WALLET_PUSH_PROVIDER_URL` (and optionally `WALLET_PUSH_PROVIDER_TOKEN`). The worker sends the pass type identifier, serial number, and registered Wallet push tokens to that provider after a stored pass changes. Without a push provider, Wallet's standard update web service and manual refresh still work, but automatic delivery is not triggered by this worker.


### Broadcast push

Send a full broadcast notification to every stored Web Push subscription with the admin token:

```bash
curl -X POST https://pwa-demo-f14.pages.dev/api/push/broadcast \\
  -H "Authorization: Bearer $PUSH_ADMIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Rally Fans Map",
    "body": "Расписание обновлено",
    "url": "/",
    "tag": "schedule-update",
    "ttlSeconds": 21600
  }'
```

`body` is required. `title`, `url`, `tag`, and `ttlSeconds` are optional. The worker stores the notification content in the per-subscription pending slot before sending the empty Web Push wake-up, so the service worker can display the requested title/body and open the supplied same-origin path on tap.


### Rich offline basemap (0.5.5 Sortovala)

Offline vector tiles are rendered semantically by default instead of as generic geometry. The map now distinguishes road hierarchy, land use/natural areas, water, buildings, rail/transit, boundaries, physical features and POIs. Labels are extracted directly from downloaded vector-tile properties for settlements, roads and refs, POIs, peaks/elevation, water, land features, transit and named buildings, with zoom-aware decluttering. This uses data already present in the downloaded PMTiles and does not require a separate online API.


## Architecture and tests

The browser entrypoint is intentionally kept as orchestration rather than a home for every feature. Domain logic lives under `src/app/`:

- `catalog-dates.js` — race date selection/window rules.
- `schedule.js` — stage parsing, race timezones and reminder generation.
- `preferences.js` — per-race stage/Wallet preferences.
- `geo.js` — compass/distance math.
- `local-points.js` — favourites and saved-car persistence.
- `export.js` — offline GPX/export helpers.
- `sanitize.js` — allow-list sanitization for upstream rich HTML.
- `pwa.js` — installed-vs-browser launch and install UI.
- `runtime.js` — Service Worker updates, persistent storage and periodic sync.
- `push-client.js` and `wallet-client.js` — browser-side integrations.

Cloudflare Pages Advanced Mode keeps `_worker.js` as a small router. Server-side code is split under `src/worker/` into HTTP helpers, Web Push/reminders, Wallet, and upstream proxy modules.

Install the locked test/runtime dependencies locally:

```bash
npm ci
npx playwright install
```

Run unit tests:

```bash
npm run test:unit
```

Run the Playwright UI suite against the local static server managed by Playwright:

```bash
npm run test:ui
```

The UI suite runs desktop Chromium, mobile Chromium and iPhone WebKit projects. To test an already deployed Pages preview instead of starting the local server:

```bash
PLAYWRIGHT_BASE_URL=https://your-preview.pages.dev npm run test:ui
```

For a faster Chromium-only pass:

```bash
npm run test:ui:chromium
```

Run the production Service Worker lifecycle suite:

```bash
npm run test:pwa
```

Release version and codename live only in `version.json`. `npm run build` injects them into the generated shell, manifest, Service Worker cache namespace and health endpoint.

GitHub Actions runs the Vitest unit suite and the full Playwright suite on pull requests and pushes to `develop` and `main`. Playwright HTML reports are uploaded on every UI run, and failure artifacts are retained for debugging.
