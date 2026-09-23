# RallyFans Companion v0.5.0

Cloudflare Pages build based on v0.3.4.3.

## What changed

- Visual language is matched to the public RallyFansMap frontend captured in the supplied HAR: RF Dewi Expanded typography, black/white controls, 24px white race content sheet, dark date labels, race-photo cards and section hierarchy.
- Full race materials are rendered from the public race API: safety leaflet, overlap schedule, organiser map image, declared crews (`lists[]` and legacy `list_crews*`), results (`results[]` and legacy `results_race*`), `how_it_was`, plus uncategorised cached race images.
- All known race material images are included in the offline asset cache when the race is downloaded.
- Images open in a fullscreen viewer.
- Existing offline map, Yandex import, GPS, external navigator buttons and automatic PWA updates are retained.

Deploy the whole directory/ZIP to the same Cloudflare Pages project.

Health check: `/api/health` should report `0.5.0`.


## Web Share

Spectator points can be shared with the system share sheet (`navigator.share`). If Web Share is unavailable, the app falls back to copying the point name, coordinates and Google Maps URL.

## Web Push on Cloudflare Pages

The v0.5.0 push implementation uses the existing Pages Worker. The first version sends an empty Web Push request; the Service Worker creates the visible RallyFans notification locally. This avoids payload encryption while still validating the full iOS/Android Web Push flow.

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
