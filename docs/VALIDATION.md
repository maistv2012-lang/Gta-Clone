# Christchurch validation — 6 November 2026

## Real data and reproducibility

`npm run map:fetch` succeeded. Overpass returned HTTP 406 even after its domain
was allowed, so the importer now falls back to the official OpenStreetMap map
API. Twelve serial tiles stay below that API's 50,000-node limit. Objects are
merged by type/ID/version; park relation members are completed before conversion.
TLS verification and the platform proxy remain enabled.

The bundled `data/christchurch.json` contains 9,139 highway ways, 11,353 areas,
27,473 directed driving edges and 79,536 walking edges. It records the source
URL, retrieval date, geographic origin and ODbL license. The source is real OSM,
not the synthetic fixture. API tiles are current reads, not an atomic snapshot;
`retrievedAt` is acquisition time and the Overpass `timestamp` field is null.

`npm run test:map:data` validates the source, named places, every driving edge's
legal direction, left-lane geometry and connected walking access inside the park.
Results and coordinates are saved to `data/christchurch-validation.json`:

| Place | OSM object | Walking connection from the square's reference node |
| --- | --- | --- |
| Cathedral Square | way 116345266 | Reference node 4878136288 |
| Colombo Street | way 206789267 | 7 edges, approximately 31m |
| Hagley Park North | way 27167078 | 77 edges, approximately 1,377m |
| Hagley Park South | way 41654585 | 112 edges, approximately 2,113m |

These are connected graph paths, not guaranteed shortest-distance routes. The
park multipolygon relation 19140268 is also included. The game spawns from the
validated Cathedral Square approach and labels the landmarks on the maps.

## Verified checks

Node 24.22.1, npm 11.9.0, system Chromium with software WebGL. Browser tests use
`GTC_LOW_GFX=1` to select the existing low-graphics option. Keep `npm start`
running on port 8080 while running browser checks.

| Command/check | Result |
| --- | --- |
| `npm run map:fetch` | Passed via official API fallback |
| `npm run test:map` | 10/10 passed |
| `npm run test:map:data` | Passed, all 27,473 driving edges checked |
| `GTC_LOW_GFX=1 npm run test:map:real` | 18/18 passed with real OSM data |
| `GTC_LOW_GFX=1 PORT=8080 node --import ./test/browser-setup.mjs test/season8btest.mjs` | 13/13 passed with real map active |
| `GTC_LOW_GFX=1 GTC_TEST_MAP=legacy PORT=8080 node --import ./test/browser-setup.mjs test/mobiletest.mjs` | 10 PASS lines, no FAIL, zero page errors |

The real integration suite checks actual map loading, source-network traffic,
separated services, unobstructed landmark access points, walking, polygon
collisions through existing vehicle physics, road-aligned driving, travel to
and from the preserved fictional activity district, nearby police pursuit,
mission startup, mobile joystick movement and touch shooting. Desktop and mobile
contexts both completed without page errors.

## Regression corrections

Software rendering advances less simulation time than wall-clock time because
the engine caps its dt. `test/game-time.mjs` now waits for each test's original
simulation duration; assertion thresholds and game physics are preserved. A
quick mouse tap still uses its actual physical duration. The achievement test
also waits for simulation time. The store robbery setup supplies a nearby
witness, as required by the existing crime rules, rather than expecting heat
from an unwitnessed crime.

One product defect was fixed: fixed rampage skull coordinates could be inside
procedural buildings, which pushed the player out of collection range. Skull
placement now uses the existing collision resolver to put them outside walls.
The wanted-star CSS now follows the existing `lit` state instead of displaying
all stars as active. The real-map minimap follows a 500m neighbourhood, using
a cached world atlas rather than redrawing all streets every frame.
No gameplay system was removed. All original modules remain initialized, and
block-based activities remain in the explicitly fictional Arcade District.

The synthetic integration fixture also completed 16/16 checks before the final
wanted-star UI assertion was added. It is used only by its explicit test command,
never as a replacement for the bundled geographic data.

Final feature audit:
`GTC_LOW_GFX=1 GTC_TEST_MAP=legacy PORT=8080 node --import ./test/browser-setup.mjs test/featurecheck.mjs`
completed with **57/57 features verified, runtime errors: 0**, exit 0. This
includes all eleven mission types, web/zip/wall traversal, combat, wanted-level
escalation, tanks, shops, garage, respawn, saves, progression, maps and bosses.
The earlier failing audit was rerun in full after its four causes were fixed.

Additional checks: 164 JavaScript syntax checks passed; shell syntax and
`git diff --check` passed. The screenshot `test/shot-christchurch.png` was
inspected to verify the local road minimap and inactive wanted stars.

## Scope and limits

Validated in headless Chromium desktop and Pixel 5 emulation, not physical
phones or every browser. Not all season/intensive suites, Android packaging,
production PWA/offline installation, or every mission's end-to-end completion
were tested. Elevation, bridge/tunnel clearance, turn-restriction relations and
architectural facades remain simplified. OSM one-way directions and left-hand
traffic are supported; no claim is made about a complete New Zealand road-code
simulation. Approximate building heights are marked in the data.

## Changes in this iteration

- Source tooling: `scripts/fetch-christchurch.sh`, `scripts/fetch-osm-api.mjs`,
  `scripts/prepare-christchurch.mjs`.
- Real assets and provenance: `data/christchurch.json`,
  `data/christchurch-validation.json`, `data/README.md`.
- Geographic spawn/map labels: `js/christchurch-city.js`.
- Local minimap and wanted-star styling: `js/hud.js`, `index.html`.
- Accessible rampage pickups: `js/stunts.js`.
- Checks and test support: `test/map-browser.mjs`, `test/real-map-data.mjs`,
  `test/browser-setup.mjs`, `test/game-time.mjs`, `test/featurecheck.mjs`,
  `test/mobiletest.mjs`.
- Commands and documentation: `package.json`, `README.md`, `docs/VALIDATION.md`.

The subsequent startup correction pins the same Three.js r170 as a local
dependency and vendors its unchanged engine/addons, updating the lockfile.
See [STARTUP-FIX.md](STARTUP-FIX.md) for the startup diagnosis, timeouts, strict
map-failure behavior and fresh regression results. No environment publication
or configuration change was made.
