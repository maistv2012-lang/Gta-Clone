# Cathedral Square visual demonstration — stage 1

This is a playable first stage, not a claim of reference-image photorealism or a
finished city-wide art pass. Real OSM geography and original game systems remain.

## Technical analysis and scope

Three.js r170 already used ACES tone mapping, PMREM environment reflections,
shadows, optional bloom, an animated sky/day-night cycle and rain/thunder. The
primary visual limits were untextured extruded building footprints, seven-piece
box characters and box car bodies. The render path also needs its existing
float-target capability probe and explicit error menu for restricted mobile WebGL.
Those startup protections remain in place.

The reference is used for material variety, human scale, streetscape and atmosphere.
Its tower, hills and street composition are not imported into Christchurch.
The actual Cathedral OSM record (30366472) says `building=cathedral`, `ruins=yes`,
`access=no`, height 30m. The demo uses its footprint and represents restoration,
with scaffold and no invented intact historical spire. Architectural forms and
ornament are approximate authored geometry, not a surveyed restoration model.

## Implemented

- 24 real nearby building footprints receive a local three-level LOD exterior.
  Source building:levels metadata is used where available. Window reveals, frames/mullions, sills, doors, canopies, coping and facade fins
  are modelled as geometry, merged by material. The Cathedral has pitched roof
  geometry, pointed lancet windows, buttresses, west entry, rose window and scaffold.
  Tūranga and Novotel retain their source locations/heights with approximate
  facade treatments. This is not an exact architectural replica of each building.
- Original 512×512 albedo/normal/roughness sets for masonry, limestone, brick,
  paving, asphalt and roof; 256×256 alpha-cutout leaf clusters. Original texture
  assets total about 3.7MiB on disk, with mipmaps and bounded anisotropy at runtime.
  Generator: `scripts/generate-city-textures.py` (Python + Pillow, only to regenerate).
  Playing uses npm and bundled assets; no Python, CDN or external model server.
- Square paving infill is derived from the hull of named OSM Square approaches
  where source land cover is absent. Explicit source green/water polygons retain
  their higher layers. It is an artistic infill, not an OSM-surveyed plaza polygon.
  Road/sidewalk textures use the source ways, rounded joins and source crossing
  tags. Street-name signs use source names. Curbs, lamps and benches are batched.
- Trees are instanced on screened Square locations and inside Hagley North's
  source polygon. Individual tree positions/species are inferred. Trunk collision
  and source walking/road clearance are retained. Low/Medium/High reduce foliage
  layers (3/6/9 cards) while retaining visible trunks for every collider.
- Characters use a combined skinned anatomical mesh with ten bones, articulated
  elbows/knees, facial features, clothing weave, shoes and wardrobe-compatible
  palettes. This remains a procedural rig with existing locomotion, not a scanned
  human, motion-captured animation or full natural IK. Weaver, Bolt and Brick
  statistics/selection remain; Brick has a broader visual build.
- Cars have beveled bodies, sloped cabin geometry, roof/pillars, mirrors, handles,
  grille/bumpers, plates and rim detail with LOD. Existing wheels, controls,
  physics, damage, garage/respray and pursuit interfaces remain. NZ-inspired
  blue/yellow police livery and blue-shirt/dark-vest/cap officers are original
  designs, without a licensed manufacturer model or official endorsement.
- Clouds move through the existing sky. Existing day/night, rain, thunder and
  lightning are preserved. Nearby-wall clipping protects the real-map chase camera;
  combat aiming height is retained. The minimap adds source parks/water, north,
  scale and circular framing, retaining position following and touch controls.
- Detail construction is queued after PLAY by facade edge, then merged per
  building. The queue executes at most eight subtasks and aims for a 5ms work
  budget per frame; a single subtask may exceed that budget. The base world is
  playable before optional detail completes. Material loading has an explicit
  missing-file error that preserves the menu. Loading is not an invisible map swap.

## Quality and performance

The existing pause menu adds Low/Medium/High and 30/60 FPS targets. Old `lowGfx`
saves/checkbox remain supported. Mobile defaults to Medium/30; desktop High/60.
Low uses cheaper character lighting, disables shadows/post effects, reduces
resolution and detail ranges. Medium uses 1024 shadows and direct rendering;
High uses 2048 shadows and the existing composer when float targets are supported.
DPR caps are .8/1/1.5. Building LOD near/far distances are 35/120, 85/220, 160/360m.
The 30/60 limiter retains the existing maximum simulation dt and game rules.

**The target of stable 30 FPS is not verified or achieved by the test machine.**
The captured software-WebGL timing was approximately 0.61 FPS desktop High and
1.07 FPS emulated mobile Medium. This machine uses CPU rendering, not an Adreno
750 or Windows GPU, so those are neither device benchmarks nor proof of 30 FPS.
They also demonstrate why headless functional checks alone cannot certify
performance. Physical S24 profiling (CPU/GPU frame times, thermals, memory),
further draw-call reduction and content tuning remain required before accepting
the mobile performance goal. No claim is made that the image's realism is matched.

The quality checks observed roughly 691/833/856 accumulated rendering calls in
Low/Medium/High desktop views and 329/471/491 on mobile views. Counts include
shadow/post passes when enabled and depend on camera, streaming and game state.

## Licenses and source integrity

See `assets/christchurch/LICENSE.md`: original procedural textures are CC0;
geometry is authored in this project, no photo-to-model conversion or downloaded
unlicensed art. Three.js/addons stay at the pinned, unchanged MIT r170 version.
OSM attribution/ODbL remain. The geographic JSON SHA-256 is unchanged:
`8450e30bcfd21904980edd981025eb11816eed46b8acd299e1ac158694111c46`.

## Evidence and validation

`npm run test:visual:unit` checks profiles/FPS options, bounded source-footprint
selection and camera collision. `npm run test:visual` loads actual desktop/mobile
contexts, switches quality via the menu, exercises both FPS targets, captures real
frames, checks the skinned rig/Brick, renders police models, and simulates a missing
material. The test does not assert 30 FPS on a software renderer.

Final images are `visual-demo/desktop-spawn.png`, `desktop-cathedral.png`,
`desktop-brick-police.png` and the corresponding `mobile-*.png`. These are browser
screenshots, not image generation. Earlier `*-high.png` and `work-in-progress.png`
are intermediate investigation captures. Console/network logs and actual timing
are in `visual-demo/`; executed regression results are recorded there separately.

Next stages: source-verified architectural hero assets, higher-fidelity human
meshes/animation, accurate cathedral reconstruction detail, street-by-street art
passes on Colombo and park-specific landscaping, plus physical-device performance
acceptance. The demonstration is deliberately bounded; the entire city is not
presented as graphically complete. Source-envelope roof collisions remain an
approximation; the art pass does not create enterable building interiors.


## Issues found and corrected during validation

The first broad feature audit reported 56/57, with zero runtime errors: the swing
height at 0.8 simulated seconds was 0.7m in that randomly generated town. A separate
run of the same physics reached 3.2m with both 400ms and 2000ms camera settling.
A small geometry reproduction then verified that the existing fan of web rays
can bypass a narrow front facade and choose a different building. The audit now
uses a wide, unobstructed facade and a clear start to make its intended target
unambiguous. The 0.8s duration, >1m requirement, original web scoring, launch forces,
gravity and physics are unchanged. The initial failing log is retained; the full
rerun result is recorded with the final logs. The original random town was not
retained, so no unique failed-frame root cause is asserted beyond that fixture risk.

Quality reductions originally shortened the instanced tree lists, which could
hide colliding trunks. They now retain all trunks and reduce foliage layers only.
The focused `npm run test:visual:visibility` checks the actual visible-trunk count
against colliders in all modes and verifies the police check panels extend beyond
the bevelled body. The corrected livery capture is `visual-demo/police-livery-verified.png`;
the earlier Brick/police captures predate that offset correction.
