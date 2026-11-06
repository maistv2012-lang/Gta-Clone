# Christchurch incremental visual/performance upgrade

This change keeps the existing Three.js r170 ES-module game, its real OSM projection and networks, the separate Arcade district, controls, collision narrow phase, physics, combat, missions and police. No dependency or copyrighted game asset was added. The OSM JSON remains byte-for-byte unchanged (SHA-256 `8450e30bcfd21904980edd981025eb11816eed46b8acd299e1ac158694111c46`).

## Changes

- Cathedral Square facades now vary their bay spacing, finish and window widths deterministically per source building. Source glass/brick tags take precedence. Recessed lintels, pilasters, entrance mullions and handles add geometry; existing merged batches and three detail levels remain. Footprints/heights are untouched.
- Vehicle panels, glass, lamps, number-plate planes and wheel faces reuse geometry/materials. New simple wheel spokes share one merged wheel-face mesh. Respray and damage materials remain independent per vehicle.
- Characters reuse immutable rig attributes and one shared material per quality mode, with a per-character vertex-colour palette. The ten-bone rig, articulation, wardrobe and Brick proportions remain. A civilian goes from five material groups to one.
- Compatible opaque box meshes use cached material signatures and cell keys, rebuilt only when source properties change. They use live instanced render proxies only when at least three share a material configuration and 96-metre cell. Original objects, transforms, references and gameplay remain. Frustum culling uses per-cell instance bounds. Custom UVs, sloped geometry, mirrored meshes, transparency, emissive materials and custom draw callbacks retain their source rendering path. Removed objects are pruned; unused proxy cells release their resources.
- Immutable OSM collider bounds use a 64-metre lookup grid. The original polygon/circle resolution stays unchanged. Queries preserve array order and re-query after a displacement; moving train and other live bounds are never indexed as static.
- The pause menu adds adaptive resolution, on by default for touch devices. It uses an EMA, bounded resolution changes and cooldown; simulation/input remain untouched. Low/Medium/High remain available, with 30/60 FPS targets. Medium uses 512px shadows refreshed at up to 8Hz; High retains 2048px shadows; Low disables shadows/postprocessing. Existing progressive detail generation, wheel/building LOD, procedural PBR textures, fog, sky and weather remain.
- Crowned-player gold materials now support the articulated material palettes, remain independent of NPCs and survive quality switching.
- The renderer updates world matrices once before rendering. Pointer-lock denial is handled as optional mouse capture instead of a fatal boot error. The service-worker cache version advances to `render-v4`.

## Validation and measurements

Final controlled measurements and complete-suite results are recorded below. See [measurement protocol](performance/README.md), raw [regression artifacts](performance/regression/) and [GitHub Pages instructions](GITHUB-PAGES.md).

Cloud Chromium reports ANGLE SwiftShader: all cloud FPS measurements are **software rendering**, not actual GPU measurements. Physical Samsung Galaxy S24 Ultra/Windows GPU performance, sustained 30/60 FPS, thermal behaviour and GPU memory remain unverified. The short earlier diagnostic runs showed fewer draw calls but inconsistent FPS; they are retained separately and are not acceptance evidence.

This is an incremental Cathedral Square demonstration, not a completed city-wide art conversion. Most buildings outside the demonstration retain the existing simpler rendering. Existing sky/weather/gameplay systems were preserved, not replaced. Hardware performance targets require device measurements before release acceptance.

## Regression methodology

`npm test` runs the full existing browser/Node scripts plus focused render contracts, syntax/import checks and the day/night capture utility. The test runner records both process status and printed failures, so older scripts that print FAIL but exit zero cannot count as passing. Empty captured output is unverified. Browser groups run in sequence inside the runner; interrupted groups can resume.

Legacy activity audits explicitly request the original district with `?map=legacy` and Low graphics in the CPU-rendered environment. Real OSM provenance, coordinates, connectivity, actual walking/driving routes, mobile loading/input, default rendering and failure recovery are tested separately against Christchurch without fallback.

The first run exposed obsolete wall-clock waits. The engine caps simulation steps at 50 ms; under SwiftShader, a 450-ms wall wait can simulate only 100 ms. The untouched pre-upgrade smoke test reproduced the five 0.66-m movement failures and other timed failures ([baseline log](performance/baseline-fulltest.log)). The shared test helper now observes `world.time`; it never modifies dt, advances the game manually, or disables AI. Original movement, speed, completion, payout and collision assertions remain. Real-time advertisement waits, the physical 80-ms zip gesture and reload delays remain real-time. The old total-three-boats assumption now verifies exactly the three original moored craft, their locations/types, and the retained fourth prison launch.

The web-attack smoke fixture now settles the camera after helicopter flight before placing its target and firing, matching the already-passing feature audit. Initial failures and intermediate reruns are retained in [regression-initial](performance/regression-initial/) and [regression-recheck-1](performance/regression-recheck-1/). These are diagnostic failures, not final passing results.

The static-site integrity check parses 158 JavaScript modules, resolves 688 local imports, validates JSON and verifies the Pages entry. The final Node run passes 43/43 tests, including 13 focused optimisation tests. [Unit/build logs](performance/cache-final/) and [gold/pointer/adaptive/wardrobe/vehicle contracts](performance/cache-final/render-contracts.log) are retained.

## CPU collision lookup

The independent CPU-only microbenchmark uses all 10,304 source building colliders and 2,000 near-Square queries, alternating exhaustive/indexed runs over seven repetitions. Outputs match exactly. Median batch time is **135.53 ms → 1.70 ms**, about **79.9× faster for this lookup workload**; initial index/query setup is 3.39 ms. This is not a frame-rate speedup and includes no GPU measurement. [Raw results](performance/collision-benchmark.json).

## Final automated results

All **23/23 validation groups** pass in the consolidated [results](performance/regression/results.json). This consolidates completed runs and targeted reruns; it is not a claim that the initial run was clean. The initial failure logs are retained above.

| Group | Coverage | Result |
|---|---|---|
| [build](performance/regression/build.log) | 158 modules / 688 local imports | Pass |
| [units](performance/regression/units.log) | 43 unit cases | Pass |
| [real-map-data](performance/regression/real-map-data.log) | OSM provenance, coordinates and directed routes | Pass |
| [startup-browser](performance/regression/startup-browser.log) | 11 startup/failure scenarios | Pass |
| [map-browser](performance/regression/map-browser.log) | 20 real-map checks | Pass |
| [spawn-browser](performance/regression/spawn-browser.log) | 2 desktop/mobile scenarios; actual walking and driving | Pass |
| [preview-render](performance/regression/preview-render.log) | 9 preview/cache/WebGL recovery scenarios | Pass |
| [visual-demo](performance/regression/visual-demo.log) | desktop, mobile and missing-texture recovery; all quality tiers | Pass |
| [visual-visibility](performance/regression/visual-visibility.log) | all tree/vehicle detail tiers | Pass |
| [render-contracts](performance/regression/render-contracts.log) | 9 focused pointer/adaptive/palette/vehicle/gold checks | Pass |
| [map-synthetic](performance/regression/map-synthetic.log) | 19 synthetic integration checks | Pass |
| [featurecheck](performance/regression/featurecheck.log) | 57 gameplay features | Pass |
| [mobiletest](performance/regression/mobiletest.log) | 10 mobile control checks | Pass |
| [season8btest](performance/regression/season8btest.log) | 13 checks | Pass |
| [season9test](performance/regression/season9test.log) | 21 checks | Pass |
| [keytest](performance/regression/keytest.log) | direction diagnostic (original script has no assertions) | Pass |
| [newfeatures](performance/regression/newfeatures.log) | 18 checks | Pass |
| [intensetest](performance/regression/intensetest.log) | 19 checks | Pass |
| [season3test](performance/regression/season3test.log) | 23 checks including New Game+ | Pass |
| [season10test](performance/regression/season10test.log) | 25 checks | Pass |
| [fulltest](performance/regression/fulltest.log) | 22 gameplay smoke checks | Pass |
| [season4test](performance/regression/season4test.log) | 17 checks | Pass |
| [screenshots](performance/regression/screenshots.log) | 3 day/night captures; zero runtime errors | Pass |

The legacy screenshot utility now writes to a portable output directory rather than a hard-coded Windows drive. The runner waits for closed stdout/stderr and refuses to count empty output as verified success. Physical-phone/GPU performance testing was unavailable; no automated pass substitutes for that acceptance test.

After the first controlled mobile measurement showed lower FPS/higher heap usage, the batching hot loop was changed to reuse material signatures/cell keys instead of rebuilding per-object arrays/strings each frame. The observed initial result remains in [comparison-after-initial](performance/comparison-after-initial/). The affected build, 43 unit cases, 20 real-map checks and 9 render contracts were rerun successfully; no geometry, input, AI or physics was removed. Final performance is measured separately below.

## Final controlled software-rendering comparison

These are stationary Cathedral Square measurements using **Chromium 155 + ANGLE Vulkan SwiftShader CPU rendering**, with adaptive resolution disabled and one fresh browser per case. The viewport, game seed, camera, clock, warmup and sampling protocol match. HTTP-delivered source/map hashes were verified against each selected checkout. The baseline is `ec7ca9c`; the upgraded source fingerprint is `34c45200b05e2c03e1d385e5efca3e2c0e1b01fdb11b32bf43526e32b1cd627a`. See the [full protocol](performance/README.md), [raw before](performance/comparison-before/results.json), [raw after](performance/comparison-after/results.json), [comparison JSON](performance/comparison.json) and [CPU profiles](performance/profile-analysis.json).

| Case | Average FPS before → after | Mean frame ms | p95 frame ms | Draw calls/frame | Triangles/frame |
|---|---:|---:|---:|---:|---:|
| desktop-high (800×500) | 0.99 → 0.92 | 1009.3 → 1082.8 | 1067.2 → 1286.1 | 960 → 759 | 505,760 → 519,511 |
| mobile-medium (384×832) | 1.13 → 1.05 | 885.1 → 951.2 | 1006.9 → 1351.4 | 462 → 371 | 274,648 → 276,482 |

| Case | Unique geometry buffers MB | Scene material count | JS heap used MB | JS heap total MB | Allocated texture count | Programs created |
|---|---:|---:|---:|---:|---:|---:|
| desktop-high | 77.17 → 64.05 | 3172 → 1668 | 117.01 → 139.22 | 120.57 → 229.10 | 84 → 87 | 41 → 44 |
| mobile-medium | 77.15 → 64.03 | 3163 → 1652 | 113.20 → 136.00 | 116.64 → 302.50 | 38 → 41 | 28 → 31 |

**This does not establish an FPS improvement.** The final sample is slower by approximately 6.8% desktop and 6.9% mobile. Draw calls decrease about 21%/20% and unique geometry-buffer storage about 17%, while triangles increase about 2.7%/0.7%. Added detail and cell-level instancing trade draw submissions against geometry work. Scene material count roughly halves. Three additional texture allocations and shader programs are observed in both profiles. No whole-process RAM or GPU-memory reduction is claimed: JS heap snapshots increased, and no forced GC or GPU-memory byte counter was used.

Medium intentionally changes shadows from 1024px to 512px and caps refresh at 8Hz; this is a documented quality/performance trade-off. At approximately 1 FPS, the refresh cap provides no throttling benefit. High retains 2048px shadows. Shader-submission timings only measure the synchronous API call and cannot isolate driver/GPU compilation. First PLAY handling remains around 9 seconds desktop and 7–9 seconds mobile on this CPU renderer. Native/program samples dominate the CPU profiles, so these measurements cannot predict Adreno or Windows GPU throughput. The initial upgraded mobile result (1.06 FPS) and the final repeat (1.05 FPS) do not demonstrate a meaningful recovery after signature caching.

The targets of sustained **30 FPS mobile / 60 FPS where supported remain unverified**. This is an incremental art/efficiency implementation, not performance release acceptance. A physical S24 Ultra/Chrome and Windows GPU run is still required; [Pages/device instructions](GITHUB-PAGES.md) explain how to obtain it. Detailed architecture remains bounded to the 24-building demonstration; much of the wider map remains simpler. No critical automated startup, rendering, navigation, gameplay or collision check is currently failing.

## Actual render captures

These are browser-rendered game captures, not concept art:

- [Final desktop benchmark](performance/comparison-after/desktop-high.png) and [emulated mobile benchmark](performance/comparison-after/mobile-medium.png).
- [Cathedral Square/Brick/police desktop view](visual-demo/desktop-brick-police.png) and [emulated mobile view](visual-demo/mobile-brick-police.png).
- [Walking on Colombo Street](spawn-validation/colombo-on-foot.png) and [driving there](spawn-validation/colombo-driving.png).

The visual audit captures preceded the allocation-only signature-cache correction; final benchmark captures use the final source fingerprint above. No live Pages deployment or main-branch merge was performed.

## Startup observations

| Case | Local map-ready ms before → after | PLAY handling ms before → after |
|---|---:|---:|
| desktop-high | 4980 → 5085 | 8944 → 8950 |
| mobile-medium | 5352 → 5971 | 7149 → 9171 |

These include local loading/initialisation and click/first-frame handling, not isolated shader compilation or Internet delivery. No startup speedup is established; mobile PLAY handling is slower in the final software sample. The npm server command now places its explicit document root before flags, avoiding the baseline setup mistake described in the protocol. Port 8080 was restarted and its HTML, graphics/helper JavaScript and real JSON response bytes reverified.

## Modified files

Rendering/model work: `js/graphics.js`, `js/render-batches.js`, `js/adaptive-resolution.js`, `js/visual-quality.js`, `js/characters.js`, `js/car.js`, `js/vehicle-detail.js`, `js/city-detailing.js`, `js/facade-style.js`, `js/legend.js`. Geographic collision/query integration: `js/collider-query.js`, `js/city.js`, `js/christchurch-city.js`. Settings/startup: `js/main.js`, `js/menu.js`, `sw.js`, `package.json`.

Validation/tooling: `scripts/check-build.mjs`; `test/run-regression.mjs`, `test/render-performance.test.mjs`, `test/render-contracts.mjs`, `test/performance-benchmark.mjs`, `test/collision-benchmark.mjs`; simulation-time/fixture updates in `test/game-time.mjs`, `test/fulltest.mjs`, `test/newfeatures.mjs`, `test/intensetest.mjs`, `test/season3test.mjs`, `test/season4test.mjs`, `test/season10test.mjs`; current worker version in `test/preview-render.mjs`; portable output in `test/screenshots.mjs`.

Documentation and actual render/test artifacts are also updated. [The complete changed-file inventory](performance/modified-files.txt) includes every source, test, document, measurement and image. No tracked file was deleted. The real OSM data, source coordinates/routes, vendored engine and existing game assets remain unchanged. No new dependency, GTA asset, main-branch merge or live Pages deployment was added.
