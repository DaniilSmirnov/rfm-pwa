# Offline storage ownership

The client, Service Worker and Pages Worker each own a separate part of offline
state. Keep their keys and lifecycle boundaries explicit when adding caches.

| Data | Owner | Key space | Update and deletion |
| --- | --- | --- | --- |
| Application shell and generated bundles | Service Worker (`sw.js`) | `rfm-companion-v<release>-<codename>` | Precached during install. Activation removes obsolete `rfm-companion-*` caches. Hashed `/assets/*` entries are pruned against the current build manifest. |
| Race images and documents | Client + Service Worker | `rfm-race-assets-v1` | Client downloads materials with the Rally Pack; background refresh may add assets. Clear-all removes this cache. |
| Latest race catalog/details | Service Worker | `rfm-periodic-data-v1` | Network refresh writes a complete successful response. Offline refresh reads the last response. |
| Race packages and tile bytes | Client (`src/db.js`) | IndexedDB `rallyfans-offline`, OPFS root `rfm-maptiles` | Package metadata is the commit record. Tile revisions are staged under a distinct storage ID; only after a full download does the client save the new ID, then delete the previous revision. |
| Push reminder and Wallet state | Pages Worker | Cloudflare KV bindings | Server-owned state; it is independent of browser cache clearing. |

## Tile revision rules

1. A downloader writes only to a staging `storageId`.
2. On success, the caller saves metadata that points at the complete revision.
3. Only after that IndexedDB transaction succeeds may it remove the old revision.
4. Vector-map failures preserve staged tiles so a later attempt can resume. DEM failures remove their incomplete staging revision.
5. A tile revision must not be presented as ready until every planned tile has been stored. `tileCount` and `requested` record the expected inventory; they are not a byte-level integrity checksum.

`src/tile-revision-downloader.js` owns retry, concurrency, progress, reuse,
byte accounting and failure aggregation. Map and terrain modules own source
URLs, tile plans, revision IDs and their different failure cleanup policies.

## Cache boundaries

- `/api/rallyfans/public/*` is cached as race material by the Service Worker.
- Race detail API responses are cached for offline refresh but are not the
  authoritative saved package; IndexedDB is.
- Other `/api/*` endpoints are network-only. This avoids caching personal or
  mutating push and Wallet operations.
- Map and terrain tiles use OPFS/IndexedDB revisions rather than Cache Storage.
- The client clear-all action removes saved packages, tile storage and race
  material cache. It intentionally does not remove server-side Push/Wallet
  registrations.

If any ownership rule changes, update the relevant module and this table in the
same change. Browser lifecycle and migration behavior belongs in Playwright
PWA tests; deterministic planning and commit-order behavior belongs in Vitest.
