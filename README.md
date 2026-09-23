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
