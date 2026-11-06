# Rendering validation artifacts

`comparison-before/` and `comparison-after/` are the final controlled measurements (when present). Each runs in a fresh Chromium process, with the same seeded random generator, viewport, device scale, camera, time of day, scene location, profile, disabled adaptive resolution, and CPU profiler. Sampling lasts at least 30 seconds and 20 rendered frames. The before server is an isolated archive of commit `ec7ca9c`; its game code is unchanged. Only the identical benchmark harness is copied into it. In both cases, the harness intercepts the local Three.js module to isolate its UUID-only random stream from the gameplay random stream. This changes identifier generation only, never geometry, rendering, physics or game rules. Without this control, geometry/material caching consumes fewer UUID random calls and inadvertently changes NPC/vehicle placement despite the same gameplay seed. Both cases warm up for at least six simulation seconds, then settle the camera for twelve rendered frames before sampling. Pointer capture is stubbed only in this stationary benchmark so transient user activation cannot expire during cold shader work; real capture/rejection paths are exercised by the separate functional tests. This benchmark is an idle scene measurement, not a driving/pursuit stress test.

`before/` and `after/` contain earlier diagnostic runs with the original 12-second protocol. These informed optimisation work; do not mix them into the final comparison. A mobile slowdown in the preliminary run led to reducing sparse proxy allocations and sharing vehicle geometry.

All cloud measurements use **ANGLE SwiftShader software WebGL**, not a physical GPU. Viewport/touch emulation cannot reproduce Samsung hardware or drivers. CPU profiles include substantial native/program time waiting on software rasterisation. Actual Adreno performance, Android thermal behaviour, battery usage, GPU memory and sustained 30/60 FPS remain unverified.

Metrics:

- FPS and frame times: observed rendered frames and elapsed wall time, including profiler overhead; not simulation speed.
- Calls/triangles: Three.js renderer counters, including shadow/postprocessing passes where active. Short moving scenes produce small variations.
- JS heap: CDP `JSHeapUsedSize`, with no forced collection; garbage collection and caches make this approximate.
- `uniqueGeometryBufferBytes`: unique ArrayBuffer storage for geometry attributes/index buffers reachable from scene meshes. Excludes textures, instance buffers, skeletons, renderer allocations and other JS objects. `geometryAttributeBytes` is the logical sum per distinct geometry and can count shared attributes more than once.
- Texture counts: allocated WebGL textures, not texture bytes. There is no reliable cross-browser GPU-memory byte counter here.

The regression runner writes per-script logs and results in `regression/`. Original gameplay audits explicitly select `?map=legacy` because their fixtures teleport to that district's original coordinates. Real Christchurch loading, topology, navigation, spawn, rendering and touch controls are checked separately without fallback. A passing software rendering test is not a performance acceptance result for a physical phone.

`shaderSubmissions` counts shader/program creation and synchronous compile-submission CPU time. It is not a GPU shader compilation timer. `playClickMs` includes the first render/readback and click handling, not just shader compilation.

An interrupted regression run can resume with `GTC_TEST_RESUME=1 npm run test:regression` in a POSIX shell. Completed groups remain recorded; interrupted groups run again. Use a fresh output directory for a wholly fresh run.

The harness preflights the HTTP-delivered graphics, main, character and map-construction modules plus the map JSON against the selected checkout bytes. An earlier baseline-server invocation mistakenly served the current working directory because of CLI argument parsing; those samples are retained in `invalid-baseline-serving-current/` and `invalid-baseline-fulltest.log` and must not be used as pre-upgrade evidence. The final runs require `serverSourcesVerified: true`.

`comparison-after-initial/` is the first hash-verified upgraded measurement, before the hot-loop signature-cache correction. It observed mobile FPS 1.13 → 1.06 and higher heap usage despite fewer calls. It is retained as evidence, not presented as the final corrected result. JS heap total/used are snapshots affected by GC; an overall RAM reduction is not established by geometry-buffer savings alone.
