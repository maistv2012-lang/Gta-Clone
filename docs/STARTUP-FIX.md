# Mobile startup correction — 6 November 2026

## Confirmed findings

The OSM extract is present and valid. Both `/data/christchurch.json` and
`/Gta-Clone/data/christchurch.json` returned HTTP 200 with JSON content type,
6,529,104 bytes, and content identical to the prepared file. SHA-256:
`8450e30bcfd21904980edd981025eb11816eed46b8acd299e1ac158694111c46`.
The named-place/data checks passed; the map did not need to be downloaded again.

The old page updated its initial `Loading map…` label only after static module
imports, an unbounded JSON fetch and synchronous construction of the whole city.
There was no independent error boundary/watchdog. A failed engine import could
leave PLAY enabled without its handler. Blocking the Three.js CDN reproduced
exactly that state: `Loading map…`, no initialized game, no visible explanation.
The old map catch block could also continue into the fictional map on failure.

The user's exact phone URL/browser was not supplied, so the specific network or
device failure on that phone could not be inspected directly. The startup defect
and the reported failure mode were reproduced and corrected in the repository.

## Corrections

- `js/boot.js` watches startup before dynamically importing the game, reports
  import/initialization/WebGL errors, and enables PLAY only after the game has
  completely initialized. Failure shows an explanation and a retry action.
- `js/map-loader.js` validates HTTP status, JSON MIME type, parsed data and
  geometry/bounds. A 45-second timeout covers response headers and body. The
  overall module/game watchdog is 90 seconds; a missing bootstrap is reported
  after at most 15 seconds. Slow mobile construction yields periodically so
  those timers and the status display can run.
- Default-map failures abort startup. Only an explicit `?map=legacy` selects the
  original map; errors never silently select it. The fictional activity district
  inside a successfully loaded Christchurch world is unchanged.
- The same Three.js r170 engine and 12 required addons are served from
  `vendor/three/`, with their MIT license. There are no runtime CDN requests.
  The exact npm version `0.170.0` is pinned in `package.json`/lockfile. Reproduce
  these unchanged library files with `npm ci && npm run vendor:three`.
- City construction is cooperative. Temporary geometry is compacted in bounded
  batches instead of retaining tens of thousands of intermediate objects. This
  preserves geometry and collision data while reducing initialization pressure.
- The service-worker cache version was advanced; network header waits are
  bounded, cached offline responses are retained, and cache misses return a
  network error rather than an undefined response. Root and nested worker reloads
  were tested. This does not claim a full offline-installation certification.

## Validation

All browser tests used Chromium with the supported low-graphics setting and
software WebGL. Phone contexts emulate a Pixel 5; they are not physical devices.

| Check | Result |
| --- | --- |
| Map delivery at root and `/Gta-Clone/`, byte-for-byte comparison | Passed |
| `npm run test:map:data` | Passed, real OSM places and legal road directions |
| `npm run test:startup:unit` | 7/7 passed |
| `GTC_LOW_GFX=1 npm run test:startup` | 11/11 passed |
| `GTC_LOW_GFX=1 npm run test:map:real` | 18/18 passed, including PLAY and touch controls |
| Original `featurecheck.mjs`, explicit legacy mode | 57/57 passed, zero page errors |
| Original `mobiletest.mjs`, explicit legacy mode | 10 PASS, zero FAIL/page errors |
| Original `season8btest.mjs`, real map active | 13/13 passed |
| Geographic network unit tests | 10/10 passed |

Startup scenarios cover: no remote-host access, mobile PLAY, missing JSON and
successful retry, HTTP-200 HTML fallback, invalid data, stalled download, missing
engine, unavailable WebGL, lost WebGL context during construction, stalled module
import, missing bootstrap, and nested-path startup/warm reload with an active
service worker and 4x CPU slowdown. Timeout tests advance the browser clock to
verify expiry without waiting actual minutes. Body-stall expiry is unit-tested.

To reproduce the startup suite, keep the normal server running on port 8080 and
a local-only directory server on 8081 (run from the repository root):

```sh
npm start
# In another terminal; serves this checkout as /Gta-Clone/:
npx -y http-server@14.1.1 .. -a 127.0.0.1 -p 8081 -c-1
# In another terminal:
GTC_LOW_GFX=1 npm run test:startup
```

Other existing regression commands:

```sh
GTC_LOW_GFX=1 GTC_TEST_MAP=legacy PORT=8080 node --import ./test/browser-setup.mjs test/featurecheck.mjs
GTC_LOW_GFX=1 GTC_TEST_MAP=legacy PORT=8080 node --import ./test/browser-setup.mjs test/mobiletest.mjs
GTC_LOW_GFX=1 PORT=8080 node --import ./test/browser-setup.mjs test/season8btest.mjs
```

Not tested: the actual user's phone/public URL, Safari/WebKit, physical-device
memory limits, every other seasonal suite, Android packaging, or full offline
installation. No environment publication or external deployment was performed.

The subsequent [black-screen investigation](BLACK-SCREEN.md) reproduced invalid
cache navigation and unsupported float framebuffers. It moves GPU allocation to
PLAY, verifies the first rendered pixels before hiding the menu, and scopes and
validates worker caches. See its captures and fresh test results.
