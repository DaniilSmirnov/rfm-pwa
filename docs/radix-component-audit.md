# Radix component migration audit

Status: audit-only (2026-09-30)

## Decision

There is no safe, user-visible Radix migration in the current UI component inventory. Keep the existing native controls and revisit Radix only when a component needs behavior that the platform primitive does not provide.

## Findings

### Collapsible sections

`src/components/CollapsibleSection.jsx` renders a native `<details>/<summary>` pair. The same primitive is also used directly by the race-file import disclosure in `src/views/RacesView.jsx`.

The native implementation already provides:

- keyboard activation and the expected `open` state;
- built-in disclosure semantics without additional ARIA wiring;
- progressive behavior when JavaScript is unavailable;
- the existing `.collapsible-section > summary` and `[open]` CSS hooks.

The existing unit and UI coverage exercises the native `open` behavior and summary interaction. Replacing it with Radix Collapsible would require recreating these semantics and would change the DOM hooks used by the current styles and tests, without a demonstrated accessibility or interaction improvement. No migration is recommended.

### Main navigation

The four controls rendered in `src/views/App.jsx` are top-level route-like navigation:

- activation changes the `?tab=` URL parameter with `history.pushState`;
- browser back/forward is handled through `popstate`;
- scroll positions are saved and restored per screen;
- each destination is a page-level screen rather than a panel in one tablist.

These controls should remain navigation controls. Radix Tabs would impose tablist/tab/tabpanel semantics on page navigation and would make the URL/history and scroll behavior harder to reason about. The existing `aria-current="page"` is the appropriate signal for navigation. No Radix Tabs migration is recommended.

### Other tab candidates

The repository has no elements with `role="tablist"`, `role="tab"`, or `aria-selected`. Result-stage and class filters are native select controls, and the results modal is a dialog. They are not Radix Tabs candidates.

## Follow-up criteria

Re-evaluate Radix when a new component needs one of the following:

- a true in-page tablist with panel activation and explicit keyboard roving/focus behavior;
- a controlled disclosure whose animation, focus management, or nested interactions cannot be provided by native `details`;
- a project-wide primitive layer where the dependency is already justified by multiple components.

Any future migration must preserve the current test IDs, class names, accessible names, URL behavior, and visual styles, and should add focused unit and UI coverage before changing the DOM contract.