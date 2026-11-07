# Grand Theft Christchurch

The existing Three.js game now includes a real OpenStreetMap extract of central
Christchurch: Cathedral Square, Colombo Street, and North/South Hagley Park.
The bundled local data contains 9,139 road/path ways and 11,353 areas. Source
metadata and the connected landmark routes are recorded in `data/`.

Para executar fora da Prévia do ChatGPT no Windows, consulte o roteiro completo
em [docs/WINDOWS.md](docs/WINDOWS.md), incluindo dados OSM, PowerShell e diagnóstico.

Current visual/performance changes, measured results and the complete file inventory are in
[the upgrade report](docs/PERFORMANCE-UPGRADE.md). For an external browser test, follow
[the GitHub Pages instructions](docs/GITHUB-PAGES.md). `npm test` runs the complete validation runner.

## RUGBY character release

Choose **RUGBY** on the start screen, then **PLAY** to explore the real Cathedral
Square start. Weaver, Bolt and Brick remain available. The original articulated
rugby fighter uses shared procedural geometry/textures and the existing animation,
wardrobe, controls and collision interfaces. Central-area kerbs and facade details
are included. See [the Rugby art report](docs/rugby-upgrade/README.md) and
[release validation](docs/rugby-release/README.md). The visual remains stylized;
physical Galaxy S24 Ultra performance is unverified.

## Prepare and play Christchurch

Requires Node.js 18+ (validated with Node 24), npm, and HTTPS access to
`registry.npmjs.org` for installation. Runtime assets, including Three.js r170,
are served locally; the game no longer depends on a CDN. Refreshing the geographic extract
also needs `overpass-api.de` and `www.openstreetmap.org`.
Keep the environment's proxy and CA settings; do not disable TLS verification.

```sh
npm ci
npm start
```

Open the server on port 8080 in your browser. The included extract loads by default.
To refresh it, run `npm run map:fetch`. The importer writes
`data/christchurch.json` only after validating the extract and the walking
connections between Cathedral Square, Colombo Street and Hagley Park. The runtime
loads this local asset; it does not contact Overpass. After a successful import,
reload the game. `?map=legacy` explicitly selects the original map for regression
checks. A failed, missing, invalid or stalled map stops startup with a visible
error and a retry action. PLAY stays disabled until the real map and all game
systems are ready. The game never switches to the fictional map on failure;
`?map=legacy` is an explicit regression/development choice.

The default spawn and real-map respawn use a validated Cathedral Square sidewalk
or pedestrian surface. The F8/touch travel button says **Ir para**: it names the
destination, not the player's current district. The minimap centres on the player
before the first visible game frame. `npm run test:spawn` and
`npm run test:spawn:browser` check this start and access to Colombo Street.

Cars use directed OSM road segments and left-side lane offsets; pedestrian areas
are excluded from ordinary traffic. Geographic buildings use OSM footprints and
polygon collisions. Missing heights are estimated, so this is not an architectural
reconstruction. Static geometry is batched in spatial chunks for mobile browsers.

Original block-based activities remain in a separate **fictional Arcade District**,
with all original systems still initialized. The travel button (or F8 on desktop)
connects it to Cathedral Square while on foot/in a car, outside active missions
and police pursuits. The district and its harbor are game areas, not real locations.
Near-spawn services, procedural mission destinations, pedestrians, traffic,
parked vehicles and police use the geographic map when it is loaded.

## Cathedral Square visual demonstration

The first art pass adds modelled facades, a footprint-based restoration-era
Cathedral, original PBR textures, instanced vegetation, articulated characters,
detailed vehicles and NZ-inspired police styling around the playable start.
Pause → QUALITY selects Low/Medium/High; FRAME RATE selects a 30/60 FPS target.
Mobile defaults to Medium/30. These targets are not certified device performance.
See [docs/VISUAL-DEMO.md](docs/VISUAL-DEMO.md) for actual captures, licensing,
software-renderer measurements and unfinished realism/performance work.

```sh
npm run test:visual:unit
npm run test:visual
```

## Validate

```sh
npm run test:preview             # mobile iframe captures and real scene pixels, normal graphics
npm run test:startup:unit        # bounded JSON loading and failure handling
npm run test:map                 # projection, one-way routing, left lanes, collisions
npm run test:map:browser         # explicit synthetic integration fixture, desktop + touch
npm run test:map:data            # real landmark connectivity, source and directed lanes
npm run test:map:real            # real extract in Chromium, desktop + mobile
node --import ./test/browser-setup.mjs test/season8btest.mjs
```

Keep the server running for browser tests. `test/browser-setup.mjs` uses system
Chromium when available (`GTC_BROWSER_PATH` overrides it) and the inherited proxy.
`GTC_LOW_GFX=1` selects the game's supported low-graphics setting for software
renderers. `GTC_TEST_MAP=legacy` runs existing scripts against the original
map; the default remains the real Christchurch map. Other existing suites remain in `test/`; some print FAIL without a
nonzero exit, so read their results as well as their exit status. See
[data/README.md](data/README.md) for provenance/licensing and import limits.

The initial menu does not allocate WebGL resources. PLAY keeps it visible until
a first frame passes framebuffer/pixel checks. Previews without float render
targets use direct rendering of the same world. Invalid/empty cached HTML gives
a recovery screen instead of a blank page. Visual before/after evidence and
console/network logs are in [docs/BLACK-SCREEN.md](docs/BLACK-SCREEN.md).

Startup failure reproduction and browser test commands are documented in
[docs/STARTUP-FIX.md](docs/STARTUP-FIX.md). `npm run vendor:three` reproduces
the local engine/addon files after `npm ci`; no engine version was changed.

---

The following documents the preserved original game and its controls/features.

A GTA-style open world **crossed with Spider-Man traversal**, running entirely
in your browser. No bundler is required — the pinned local Three.js engine and
plain JavaScript ES modules. Steal cars, fly helicopters, rob stores, fight a
gang for territory, outrun tanks at five stars... or ignore all of it and
web-swing between the towers at 200 km/h.

Ten "seasons" of updates have piled onto the original open world: zombie
outbreaks, a kaiju that rises from the harbor, train heists, a mayor's
office, an empire of owned properties, a casino heist, a subway, a
nightclub, a chess hustler, ghosts, a boss-rush gauntlet, and dozens more
side systems described below. The code is plain ES modules — one file per
system, ~140 of them, all wired into `js/main.js`.

## Run it

Any static file server works. The easiest:

```
npm start
```

(or `npx -y http-server -p 8080 -c-1 .`)

Then open **http://localhost:8080** and click PLAY.

## Controls

### On foot & webs
| Input | Action |
| --- | --- |
| W A S D | Move (Shift = sprint, Space = jump) |
| Mouse | Look around / aim |
| **Right Click (hold)** | Web-swing — release at the front of the arc to fly |
| **Right Click (tap)** | Zip straight to a rooftop |
| Space / Shift (mid-swing) | Reel the web in / let it out |
| **W into a wall (airborne)** | Wall-run up it — Space kicks off |
| **Q** | Web-shot (again on a webbed enemy = **web-yank** takedown) |
| **F** | Punch combo on the ground · **web-dash** in the air (level 4) |
| Double-tap W/A/S/D | Dodge roll with i-frames |
| C (hold) / T | Charge super-jump / sling a web trampoline |
| **M** | Full city map — click to set a waypoint |
| **L** | The LEGEND board — 16-item completion list; 100% crowns you King of the City |
| **P / Esc** | Pause: settings, lifetime stats, photo mode |
| Left Click | Shoot |
| 1–6 / **X** | Pick weapon / cycle: Pistol, MG, Shotgun, Sniper (scoped), RPG, Grenade |
| **J** | Jetpack on/off (once bought — Space climbs, C drops) |
| **Z** | Send REX to bite the nearest enemy |
| E | Enter vehicle / rob store (hold) / casino / bank vault (hold) / bounty board / lotto / fight club |

### Vehicles
| Input | Action |
| --- | --- |
| W A S D | Drive / fly / boat |
| Space | Handbrake / helicopter up |
| Shift | Helicopter down |
| **R** | Cycle the car radio (5 procedural stations) |
| Left Click (in tank) | Fire the cannon |
| **V** (in a police car) | Start a **vigilante** chase streak |
| E | Exit — mid-flight in a helicopter it's a **skydive** (hold Space for the chute) |

### Gamepad
Plug one in and play: left stick moves, right stick looks, **A** jump/up,
**B** sprint/down, **X** enter/exit, **Y** web-shot, **LB** radio,
**RB/LT** web-swing, **RT** shoot.

## Features

### Spider-Man traversal
- **Web swinging** — physical pendulum on buildings; anchors picked high and
  ahead so swinging down a street just works. Swing pump builds speed, the
  rope auto-winches clear of the asphalt, releases slingshot you into a
  floaty glide with seconds of hang-time to chain the next web.
- **Zip-to-point**, **wall-running**, rooftop landing with a forgiving
  superhero roll, and a **style meter**: mid-air catches, fast releases,
  wall-runs and zips earn points that cash out as money when you land.
- **Web attack (Q)** pins pedestrians, gangsters, traffic — even cop cars.

### The city
- Procedurally generated 64-block dusk city: towers with glowing windows,
  neon billboards, rooftop clutter, parks, helipads, street lamps.
- **Day/night cycle** (1 real minute = 1 game hour): the sun sets, windows
  light up, headlights come on, street lamps glow.
- **Weather**: rolling rain storms with lightning that dim the sky.
- Living streets: 70 pedestrians who flee gunfire, AI traffic that brakes,
  **pigeon flocks** that scatter, **rush-hour and night traffic density**,
  fewer people out after dark.

### Crime & economy
- **Rob the corner stores** (green rings, hold E) — cash plus 2-star heat.
- **The bank job**: crack the City Bank vault (hold E), hold the lobby
  against guards while the drill runs, then escape a 4-star manhunt to the
  safehouse beam. Once per in-game day, $3000.
- **The armored truck**: a 400 HP cash transporter runs routes every few
  minutes (gold square on the minimap). Wreck it for $1000 plus a ring of
  spilled cash cubes — and the heat that comes with it.
- **Vigilante**: steal a police cruiser mid-patrol, press **V**, and chase
  down fleeing criminals. Every takedown chains a tougher, faster target;
  payouts escalate and your best streak is saved.
- **The Lucky 7 casino**: blackjack (hit/stand/double, 3:2 blackjack), a
  slot machine (7-7-7 jackpot pays 25×) and European roulette (red/black,
  dozens, or a 36× lucky number) — walk in with E, hop between the games
  at the table.
- **Property raids**: own real estate and crooks will come for it — a crew
  hits your casino/stadium/Spire every few minutes. Wipe them out for cash
  and rep, or the place gets ransacked and pays no income for the day.
- **Gang territory**: the Vipers hold the north-east district and shoot on
  sight. Put ten of them down to seize the turf — then defend it when the
  **Jackals raid** in periodic turf wars, or lose the district again.
- **REX the dog**: adopt him at the kennel near spawn ($500). He follows
  you across the city, fetches money pickups, and barks when cops close in.
- **Odd jobs & toys everywhere**: ambulance rescues, harbor vehicle exports,
  bounty contracts with bodyguards, a bare-knuckle **fight club** on the
  waterfront after dark, a lottery kiosk, **five-card poker** at the casino,
  a **jetpack** shop, BASE-jump ring trials off the Spire, ten golden sky
  hoops — and strange lights over the Spire past midnight.
- **The WEB DEN** near spawn sells permanent upgrades: longer webs, faster
  winch, body armor (150 HP).
- Money & health pickups, ammo crates, and a style meter that pays for flair.

### Wanted system
- 5 stars of escalation: police cruisers ram and corner you, the **police
  helicopter** with a door gunner arrives at 3 stars, and at **5 stars the
  army sends a tank** — 600 HP, live cannon... and stealable. Left-click
  fires shells while you drive it.

### Vehicles
- Steal any car — arcade physics, handbrake drifts with **skid marks** and
  tyre smoke, speed-sensitive FOV.
- **Motorbikes** (every 4th parked vehicle): fast, nimble, lean into corners.
- Helicopters on the park helipads. Space to climb — it always wins over a
  held sprint key.
- **Boats & jet-skis** at the harbor past the east edge — plus two boat
  races (Harbor Circuit and Buoy Slalom).
- **Car radio**: five procedural WebAudio stations (lofi, synthwave, bass,
  desi, night jazz).

### Missions — ten types in rotation
Walk into the yellow beam: **Delivery**, **Street race**, **Swing race**
(floating sky rings, webs only), **Taxi shift**, **Hit contract**,
**Boss chopper**, **Firefighter**, **Rooftop hit**, **Witness escort**, and
a **rival web-slinger** duel. Rewards scale as you complete more — plus
free-roam races, the stadium arena, the bank heist, vigilante chases and
turf wars outside the mission beam.

### Beyond the basics (Seasons 2–10)
Ten waves of updates layered a second game's worth of systems on top of the
core loop above. A sample of what's actually in `js/`, all reachable in a
normal playthrough:
- **Boss fights & events**: a rival **nemesis** web-slinger, a **kaiju** that
  wades out of the harbor on stormy nights, a **zombie outbreak** after dark,
  a **war-mech boss rush**, and city-wide **disasters** (forced via cheat or
  random).
- **Heists & crime careers**: a **train heist**, a **casino heist**, a
  **jewelry store job**, a **drug lab raid**, a **black-market arms dealer**,
  a **repo man** side gig, and an undercover **cop career** you can take
  instead of a life of crime (complete with **prison** intake if you get
  caught).
- **City institutions**: a **mayor's office** and city **empire** (buy up
  properties for passive income), a **stock market**, a **museum** heist, a
  **nightclub**, a **subway/metro**, a **crew** you can recruit, a
  **syndicate** campaign, and a rotating **calendar** of city events.
- **Odd jobs**: **taxi driving**, **pizza delivery**, **valet parking**,
  **car wash**, **barber shop**, **ferry** routes, **ice cream truck**,
  **news helicopter** ride-alongs, **storm chasing**, **busking** for tips,
  a gun **workbench**, **fishing**, a **gym**, a **fortune teller**, **dice**
  games, and a **hobo** you can hand money to.
- **Traversal toys**: **wingsuit**, **skydiving**, **base jumping**,
  **ziplines**, a hot-air **balloon**, a **drone**, a **skateboard** and
  **trick park**, a **derby** (demolition-style), and street **elevators**.
- **World detail**: **ATMs**, **payphones** (with side jobs), **graffiti**
  tagging, **fire hydrants**, **speed cameras**, parking **meters**, **NPC
  emotes**, **wildlife**, **ghosts** at night, and vehicle **damage/tuning
  effects**.
- **Meta systems**: **prestige** (reset for permanent perks), **perks**,
  **bribes** and a **lawyer** to clear your wanted level, a **pink slip**
  (car-ownership) racing mode, a **most wanted** board, a **bounty** system,
  a **bodyguard** you can hire, **tournament** and **poker tournament**
  brackets, an **explorer** log, and **cheat codes** (see the pause menu).

This list still isn't exhaustive — check `js/` for the full set of ~140
feature modules, each one self-contained and imported into `js/main.js`.

### Progression
- **XP levels** unlock skills: double-jump (2), web-dash (4), slow-motion
  airborne aim (6), parkour sprint (8).
- **Wardrobe suits** with perks: Classic (+50% style), Symbiote (2x melee,
  10s webs), Stealth (heat fades twice as fast).
- **Lifetime stats and 10 achievements**, all in the pause menu.

### Tech
- **Playable on phones**: virtual joystick + buttons, and it's a **PWA** —
  add to home screen, runs full-screen, works offline after the first load.
- Pause menu with volume / sensitivity / invert-Y / low-graphics settings,
  **photo mode** with filters, full-screen map with waypoints, chase music
  that swells with the wanted level, NPC speech bubbles, intro flyover.
- Procedural WebAudio everything — guns, explosions, engines, sirens, rotor
  thump, thunder, mission stingers, radio. Zero audio files.
- Post-processing bloom, ACES tone mapping, PMREM reflections.
- Autosave to localStorage: money, missions, ammo, upgrades, territory.
- WASTED / BUSTED screens, HUD with minimap (cops, choppers, stores, gang
  turf, tanks), live WASD key indicator.

## Tech stack
- **[Three.js](https://threejs.org/)** r170, served from `vendor/three/` via
  an `importmap` in `index.html` — no bundler, no `node_modules` for the
  game itself.
- Plain **JavaScript ES modules**, one file per system, imported directly by
  the browser.
- **Procedural WebAudio** for every sound effect and the car radio — no
  audio files ship with the game.
- **[Playwright](https://playwright.dev/)** (`playwright-core`) is the one
  `devDependency`, used only by the scripts in `test/` to drive the game
  headlessly and assert features work; it isn't needed to play.

## Project structure
```
index.html   HUD, start screen, styles, Three.js import map
manifest.json / sw.js   PWA manifest + offline service worker
js/main.js   Game loop, player, camera, swinging/zipping, shooting, style
js/          ~140 self-contained feature modules (one per system — cars,
             police, heists, missions, side jobs, etc.), all imported by
             js/main.js. See "Beyond the basics" above for what's in here.
test/        Playwright smoke tests that drive the game in a real browser
             and assert individual features work (run against a local
             server, e.g. `node test/featurecheck.mjs`).
PLAYSTORE.md How to package the PWA as an Android app (Trusted Web Activity)
             for the Google Play Store.
privacy.html Privacy policy page (required for Play Store / PWA install).
```

