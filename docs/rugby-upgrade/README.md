# Rugby fighter and central Christchurch detail pass

This report records the incremental Rugby implementation before publication.
For the publishing validation, see [the release report](../rugby-release/README.md).
Choose **RUGBY** in the existing start menu, then **PLAY**. Weaver, Bolt and Brick
remain available. Existing saves keep their character; selecting Rugby saves that
choice. Run `npm ci`, `npm start`, and open `http://localhost:8080/`.

## Implementation

- Original articulated rugby fighter inspired by the supplied reference: shaped
  open vest, hood, exposed muscular torso, beard, shorts, wrist wraps, socks and
  boots. Geometry is authored in code, not inferred as a complete model from the
  image. No team logos or copied GTA/Canterbury assets.
- Original procedural 512×512 geometric ink/fabric atlas, generated once and
  shared. The patterns are fictional, not a reproduction of someone's moko.
- 9,352 triangles / 10 existing bones / one material group. The previous civilian
  rig remains 3,056 triangles. This adds detail, not an asserted FPS improvement.
- The player's group, position, physics references and animation API remain
  stable across model changes. At most two rigs are retained per switching
  player; immutable geometry and atlas are shared between matching rigs.
- Low uses the existing Lambert path; Medium/High use Standard materials.
- Roof cornice layers, ground-floor transoms and window reveals added to the
  existing 24 selected buildings. Existing material batching and LOD remain.
- Low kerbs follow existing road segments near Cathedral Square / Colombo
  Street, with 5m setbacks. They do not add navigation edges or collision walls.
- Four character cards fit into a two-column layout on narrow screens. Menu
  scrolling and existing touch controls remain operational.
- Scoped service-worker cache version advances to `rugby-v5`; its network-first
  policy, map error messages and prohibition on silent fictional fallback remain.

The OSM dataset is unchanged: SHA256
`8450e30bcfd21904980edd981025eb11816eed46b8acd299e1ac158694111c46`.
Building footprints, height data, road graph, left-hand traffic, missions,
vehicles, combat and police logic are unchanged.

## Reproducible checks

With the server running:

```
npm run check
npm run test:rugby
node test/rugby-model-preview.mjs
npm test
```

`test/rugby-upgrade.mjs` exercises selection, model sharing, independent wardrobe
colours, repeated Brick/Rugby swaps, all quality profiles, animation, collision
bounds, PLAY, real map provenance, movement, actual WebGL draws and saved reload
on desktop and an emulated touch phone. It records console/network failures and
checks that the context remains healthy. The complete existing regression suite
is retained. The old exactly-three-characters assertion now requires all four
explicit roster keys and still verifies Brick's 150HP.

`model-sheet.png` is an actual Three.js model inspection render with a test
camera, not a gameplay screenshot or an AI-generated target image. The desktop
and mobile scene images are actual gameplay captures. Test results and software
renderer diagnostics are recorded beside them; detailed regression logs are in
`regression/`.

## Limits

The model is stylized and does **not** match the photorealistic reference. A
production-quality anatomical mesh, professionally painted skin/cloth textures
and more sophisticated deformation remain further work. The local demo changes
only the central area; it does not upgrade every OSM building in the city.

Chromium in this environment uses SwiftShader software rendering. Any recorded
FPS/frame time is a software-only diagnostic, not a Galaxy S24 Ultra benchmark.
Physical Android/Chrome performance and 30/60 FPS targets are unverified.

## Changed source files

- `js/characters.js`, `js/rugby-materials.js`: roster, rig, atlas and stable rig changes.
- `js/main.js`, `index.html`: selection integration and narrow-screen card layout.
- `js/christchurch-city.js`, `js/city-detailing.js`: kerbs and batched facade geometry.
- `sw.js`: cache version.
- `package.json`, `test/run-regression.mjs`: reproducible checks.
- `test/rugby-upgrade.mjs`, `test/rugby-model-preview.mjs`: new validation/captures.
- `test/mobiletest.mjs`: optional Rugby selection; all original touch assertions retained.
- `test/render-contracts.mjs`: gold finish now also checked through Rugby/regular swaps.
- `test/featurecheck.mjs`, `test/preview-render.mjs`: roster/cache version expectations.

The generated Rugby atlas pixels are original work dedicated to CC0 1.0
(https://creativecommons.org/publicdomain/zero/1.0/). Existing Three.js and OSM
attribution/licensing remain in place.

## Software-renderer diagnostics from the focused gameplay check

Both cases use Medium, DPR 1, adaptive resolution disabled. These short samples
are taken after movement and camera settling. They are **not** a controlled
before/after benchmark, and frame counts include rendering during warmup.

| Case | Viewport | Observed FPS | Last-frame draw calls | Last-frame triangles | Approx. JS heap |
| --- | --- | ---: | ---: | ---: | ---: |
| Desktop | 1100×700 | 0.64 | 610 | 420,259 | 223 MiB |
| Touch phone emulation | 384×832 | 1.77 | 341 | 281,429 | 228 MiB |

Renderer: ANGLE / Vulkan SwiftShader (Subzero), not a hardware GPU. WebGL error
was zero, the context remained live and console/network error lists were empty
in both cases. Heap readings are snapshots, not peak memory or GPU memory.


## Regression fixture correction

The first complete run exposed an existing nondeterministic jailbreak assertion:
`addCrime(world, 2)` deliberately has a 50% chance to ignore an unwitnessed offence
from zero heat. The old escape fixture teleported to an arbitrary location but
always required two stars. `js/police.js` and `js/prison.js` were not modified.
The fixture now escapes beside an existing civilian outside the island. The
original checks (outside prison, at least two stars, exactly one jailbreak) are
retained. `test/crime-witness.mjs` independently checks both unwitnessed outcomes,
the witnessed outcome and the on-duty rule against the unchanged game module.
`test/intensetest.mjs` and that focused test are also changed test files.


The first run also exposed a timing/fixture assumption in the Cartographer
check: it used an allegedly unvisited fixed corner and 1.8 wall-clock seconds,
while explorer polls every 1.2 simulation seconds. The test now chooses an
actually unseen block using the runtime grid constants, visits an unobstructed
intersection and waits the same 1.8 **simulation** seconds. The original count
increase assertion remains and now additionally requires that the selected block
was recorded. No time is advanced artificially, and `js/explorer.js` is unchanged.
`test/season10test.mjs` is the other corrected test file.


## Original implementation validation

All **26 regression groups passed** after the two fixture corrections. This
includes 43 unit tests, 11 startup scenarios, 20 real-map browser checks, 9 preview
scenarios, the 57-feature audit, existing mobile controls, the same touch checks
with Rugby selected, 19 intensive checks and all 25 Season-10 checks. The first
failed logs and first-pass result list remain archived in `regression/`.

The final character run confirms a 0.413m maximum horizontal radius inside the
existing 0.5m collision radius, valid packed UVs, 9,352 triangles, ten bones,
one draw group, independent wardrobe colours, bounded reuse and saved reload
on both desktop and touch emulation. The final model inspection also checks a
clean WebGL error state. `source-fingerprint.json` verifies HTTP 200 responses
and exact source/map bytes from port 8080, and confirms that the base renderer,
physics, vehicle, police, prison, explorer and route modules are unchanged.

Current-run visual evidence is kept in this directory; historical tracked test
captures elsewhere in the repository were restored to their original versions.
At the original implementation hand-off, no commit, push or publication had
been performed. Publishing validation is recorded separately in the release report.
