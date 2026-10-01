# Four-tab RFM redesign: implementation plan

## Goal

Reorganize RFM as an offline-first rally-day companion with four primary tabs:
`today`, `map`, `results`, and `more`. The selected rally is global context in
the header. Rally Pack discovery and storage management live under `more`.

This is a reorganization of the current product. Preserve the existing offline
map, Rally Pack, smart updates, elevation, results, safety, notifications,
settings, and diagnostics capabilities.

## Current implementation points

- `src/react/App.jsx` owns tab navigation, Today and More content, map lifecycle,
  and portals into the legacy HTML sections.
- `src/react/useRfmApp.js` owns `currentPackage`, saved packages, package
  selection, favorites for map points, downloads, and refresh actions.
- `index.html` still contains the legacy sections for race catalog, saved packs,
  race details, settings, and the map.
- `src/styles.css` contains tab-specific visibility rules and responsive styles.
- Crew results already have a standalone full-screen modal and class filtering.

These shared entry points should be stabilized before parallel tab work so each
tab can be implemented behind a small component boundary.

## Phase 1 — shared foundation (sequential)

### 1. Four-tab shell and navigation contract

- Establish the only primary destinations as `today`, `map`, `results`, `more`.
- Keep URL deep links and browser back/forward behavior working; unknown tab
  values resolve to `today`.
- Expose navigation callbacks for cross-tab actions (for example, Today → Map
  with a selected stage, or Results → a crew detail).
- Keep shell, tab bar, safe-area handling, and shared page width outside the
  individual tab components.
- Give each tab an isolated React view module and stylesheet. Tab modules must
  not edit `App.jsx`, `useRfmApp.js`, `index.html`, or shared CSS during parallel
  implementation.

### 2. Global current-rally context

- Use `app.currentPackage` as the single selected-rally source of truth.
- Add an accessible header selector listing saved Rally Packs, with a clear
  empty state and a route to race management when there are no saved packs.
- Selecting a rally calls the existing `app.selectPackage(id)` path, so map,
  schedule, results, favorites, and offline status change together.
- Keep race search/download/update/delete/storage management in More. Do not
  duplicate package-management state in tab components.
- Preserve the current selection across reloads using the existing persistence
  behavior; explicitly test selection when a package is removed or unavailable.

### 3. Shared UI and state contracts

- Define the shared tab props from the existing app controller rather than
  creating tab-specific copies of domain state.
- Reserve common state/actions for selected rally, network/offline state,
  favorite crews, sync-change summary, selected stage/point, and navigation.
- Standardize state labels and visual tokens: `LIVE`, `Завершён`, `Ожидается`,
  `Изменилось`, `Доступно офлайн`; define light/dark values and focus/touch
  states in shared styles.
- Keep sync-change data in a small domain module with unit tests when the data
  contract is introduced. Do not make tabs parse update payloads independently.

### 4. Shared test helpers

- Add stable selectors and reusable fixtures for saved and unsaved rallies,
  crew standings, stage schedule, offline state, and pending updates.
- Add unit coverage for route parsing and shared state transformations.
- Keep UI tests focused on cross-tab contracts: tab navigation, global rally
  selection, offline visibility, and route intents.

## Phase 2 — tab workstreams (parallel after Phase 1)

Each workstream owns its tab component, tab stylesheet, and focused tests. The
four agents must not edit the shared shell, global context selector, shared
domain modules, or the same fixture files. Integration changes stay with the
coordinator.

### Today

- Race-day dashboard: active stage and state, first start, current/next crew,
  favorite crews, recent events, important changes, and offline readiness.
- Before the event, prioritize countdown and the next schedule item.
- CTA opens Map with the relevant stage selected.

### Map

- Stage lines and states; spectator points; parking; closures; start/finish;
  service; terrain/elevation.
- Point detail includes photo, description/rating, distance from stage start,
  and walking distance from parking when available.
- While a stage is live, show crews passed, next crews, favorites and arrival
  estimates. Mark estimates clearly when there is no live GPS feed.
- Preserve navigation priority: MAPS.ME, Yandex, Google Maps, generic share.

### Results

- First-class overall/class filters and search by crew, driver, or number.
- Preserve true ranking while visually surfacing favorites.
- Crew details include car/class, overall place/gap, and stage place/time/gap.
- Compare crews and gap/position graphs remain a later enhancement.

### More

- Event information, full schedule, participants, documents, Rally Pack
  discovery/management, safety, notifications, theme, settings, diagnostics.
- Administrative content only; no duplicate live results card.

## Phase 3 — integration and verification

- Wire tab views to the shared app context and navigation intents.
- Verify a selected rally change updates all four tabs and remains usable offline.
- Verify Today → Map, selected point → navigation, Results → crew detail, and
  More → race management flows.
- Run unit tests first, then UI/PWA tests relevant to changed behavior.
- Validate narrow mobile and wide/Fold layouts in light and dark themes.

## Acceptance criteria

- Four primary tabs are reachable, deep-linkable, and keyboard/screen-reader
  accessible.
- The current rally has one global selection; changing it updates all tabs.
- A newly downloaded Rally Pack remains usable offline, including map, schedule,
  results, and its image when available in cache.
- A background update communicates meaningful changes and preserves unread
  state until viewed.
- Existing safety gate, storage controls, elevation, diagnostics, and PWA
  reliability flows remain available.
- New state transformations have unit tests; cross-tab behavior has focused UI
  tests.
