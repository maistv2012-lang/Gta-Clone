# Chrome Android Preview retest — 2026-11-06

User reports Chrome Android on Samsung Galaxy S24 Ultra, inside Codex on chatgpt.com.
The authenticated hosted Preview URL is unavailable. These results are from local
sandboxed iframe emulation, not the actual handset or chatgpt.com iframe policy.

Runtime: Chromium 155.0.8059.79 on Debian, software WebGL (SwiftShader), Chrome Android
145 user-agent (no SamsungBrowser token), SM-S928B, 384×832 CSS pixels, DPR 3.75,
mobile/touch. User-agent emulation does not run Android Chrome or emulate Adreno.
No production code, map data or gameplay was changed in this retest.

Reproduce:
`GTC_PREVIEW_ARTIFACTS=docs/chrome-android npm run test:preview`

9/9 visual cases passed: default HDR, explicitly blocked service worker, warm
service-worker reload, missing float targets, corrupted offline cache/recovery,
missing map, unavailable WebGL, late JavaScript error, uniform dark first-frame
readback. Menu and PLAY were visually inspected in menu-after.png; visible avatar,
world geometry and mobile controls were inspected in scene-after.png. Default,
blocked-worker, warm-reload and compatible rendering all entered the 3D world.

Captured console: cross-site iframe can deny service-worker registration; sandbox
permissions policy denies screen-wake-lock. These were nonfatal and actual scene
pixels remained visible. SwiftShader warned about readPixels synchronization.
No pageerror or failed resource requests appeared in the four successful rendering
paths. Intentional failure cases do contain expected errors; see individual logs.
No actual physical GPU failure or specific hosted-cache fault was established.

Additional reruns: real OSM browser integration 18/18 (includes walking, driving,
police, mobile movement/combat); map graph 10/10; map loader unit 7/7; real OSM
provenance and connectivity passed. Full earlier 57-case audit was not repeated:
production implementation is unchanged. SHA256 of data/christchurch.json remains
8450e30bcfd21904980edd981025eb11816eed46b8acd299e1ac158694111c46.

All JSON logs and PNG captures beside this file are from this retest.
Nothing was published.
