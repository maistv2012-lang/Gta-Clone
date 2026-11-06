# Executed results

| Check | Result |
| --- | --- |
| Real spawn selection, clearance, walk/drive connectivity, fail-fast cases | 6/6 |
| Browser startup, including nested path and warm service worker | 11/11 |
| Real OSM integration, now asserting initial position and mobile movement from spawn | 20/20 |
| Synthetic fixture integration | 19/19 |
| Existing feature regression, explicit legacy map/low graphics | 57/57, runtime errors 0 |
| Existing mobile regression, explicit legacy map/low graphics | 10 PASS, no FAIL, runtime errors 0 |
| Existing graph unit tests | 10/10 |
| Existing loader unit tests | 7/7 |
| Real OSM provenance, landmarks and legal left lanes | Passed; data unchanged |
| Direct desktop/mobile navigation and saved-progress suite | Passed: fresh start, legacy save/reload, real respawn, minimap, walk and drive |
| Changed JS syntax and diff whitespace | Passed |

Commands: `npm run test:spawn`, `npm run test:spawn:browser`,
`npm run test:startup`, `npm run test:map:real`, `npm run test:map:browser`,
`npm run test:map`, `npm run test:startup:unit`, `npm run test:map:data`.
Existing regression commands:

```sh
GTC_LOW_GFX=1 GTC_TEST_MAP=legacy node --import ./test/browser-setup.mjs test/featurecheck.mjs
GTC_LOW_GFX=1 GTC_TEST_MAP=legacy node --import ./test/browser-setup.mjs test/mobiletest.mjs
```

The dedicated spawn/navigation suite uses default graphics. Captures show the
initial real-map scene and the walk to/drive on Colombo Street. Emulation uses
Linux Chromium/software WebGL; no physical Windows or Galaxy hardware was tested.
No graphical styling or data extract change was made. No production deployment
or merge to main is included.
