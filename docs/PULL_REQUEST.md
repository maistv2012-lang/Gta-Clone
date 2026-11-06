# Grand Theft Christchurch: real OSM map and resilient browser startup

The existing game now starts in central Christchurch using a bundled real
OpenStreetMap extract. Cathedral Square, Colombo Street and both halves of
Hagley Park are connected. Runtime gameplay uses local assets, without a live
Overpass/CDN dependency.

## Changes

- Add reproducible OSM fetch/conversion tooling, source/license metadata and a
  validated local extract; route traffic on connected directed edges with left
  lane offsets and place pedestrians, parked vehicles, police and activities.
- Preserve existing engine version, vehicles, characters, physics, combat,
  missions and police systems. Keep block-based activities in an explicitly
  fictional Arcade District, with travel to/from Christchurch.
- Vendor the unchanged Three.js r170 engine/addon closure with its MIT license;
  update title/PWA branding and retain OSM attribution.
- Bound map/module initialization, explain failures and keep the menu visible.
  Allocate WebGL at PLAY and check an actual first frame before hiding the menu.
  Probe optional floating-point targets and use direct rendering where needed.
- Validate scope-owned service-worker navigation cache and recover from invalid
  cached HTML. Add desktop/mobile startup, map and rendered-image checks.
- Preserve existing test assertions, adapting setup/timing for simulation time
  and geographic placement. The nested-path startup test now starts its own
  auxiliary static server, removing an undocumented port-8081 prerequisite.
- Document Windows PowerShell startup and diagnosis. Clone/download this branch
  from GitHub after it has been pushed; internal chat file links are insufficient.

## Validation

Current execution results are recorded in `docs/pr-validation/VALIDATION.md`.
The directory also contains captured mobile menu/scene images and console/network
logs. Root server required: `npm start`.

## Limits for review

Physical Galaxy S24 Ultra/Windows hardware and the authenticated ChatGPT Preview
were not available. Mobile emulation and visible first-frame checks do not prove
that the reported handset issue is resolved. OpenStreetMap turn restrictions,
elevations, bridge/tunnel clearance and architectural facades remain simplified.
The existing Android signing/package host configuration is retained; no Android
store publication or deployment is part of this change. Not every seasonal suite
or every mission completion was tested.

Base: `main`; head: `gta-christchurch`. No existing tracked file is deleted and no
merge or replacement of `main` is performed. This document prepares the PR body;
it is not evidence that a remote Pull Request has been created.
