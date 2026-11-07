# RUGBY release validation

Target: `maistv2012-lang/Gta-Clone`, branch **gta-christchurch**. The `main` branch
is not part of this release. GitHub Pages is configured to deploy the branch root
at https://maistv2012-lang.github.io/Gta-Clone/.

## Scope

The release includes the original playable RUGBY rig, procedural 512px atlas,
existing skeletal animations, selection-menu integration and saved choice; the
central kerb/facade detail pass and focused regression coverage are also included.
The real OSM dataset, route graph, collision logic, vehicles, missions, police,
legacy district and touch interface are preserved. The art remains stylized.

Map SHA256: `8450e30bcfd21904980edd981025eb11816eed46b8acd299e1ac158694111c46`.

## Reproduce local validation

```
npm ci
npm start
# In another terminal:
GTC_TEST_OUTPUT=docs/rugby-release/tests npm test
```

The runner executes all 27 functional, unit, real-map, graphics, startup, mobile
and regression groups, including touch controls with RUGBY selected. Final
run status and logs are under `final-tests/`. Nothing is skipped or disabled to publish.
The previous implementation's two corrected test fixtures (witnessed jailbreak
and exploration polling in simulation time) retain their original gameplay
assertions; the game rules were not changed.

The environment uses Chromium/SwiftShader software rendering. Phone emulation
checks layout, touch input and startup, not a physical Android GPU or 30/60 FPS.

## Public release verification

After pushing, require GitHub Pages' successful build to name the pushed commit.
Verify the ordinary public URL, its source files, local textures and real map
bytes. On desktop and emulated touch Chrome: choose RUGBY, press PLAY, verify
live 3D frames at Cathedral Square, move, check the WebGL error/context state,
and reload to verify saved selection and service-worker behavior. Capture the
actual public menu and game, retaining console/network failures for diagnosis.

Publication is successful only after those public-site checks pass. The exact
published commit, deployment build and observed public results are reported in
the publishing task's final response; this committed document is the procedure
and pre-deployment test record, not an assertion that a deployment has completed.


## Publishing-run mobile fixture correction

The first mobile run reported a failed 700ms airborne assertion. Its fixture
selected the first random tall collider without validating facade width, a
clear approach or nearby traffic. The existing desktop feature audit already
requires a wide/clear facade because the swing uses a fan of rays and otherwise
can choose a much longer rope. The mobile fixture now uses those same conditions.
The touch event, hold duration and original attached/airborne assertion are
unchanged; anchor/rope diagnostics are added. No touch control, swing physics,
road layout or gameplay rule is modified. The original failure log is retained
as `tests/mobiletest-first-pass.log`; validation must rerun the default mobile
case and the RUGBY mobile case before publishing.


The first Season-3 run also failed at raid creation, then dereferenced the absent
raid. Empire intentionally pauses raid countdown during missions, finale, prison
or an outbreak. Earlier cases stage night-time gameplay that can randomly start
an outbreak. The independent empire fixture now stages daylight and lets the
normal simulation end any incidental night outbreak, then explicitly verifies
free-roam preconditions before setting its original short raid timer. All raid,
defense, ownership and $500 payout assertions remain. Raid-timer diagnostics are
added. No empire or outbreak game module is modified. The entire Season-3 group
must be rerun; its original log is retained as `tests/season3test-first-pass.log`.


## Confirmed vault-placement correction

A subsequent frame trace reproduced the vault failure: generated collision
geometry pushed the old fixed approach to 3.1m from the hatch, beyond the unchanged
2.6m drilling radius. Across 12 generated layouts, some hatch locations had no
clear approach within range. This is a real legacy activity-placement defect,
not a rendering or touch-input defect.

`js/casinoheist.js` now uses a bounded deterministic placement helper for an
obstructed hatch. Clear preferred positions are retained. Alternatives must
provide 1.4m of clearance and remain outside blackjack's interaction range.
The original map/colliders, casing/drilling radii, input, timers, wanted levels,
and rewards are unchanged. Focused unit cases and repeated legacy/real-map
browser checks validate placement. The full suite is rerun after this correction;
`final-tests/` is the release acceptance record, while `tests/` retains the
pre-correction run and investigation evidence.


## Final pre-deployment result

The complete fresh run after the confirmed placement correction passed **27/27
validation groups**, with no failing groups and no skipped unit cases. It includes
47 unit tests, eight generated-layout plus one real-map placement checks, 11 startup
scenarios, 20 real-map browser checks, 9 preview scenarios, all three graphics
qualities on desktop/touch emulation, the 57-feature audit, both mobile rosters,
19 intensive checks, all 23 Season-3 checks and all 25 Season-10 checks.

The original heist assertions now pass with a 0.707m collision-stable approach,
the original four-second drilling timer, four wanted stars and $15,000 payout.
The ordinary Christchurch hatch retains its exact original coordinates. The
map bytes remain unchanged. `model-preview.log` also records a clean real Three.js
model render, valid atlas UVs and settled desktop/mobile selection captures.

No existing game feature or assertion was removed. The narrow hatch-placement
fix is the only additional production change made during publishing validation.
Historical tracked captures outside the new reports were restored; fresh release
evidence is kept here. Physical S24 Ultra GPU performance remains unverified.
