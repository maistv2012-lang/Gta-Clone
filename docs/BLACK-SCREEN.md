# Black-screen investigation — 6 November 2026

## What was reproduced

The local current version initially showed its menu and 3D world in a normal
mobile page and a basic iframe. No network/JavaScript failure explained a black
screen in those two baseline runs. The user's exact Preview URL and browser
were requested but were not available for direct inspection. These results do
not establish the cause on the physical S24 Ultra.

Two concrete failure paths were then reproduced, with screenshots and logs:

1. **Completely blank Preview from a service-worker cache.** With an empty
   HTTP-200 HTML response in the old cache and the network unavailable, the
   worker returned that response unchanged. In the black Preview host the
   document had `body: ""`, no menu, and no PLAY. Its navigation was HTTP 200,
   `fromServiceWorker: true`; JavaScript never ran to display an error.
   [Before](black-screen/cache-before.png), [navigation log](black-screen/cache-before.json).
2. **Black 3D framebuffer with a nominally ready game.** Removing the optional
   float color-buffer extensions reproduced a black world while the internal
   state said `play`. The console contained `EXT_color_buffer_float extension
   not supported` and `GL_INVALID_FRAMEBUFFER_OPERATION: Framebuffer is
   incomplete: Attachment is not renderable`. The old PMREM/reflection and bloom
   pipeline required half-float render targets without checking them. Earlier
   low-graphics/state-only tests did not detect this.
   [Before](black-screen/gpu-before.png), [console log](black-screen/gpu-before.json).

The network/storage and GPU conditions above are controlled fault reproductions,
not observations taken remotely from the user's handset.

## Corrections

- The HTML menu and CPU/map preparation allocate no WebGL context. GPU resources
  are created on PLAY, so a graphics failure cannot suppress the initial menu.
- The first frame is rendered while the menu remains visible. Framebuffer/error
  checks and a one-time grid of actual pixel readbacks reject a black/uniform
  frame before hiding the menu. Ordinary frames do not perform these readbacks.
- `js/graphics.js` retains Three.js r170. It checks float support and a probe
  framebuffer before allocating the optional HDR/reflection/bloom pipeline.
  Unsupported previews use the existing direct WebGL rendering path for the
  same map, actors and gameplay. Supported hardware keeps the original effects.
- Errors after readiness or during PLAY restore the HTML error/menu screen and
  stop the render loop. Error presentation does not depend on a successful game
  pause/cleanup operation. Optional fullscreen/orientation/wake-lock permission
  failures in an iframe are caught.
- The worker uses a versioned cache owned by its registration scope, rather
  than searching all caches. HTML is validated before caching or navigation
  recovery. Empty/invalid cached HTML is rejected. If no valid shell is available,
  a self-contained recovery screen shows the title, disabled PLAY, an explanation
  and retry. Navigation body validation is also time-bounded. Old game cache
  versions are retired; unrelated caches are preserved.
- No Christchurch-to-fictional-map error fallback was introduced. The original
  activity district and explicit legacy regression mode remain available.

## Visual confirmation

The Preview harness is a separate origin with a sandboxed iframe. The mobile
profile uses 384×832 CSS pixels, DPR 3.75, touch/mobile input, dark host background
and an SM-S928B/Samsung Internet user agent. Chromium runs on software WebGL;
this does not emulate the S24's physical Adreno driver or Samsung Internet binary.
The cache-recovery case uses a same-site/different-port iframe, where service
workers are permitted. Cross-site iframe cases also work when worker registration
is denied by the browser; that optional denial is recorded in console logs.

Fresh normal and restricted-float runs used **default graphics**, without the
`GTC_LOW_GFX` test override. Captures were visually inspected:

- [Menu before any GPU context](black-screen/menu-after.png).
- [Actual scene after tapping PLAY](black-screen/scene-after.png).
- [Rendered scene without float targets](black-screen/gpu-after.png).
- [Recovery instead of the completely black cached page](black-screen/cache-after.png).
- [3D entry after reconnecting and retrying](black-screen/cache-recovered-scene.png).
- [Menu and HTTP-404 map explanation](black-screen/map-error.png).
- [Menu when WebGL cannot initialize](black-screen/webgl-error.png).
- [Menu after a later JS failure](black-screen/late-js-error.png).
- [Menu when readback reports only a uniform dark frame](black-screen/silent-black-frame-error.png).

`test/preview-render.mjs` also analyzes the central scene pixels, excluding the
HTML HUD/touch controls. The reproduced old black scene is a negative control;
working HTML buttons over a black WebGL canvas cannot pass this check. Per-case
console, request failures and HTTP/worker responses are recorded in
`docs/black-screen/*-log.json`; actual pixel/render measurements are in
[results.json](black-screen/results.json).

## Tests and reproduction

Keep `npm start` running. Run `npm run test:preview` **without** `GTC_LOW_GFX=1`.
The test starts/closes its own loopback-only iframe host. It exercises the normal
HDR path, unavailable float targets, corrupted cache/offline recovery/retry,
map 404, WebGL failure, later JS failure, and a silent black readback.

Results recorded for this correction:

| Check | Result |
| --- | --- |
| Visual mobile Preview scenarios with actual captures/pixels | 7/7 passed |
| Startup/failure/nested worker reload scenarios | 11/11 passed |
| Real-map browser workflow with default graphics | 18/18 passed |
| Existing core feature regression | 57/57 passed, zero page errors |
| Existing mobile controls/vehicles/interactions | 10 PASS, zero FAIL/page errors |
| Existing purchases/combat/persistence suite | 13/13 passed |
| Map loader and geographic network unit checks | 7/7 and 10/10 passed |
| JavaScript syntax and whitespace | 171 files passed; `git diff --check` passed |

One initial core audit had a non-deterministic web-attack setup: it teleported
the player far from the prior camera position, allowed the target to walk, and
could select a random nearer traffic car. Its setup now uses a clear sidewalk
corner, waits for the existing chase-camera interpolation, and places the target
immediately before attacking. The assertion and eight-metre attack distance were
retained; the complete audit was rerun.

Data/map conversion did not change. Real OSM provenance and paths were rechecked.
No gameplay systems or dependencies were replaced, and no public deployment or
environment publication was performed. Validation of the actual handset and its
specific hosted Preview still requires that URL/browser; other browsers,
physical GPU/memory limits and every remaining seasonal suite were not tested.

Changed files: `js/graphics.js`, `js/main.js`, `js/boot.js`, `js/device.js`,
`index.html`, `sw.js`, `test/preview-render.mjs`, `test/startup-browser.mjs`,
`test/featurecheck.mjs`, `package.json`, documentation and diagnostic artifacts.
