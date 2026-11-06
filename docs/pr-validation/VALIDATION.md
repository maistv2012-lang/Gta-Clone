# Pull Request validation

Branch: `gta-christchurch`, based on `3b58b23f72e4ed04b46383f813d8f853f6bc6d7d`,
which matched remote `main` at review time. Original tracked files are retained.
The existing game implementation is extended; its engine is not replaced.

## Executed checks

| Check | Result |
| --- | --- |
| Real OSM source, landmarks, connectivity and 27,473 legal left-lane driving edges | Passed |
| `npm run test:map` | 10/10 |
| `npm run test:startup:unit` | 7/7 |
| `npm run test:startup` | 11/11 |
| `npm run test:map:real` (default graphics, real extract) | 18/18 |
| Existing core regression (`GTC_LOW_GFX=1 GTC_TEST_MAP=legacy`) | 57/57, zero runtime errors |
| Existing mobile regression (same settings) | 10 PASS, no FAIL, zero runtime errors |
| `PORT=8080 GTC_LOW_GFX=1 node --import ./test/browser-setup.mjs test/season8btest.mjs` | 13/13, real map |
| `npm run test:preview` (default graphics) | 9/9, visible menu and actual 3D scene |
| JavaScript syntax in js/test/scripts and sw.js | 173 files passed |
| Static runtime import targets | 822 checked, present |
| Three.js engine, MIT license and 12 addons vs pinned npm package 0.170.0 | Byte-for-byte identical |
| Importer Bash syntax | Passed |
| Credential-pattern scan of text files | No matches |
| Staged whitespace check, excluding verbatim vendored upstream files | Passed |

OSM file SHA-256 remains
`8450e30bcfd21904980edd981025eb11816eed46b8acd299e1ac158694111c46`.
No live map refresh was needed or performed during this review.

Root server: `npm start` on 8080. Browser execution: installed Chromium with
software WebGL on Linux, mobile emulation. Graphics tests did not set lowGfx.
Regression suites explicitly used the original map to exercise preserved systems;
the real-map integration separately exercised walking, driving, polygon collision,
mission startup, nearby police, mobile input and travel to/from Arcade District.

## Failures investigated during this review

The first startup run passed ten cases, then failed because its last nested-path
case required an undocumented manually started 8081 server. The test now starts
an auxiliary server on a free local port automatically (NESTED_PORT still supports
an explicitly supplied external server). Assertions were retained; full rerun
passed 11/11. No game engine change was needed.

The first real-map run timed out at its existing 20-second walking assertion
while another software-rendered regression suite was active. That log is retained
as real-first-attempt.log. The test now prints state/WebGL diagnostics on failure.
Its full isolated rerun passed 18/18 with the original assertion and timeout.
This does not establish a unique cause for the first timeout; no production change
was made on that evidence. GPU-heavy suites should be run sequentially here.

A default-sandbox Node syntax subprocess hit EPERM; rerunning the syntax command
in the normal execution environment completed all 173 checks. Upstream Three.js
sources contain existing whitespace warnings; those sources are kept unchanged.

## Scope and evidence

Startup/regression/mobile/season8b/map logs and captured mobile images are in this
directory. Menu visibility and actual scene pixels after PLAY are checked in the
visual suite. Images are inspected in addition to state assertions.

No physical Galaxy, Windows hardware or authenticated hosted ChatGPT Preview was
available. No claim is made that the user's physical-device black screen has been
resolved. Not every seasonal suite or every mission completion was rerun. Existing
OSM import limitations are documented in data/README.md. No deployment or merge
into main was performed.
