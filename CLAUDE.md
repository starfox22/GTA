# Dead End City: working notes for Claude

A browser top-down crime game (GTA 1/2 style, 1997 South Coast; Three.js r160 3D with a 2D
fallback). ~260 source files in `src/*.js` are spliced by `// @include src/x.js` lines
(recursive, from `src/main.js` → `src/game.js`) into one closure inside one HTML page by
`tools/build.py`. No bundler, no npm, no minification. Ships as a claude.ai artifact (split
build: `index.html` + `media/` holding the music and the media packs) and as a downloadable
zip folder.

**Picking this project up cold? Read `docs/HANDOFF.md` first** (state, owner preferences, workflow that
worked, open items), then the rules below.

## Commands

```sh
sh tools/quick-check.sh [tag]            # BEFORE EVERY COMMIT: syntax + build + FILEMAP + conflict markers (seconds, no browser)
sh tools/check.sh [tag]                  # syntax gate only (dist/check/<tag>.{html,js})
python3 tools/build.py                   # dead-end-city.html (local, git-ignored: never commit it)
python3 tools/build.py --out dist/game.html            # scratch build
python3 tools/build.py --split-media dist/publish      # dist/publish/index.html + media/ (*.mp3 + pack-*.js): the artifact
python3 tools/verify-pages.py dist/pages https://example.github.io/game/  # verify every publicly served Pages file against the local artifact
python3 tools/build.py --zip dist/DeadEndCity.zip      # DeadEndCity/{index.html,media/,README.txt}; CI uploads branch artifacts, updates "latest" only from main, and publishes versioned releases for tags v*. The October 11 legacy review branch and permanent `codex-reviews` branch also publish commit-specific prereleases.
python3 tools/filemap.py                 # regenerate docs/FILEMAP.md after adding/removing/renaming files
node tools/smoke.mjs dist/game.html dist/smoke         # boot, FPS, walk, drive, map, both cameras: 6 screenshots
node tools/tour.mjs steps.json dist/tour dist/game.html   # scripted screenshots (?dev console)
node tools/layout-audit.mjs dist/game.html             # city-plan overlaps (~59 oblique-junction notes, county and Monarch, are expected)
node tools/media-check.mjs dist/publish/index.html     # streamed tracks load over file://
python3 tools/changelog.py --new <topic> "<Title>"     # start a changelog fragment
```

Run smoke too when a change touches boot, rendering, input, HUD or anything a console call
cannot prove. Smoke passes with 0 errors (the three.js "build/three.js deprecated" warning is
normal). Headless = Playwright + SwiftShader via tools/browser.mjs (cloud: Chromium in
`/opt/pw-browsers`, never `playwright install`; elsewhere `CHROME_PATH`/`PLAYWRIGHT_MODULE`,
and `DEC_GPU=1` renders on a real GPU); it runs a few fps and boots in a minute or more.
**Browser slots**: every browser tool takes one of `DEC_BROWSER_SLOTS` machine-wide slots
(default half the cores: 2 in the cloud) and queues when none is free; the dev server
freezes its page and gives its slot back after `DEC_IDLE_FREEZE` s idle (default 20; the
next command thaws it, state kept).

**Verifying cheaply** (use these instead of writing Playwright scripts):

```sh
node tools/test.mjs [filter] [--verbose]      # regression suite (~40 s, no-render page): after logic changes
node tools/test.mjs name.mjs --exact --html dist/frozen.html # exact selection against an immutable candidate
                                              # (`dev.mjs stop` between separate runs: a leftover server fails boots with
                                              #  'browser.newContext: Target page ... closed')
node tools/dev.mjs start [--render]           # ONE persistent headless page (~7 s no-render, ~35 s rendered)
node tools/dev.mjs call <method> [json...]    # a NAMED DeadEndCity method → compact JSON (--max N / --full)
node tools/dev.mjs keys KeyW,KeyD 3 | wait 5  # simulate() game seconds (--real: real key presses)
node tools/dev.mjs shot <name> [--crop x,y,w,h] [--width 480]   # small JPEG in dist/dev/shots/
node tools/dev.mjs reload | errors | stop     # rebuild+reload after edits (fresh profile) / console errors / quit
node tools/dev.mjs reload --keep             # reload with the same browser profile (check a save survives)
node tools/dev.mjs start|reload --shadercheck # report three.js shader compile errors: after any GLSL edit
```

The default dev page is `?dev&norender` (`NO_RENDER` in render3d.js: no WebGL, ~55 fps). Use
`--render` (or `reload --render`) only for images, after `call graphics high` (bare words pass as strings). `--nodev`
boots `?test` (demo gate live). New test: one file `tools/tests/<name>.mjs` exporting
`default async (t)` (`t.call/keys/wait/assert/near/finite`); set up the state it needs,
`fresh = true` for a clean page. The live frame loop runs between console calls: a test
that depends on exact timing (keys, goals, calls) should `holdSimulation(true)` and step
with `t.wait`/`t.keys`, then release it. Console calls like `interact()` skip the per-frame key
handling: when removing or changing an action, also press the real key (`t.keys(code, s, { real: true })`,
tools/tests/enter-key.mjs); `t.mouse(x, y, {seconds, down, keys, taps})` / `dev.mjs mouse` drive the real
pointer (screen pixels from console methods such as `driveByScreenPoint`). The dev server holds a browser slot while awake: `stop` it
when you are done with it (and before smoke/tour if slots are short).

**Publish** (only when asked): `python3 tools/build.py --split-media dist/publish`, then the
Artifact tool with `file_path` dist/publish/index.html, `url`
https://claude.ai/artifact/NtDPAmpmNsgU8LPW4hH13B and a `files` map with one
`media/<file>` → `dist/publish/media/<file>` entry for **every** file in dist/publish/media/
(the nine radio `.mp3`s and the `pack-*.js` media packs: `ls dist/publish/media`). If the
tool refuses because this session hasn't read the live page, republish at once with
`force: true` (the owner's standing permission for this link only; never read the page).
Limits: the page ≤ 16 MB (it is ~9 MB of code: media never goes in the split page), each
file ≤ 15 MB (packs split themselves at 12 MB), 511 files / 256 MB per version. New media:
add it to assets/ + manifest and it lands in a pack automatically; the split page loads
packs with plain `<script src>` so the zip still plays from file://.

## Rules

- **Scale**: `UNITS_PER_METRE` = 8; 512-unit city block = 64 m; Monarch Isle blocks 800
  units = 100 m. Speeds `50 * KMH`, accelerations `0.8 * GRAVITY` (9.81 × 8).
  `PERSON_HEIGHT` 1.75 m (`PERSON_SCALE` only converts old offsets); `STOREY` 3.2 m,
  `SHOP_FLOOR` 4.5 m, `DOOR_HEIGHT` 2.3 m, `realBuildingHeight()` for plan heights;
  vehicle `modelScale` 1 = real-size model. Map (x, y) → Three.js (x, elevation, y), yaw −a.
- **Contracts other code relies on** (keep signatures and meaning):
  `helicopterSearchlightMount(c, out)`, `overheadCover` / `overheadCoverHeight`
  (air-cover.js), `vehicleSpec()`, `c.braking`, `spec.abs/esc/tcs`, `DEMO_BUILD`
  (game-state.js), `entityElevation()` (only height comparison), `teleportPlayer()` (only way
  to move the player; releases every carrier), `solid()` (people collision), `crime()` (only
  heat source), `offerPrompt()` (only prompt writer), `actionHeld()`/`keyName()` (never
  literal keys). Details: docs/areas/core-and-contracts.md.
- The mission card never covers the player: `missionCardFolded()` (hud-clearance.js) folds it, its reading time
  held, while `hudPlayerBox()` meets the open card; the strip, the dialogue line and the waypoint pill fade
  (`.yield-fade`) only as a last resort. HUD layout reads go in `measureMissionCard()` at the start of `runFrame`;
  a new HUD box that can sit over the player joins this. `hudOverlaps()` lists overlapping boxes and
  tools/tests/hud-layout.mjs holds 960x600 at zero. `teleportPlayer()` also ends a train ride (`dropTransitRide`)
  and steps the player out of a vehicle with nowhere to step out to; only an aircraft in the air comes along.
- `tell(text, s, {id, tone})` (hud-notify.js) is the only notification writer; hints use
  `pressKey()`/`keyPrefix()` (input-hints.js), never `'Press ' + keyName()`.
- FPS is on by default (preserve an explicit saved opt-out); only live frame intervals enter its sample,
  reset on visibility changes. Left and right mouse releases are independent; focus loss, pause, help and the map clear both.
- Positioned audio uses `soundRight(dx, dy)` for horizontal placement: final chase-camera yaw in chase view,
  unchanged world-X placement in the overhead view. Keep attenuation and occlusion relative to the player.
- Saved `retryJobIndex` remembers an unlocked unfinished/failed job for restart from its beginning; it never
  restores a mission stage/world snapshot. Wins and new games clear it; old saves and demo/story gates stay valid.
- Chase cloud budgets live in `SKY_CLOUD_QUALITY`; the distant chase sampling approximation never alters the
  original flight/overhead cloud field. History resets on discontinuities and compensates wind drift.
- The chase shoulder, boom and upward crane respect indexed overhead-cover slabs as well as buildings;
  preserve open space below/above canopies and query adjacent grid cells for the near-plane margin.
- NPC body armour: `ballisticDamage(person, damage, kind, calibre, zone)` with `VEST_STOP` (combat-rules.js NPC BODY
  ARMOUR) is the only rule for what an NPC vest stops: torso only (`strikePerson` picks the zone first), soft vs
  `vestPlate`, by calibre (weapon `cal`, `bulletCalibre`). A new armoured NPC sets `vest`/`vestPlate`; a new gun sets
  `cal`. A round never moves a person (only blasts, vehicles, knives, punches); `bleed` sprays a round's exit blood
  away from the shooter. `shotsToKill()`; tools/tests/bullet-hits.mjs. Pool sizes live in `bodyPoolPlan` (blood.js).
- Gore (gore.js; police-and-combat-gore.md): `goreHit()` is the only rule for a hit's class, range, blood scale and what
  comes off; strikePerson calls it first, and `detail` (`{range, power, heavy, pellets}`) passes what the shooter's
  distance cannot. `p.goreLost` (GORE_* bits) and `p.goreWounds` are the only gore state (bump `p.goreVersion` on any
  change; renderers only read them); a new heavy gun sets `goreCal: 'heavy'` on its bullets. Blood and gore randomness
  is `goreRandom`; severed pieces, stumps, tracked people and gore events are capped and listed in `soakReport` (a new
  list holding people is retired by `updateSeveredParts` / `updateGore`). Blood decals draw only through blood3d.js (one
  instanced draw); the spray reaches walls and cars only through `bloodSprayObstacle`, flying drops land through
  `landBloodDrop`. Every rigPart carries `crowdWound`; on the player's body a lost part folds by `pbSkin.w`.
  Blood decals' look is per instance (`aBloodLook`: fade, dry, wash) in one program, specular capped and tinted. Where
  gore particles start is `goreJointPoint` (the drawn pose via `city3D.goreCutPoint` when there is one): cosmetic only.
- `shooterInView()` (combat-rules.js) is the only rule for whether an NPC may fire at the
  player (on screen, from the camera footprint `screenViewHalf`): every new shooter checks it.
- No pickups on the street at all: health is bought indoors (hospitals, diners, bars, clubs,
  motels, county lodges: `serviceAction`, citylife-police.js); rounds come from gun shops,
  `lootInteract` (bodies, once) and `takeVehicleArms` (police vehicles, once) in ammo-supply.js.
- `bleed(entity, severity, heading, kind)` (blood.js) is the only way to add a wound's blood; a
  pool only forms under a body on the ground (`bodyPool`) and spreads in `updateBlood`.
  Blast blood (blood.js BLOOD BLAST SPRAY): `bleed(p, sev, a, 'blast', hit)` with `a` the heading from the blast to the
  victim; `bloodBlastPush(hit)` is the only rule for the cone and carry, nothing flies back toward the blast; the
  player's `hurt(d, 'blast', a)` passes the heading. A round's air spray is `bloodShotPlan().air` (bounded by
  `BLOOD_AIR_ROOM`); flying drops draw at least `FX_BLOOD_MIN_PX` and streak (`FX_BLOOD_STREAK`); tools/tests/blood-spray.mjs.
- Shooting from a vehicle goes through `driveByAim(vehicle, heading)` (driveby.js): arcs per
  window and body live in `spec.driveBy`; the bullet and the pose both use `driveByGrip`. A car fires all round, a
  body with no rear window 270°; a blocked aim fires nothing and shows only the cross
  (`#driveByCross`); at the wheel the driving keys never take the aim from the pointer (game-input.js).
- **Police need a report**: `crime(amount, how)` with no stars counts only if police see or
  hear it or a witness call completes (witnesses.js); scripted crimes that must raise stars
  pass `'seen'`; `witnessReport(person, kind, x, y)` makes someone phone 911. Crowd
  perception (`p.pending`) is resolved in updatePeople before any special routine: a new
  routine that owns people must step aside when `p.react`/`p.flee` is set.
- `personFemale()` (voices.js) is the only man/woman rule (looks and voices both use it);
  `player.carjack` is a carrier (`cancelCarjack()`). Carjack phases live in carjack-struggle.js
  (`planCarjack`/`job.quick`); only bikes, boats and aircraft use the instant `ejectDriver`;
  ~1/3 of traffic is locked (E says LOCKED), which is not the carjack failing.
- New land or bridges: append to `LAND_REGIONS`/`BRIDGES` last and keep coast-walk rhythms
  and grid blocks unchanged (compare `layout()` with the base build). Tall towers only where
  nothing stands north of them (the camera looks north): North Point Key, Monarch One.
- Drawbridges (world-and-map-drawbridges.md): every `movable` bridge in `BRIDGES` has one state in `drawbridgeList()`
  (its plan in `bridge.drawbridge`); raise and lower only through `drawbridgeOpenNow(d)` / `drawbridgeCloseNow(d)`, never
  by setting `d.angle`. Traffic controllers call `drawbridgeTrafficLimit`, pursuit `drawbridgeSpanLimit`; a car on a leaf
  carries `c.deckBridge`. Every island with more than one road bridge keeps a drawbridge (`bridgeIslands()`) and the
  timetables keep `drawbridgeOpenShare().share` >= 0.5 (tools/tests/drawbridge-islands.mjs). A bridge appended later
  that lands on a sea wall keeps the coastline rhythms through `lateBridgeLanding(e)`.
  `drawbridgeRaisedAt()` is the shared proximity gate for deck settling and the parked-vehicle shortcut.
- North Point Key visitors (livingcity-key.js) are the only traffic on the Key; its inbound
  lane runs 17 units off the centre line, not 24 (the sea-wall rail reaches onto the deck).
- The Blue Hour: `BLUE_HOUR_ENTRANCE` (roofmission-entrance.js) is the only plan for the hotel's
  forecourt (canopy, limousines, staff); street furniture stays off it via `blueHourForecourt()`.
  Terrace furniture stays inside `roofCover` footprints or the 14-unit strip along the railings.
- Roof lifts: every roof in `roofHelipads` or with a parked helicopter gets a lift (roof-lifts.js `ROOF_LIFTS`, `b.roofLift`);
  the ride is skyline-lift.js `startSkyLift`/`updateSkyLift` on the lift's own fields; `roofLifts().missing` stays 0.
  Vehicle entrances (vehicle-entrances.js): parked things keep off `vehicleEntranceAt()`; villa garage doors are
  `plan.garageDoor.open` (monarch-garages.js), people via `villaGarageBlocked`, vehicles via the door body's `minHeight`.
- Respray garages are marked only in a chase: `garageBeacon()` (garages.js RESPRAY BEACON) is the one rule; renderers
  read it.
- Every drivable island has a respray garage (`GARAGE_ISLANDS`, garages-shops.js; checked by
  tools/tests/garages-islands.mjs).
- Every island, North Point Key included (every LAND_REGIONS id maps to one in `PAYPHONE_REGION_ISLAND`), has at least
  two story payphones (`PAYPHONES` / `PAYPHONE_ISLANDS`, payphones.js; the original
  `phone` is index 0): a waiting call is answered at any of them (`payphoneInReach()`), the pointer guides to
  `storyPayphone()` (nearest, with hysteresis); a new one passes `payphoneAudit()` (tools/tests/payphones-islands.mjs).
- `playerImpact()` / `fallInjury()` / `riderInjury()` (falls-body.js) are the only fall-damage
  scale (a survived fall is `hurt(…, 'fall')`, which draws no blood);
  `player.fall` is a carrier. The parachute opens only on a second `bail` press; its
  opening stages live in one model that `parachuteForecast()` (parachute.js) also steps
  for the freefall cue: change them there only. Rig objects are `userData.dynamic`
  (flight-view3d.js `tagSceneryDetail` otherwise hides small meshes from the flight camera).
- `tyreEmission(c)` (tyre-effects.js) is the only rule for tyre smoke, dust and spray: smoke only
  from a burnout (`burnoutStep`); skid marks only through `layTyreMarks`; renderers only draw them.
- Jump on foot (player-jump.js): `player.jump` is a carrier (`cancelPlayerJump`); what a jump clears is a solid's `height`
  (foot furniture `jumpH`, props `JUMP_PROP_HEIGHT`, the sea railing `PROMENADE_RAIL_HEIGHT`, villa walls `villaWallHeight`
  = what monarch-villas3d.js draws) skipped through `solidSkipBelow` only in the jumping player's own step (`footSolid`),
  never elsewhere: a hop clears 1.05 m, a running vault (`jumpVaultAhead`) up to `JUMP_VAULT_MAX` 1.5 m. In the air
  `shoreStepBlocked` lets him off land or a dock (never a bridge or the pier) into the sea; the fall carries `fall.jumped`
  and ends swimming. Fort Sentinel, the theme park and the Marea keep their blockers out of it. Space is `jump` on foot,
  `handbrake` driving, `rockets` in the air. The take-off effort sound is player-jump-audio.js `jumpEffortSound`.
- `c.wheelie` (wheelie.js) is the only two-wheeler pitch; wheelie input is `wheelieHeld()` (controls.js).
- Objectives have no ground ring or light pool: the floating arrow (render3d-effects.js `arrowGroup`, shown
  by `objectiveArrowShown()` in markers.js) is the only pointer; the ring under the player is the `playerRing`
  setting (off by default, `playerRingOn()`). Console `markers()` lists what marks the objective and the player.
- World reset (missions-and-demo-world-reset.md): `resetWorld(reason)` (world-reset.js) is the only way the world goes
  back to normal, and only on WASTED, BUSTED and a new game; taking a job (the payphone call, a mission pick, RESTART
  CURRENT JOB) never resets it: `resetMissionState` removes only the jobs' own vehicles and actors (the payphone call,
  `startMission(true)`, also keeps the police pursuit); entities come only from
  `populateWorld()` (boot seed replayed); a system that keeps world damage or holds vehicles or people outside the
  populate lists adds a reset helper next to its state, called from `resetWorld`; renderer-held damage clears when
  `worldResetSerial` changes; progress (cash, weapons, story, owned cars, settings) is never reset.
- Minimap marks (world-and-map-minimap.md): minimap-rules.js MINIMAP MARKS decides what the minimap draws over its base
  (objective/GPS, waypoint, mission entities, police and nearest respray while wanted, the waiting call's payphone, places
  only on foot within `MINIMAP_NEAR`); a new map painter takes `big`, follows these rules on the minimap and counts its
  marks with `mapMarkCount` (tools/tests/minimap-clutter.mjs); the big map keeps every layer. Sunset Pier's rides: park-map.js.
- Road routes for the GPS and the waypoint pick their ends through `navRouteEnds()` (map-objective.js), which keeps both on one
  connected road network; a mission vehicle the player is after is marked on the maps only through `mapHighlightVehicle()`.
  Trunks close only through `closeTrunk` (the action key via `trunkCloseTarget`, or `slamMovingTrunks` past walking pace).
- `missionIndex` is both the story frontier and the job a replay picked: anything that ends or declines a replay
  calls `settleDemoStoryIndex()` (campaign.js: back to `completed` for any player without god mode), or the
  payphone offers the old job. RESTART CURRENT JOB restarts only `restartableJob()` (story.js: the running job or
  the last failed one, `retryJobIndex`), never a waiting call. Console `pointers()` lists every story pointer.
- Missions 3-4 (docs/areas/missions-summit-and-fort.md): the summit cache is drawn only from `summitCacheView()`;
  a story character at the wheel carries `missionDriver` (declared in makeCar, copied to the driver on foot by
  `makeCarDriver`; `streamableWalker` never moves him) and a scripted walk is `p.missionWalk` (`updateMissionWalker`
  steps aside for a reaction). The lockpick is `LOCKPICK_INDEX` (arsenal.js, a TOOL, never in `weapons`); trunks and
  lock picking go only through vehicle-trunk.js (`c.trunkLoot`, `trunkPoint`, `openTrunk`/`closeTrunk`, never
  `c.trunkOpen` by hand); a pick is reported only by `lockpickWatcher()` (someone close and looking, or police).
  Fort Sentinel cover (fort-cover*.js): `fortCoverShielded()` is the only exception to `militaryThreatened`,
  `fortCoverOwnsGate()` the only replacement for the gate challenge, `fortCoverBoarded(c)` the only military-vehicle
  rule; every hook checks `fortCover.active`, so free roam is unchanged; `player.uniform` is the borrowed uniform.
  The gate arm blocks people too and lifts only via `fortCoverGatePass()`, military traffic or a forced gate; boarding any
  military vehicle under cover or inside the fence is five stars (`fortCoverBoarded`); `militaryAudit()` stays ok.
  The CIRRUS meeting (skyline-meeting.js) is driven only through `skyMeetingBegin/End/Report/Target` and
  `skyMeeting.stage`; a seated player is `player.sceneSeat` (`teleportPlayer` clears it); CIRRUS staff are lent only
  through `keyPerson.errand`. A conversation with the player marks its lines with `speechMarkTalk(p)` (crowd-speech.js TALK LINES);
  a player line outside a job reads in the subtitle via `sceneLine`; leaving a scene seat goes through `skyMeetingRise`;
  E advances the meeting's lines.
- Mission briefs (mission-brief.js): `missionBrief(text, opts)` is the only writer of the big centred step sentence;
  it waits for a centred headline (`#announcement`) and folds into the pager strip (O folds it early). A long line of
  dialogue goes in the subtitle (`missionLine`), never a speech bubble that size (`fortGateLine`); Fort Sentinel's
  gate is talked through `FORT_GATE_TALK` (feet held by `fortGateTalking`), and in uniform `militaryInteract` never
  forces the gate.
- Service counters never sell nothing: health items in `SERVICE_CURES` and armour are refused when full
  (citylife-police.js `serviceAction`).
- Mission vehicles take gang small-arms damage through `missionCageShare` (combat-rules.js `MISSION_CAGE`: 32 %
  above half health, down to 6 % below 30 %); mission 1's cargo-bay balance is held by tools/tests/mission1-bay.mjs.
  A pick in the mission picker while a job runs goes through the ABANDON confirm (campaign.js
  `showAbandonConfirm` / story.js `abandonMission`). Hints follow the HUD on screen (input-hints.js `hintDevice`:
  gamepad names after pad input, touch names while `body.touch-mode` is set, else keys).
- Every service place has a real building and its door on the pavement: no floor rings, no free-standing place
  signs. Motels, inns and lodges are dressed by `dressHotel()` (civic3d-hotels.js). County boards (guide,
  scenic-view, town, trailhead) are drawn only through `roadsideSign()` (county3d-signs.js) at the spot
  `signSpot()` (county-guide-signs.js) finds clear of asphalt; never `sign()` for scenery in open country.
- Blood on vehicles: `c.stains` (car-stains.js `addCarStain`/`clearCarStains`) is the only data, including the
  `reach`, `flow` and `creep` that `updateCarStainFlow` advances, and carblood3d*.js only reads it; a new repair
  or respray path must call `clearCarStains(car)`. The painter (carblood3d-paint/-streaks) paints thickness and
  arrival times only, as generators that yield on `cbOver()`; the shader (`cbMaterial`, carblood3d-skin.js) owns
  colour, gloss and drying. Work goes through `cbSlice` (about 3 ms a frame); new vehicle GL resources are pooled
  or made in `cbWarmStep`.
- A nudge under 20 km/h drops the person beside the car (`knockPerson`), never in its path.
- Pedestrians react to a car only through `watchVehicle()` (crowd-awareness.js: sight, hearing, attention,
  reaction time); never start a 'dodge' directly. `carHorn(c, length)` is the only way a car honks (it sets
  `c.hornUntil`, which the awareness model hears). Someone on the ground (`personOnGround(p)`) who is run over
  again goes through `runOverDowned` (runover.js, from `knockPerson`); they die from it only via `p.dying` then
  `finishDying()` then `strikePerson`. `p.mutedUntil` silences `scream()`.
- Hot loops: never `length = 0` on a reused list (keep a count: `list.n`, `broadphasePairCount`); write a double
  to an object field only when it changed; every field any system sets on a vehicle is declared in `makeCar` (as
  `undefined`; `shapeReport()` stays at 3 layouts or fewer, tools/tests/vehicle-layouts.mjs); no closures capturing
  loop-body variables, per-frame loops over vehicles or people are indexed (no for-of, no `[x, y]` destructuring),
  tiny helpers are written out in the physics step (`allocBench(name)` measures bytes per call). A simulation-side
  performance change is proved with `dev.mjs start --seed 1` plus `hitches.mjs --ab A B --hash` (equal
  `stateHash` per stage). Restart a CSS animation with `void getComputedStyle(el).animationName`, never
  `offsetWidth`; `worldContext` is cleared only after a frame that drew on it. Map overlay painters gate
  on `mapWindowHas` and draw fixed-size text with `mapLabel`. `settleIsTrivial` (physics-step.js) must stay in
  step with terrainVehiclePose, cliffSettle, drawbridgeSettle and rotorStrikes (`settleAudit()` checks it).
  Measure with `DeadEndCity.simProfile()` and `dev.mjs call <method> --cpu|--profile N|--alloc N`
  (docs/areas/core-and-contracts.md Performance rules). Hiccups: `node tools/hitches.mjs` (`hitchRun`/`frameTrace`,
  `--ab A B`): compare counters and `cpu/fr`, not wall-clock percentiles. HUD attributes written every pass go
  through `hudAttr(el, name, value)`, a per-pass `classList.add/remove` is guarded by `contains`, and a layout read
  in the HUD pass is queued for the frame start (`measureDockLine`). A dynamic GPU buffer bigger than what is drawn
  calls `addUpdateRange(0, n * itemSize)` before `needsUpdate` (`uploadChurn()` lists whole-buffer re-uploads).
- Prewarm and first uses (docs/areas/rendering-hiccups.md): an off-screen pass registers itself with
  `registerPrewarmPass(scene, camera, target)`; prewarm slices never contain lights (compile() counts a slice's
  lights too); light and shadow counts are part of every lit program's key, so never toggle a light's
  `visible`/`castShadow`/layers in play; after adding an effect check `renderHiccups()` (a program, texture or
  geometry on its first frame is a hitch to warm). `dev.mjs start --render --prewarm` runs the title prewarm on
  software GL (compile only; set the tier first: `call graphics high`, then `reload --render --keep --prewarm`; a tier change
  in play leaves vehicles built only at the title uncompiled for the new lit state); `dev.mjs cpucost 45` is CPU ms per drawn frame per browser process.
- Top-level function declarations share one closure: a name declared in two files silently replaces the first for
  every caller (quick-check.sh fails on it); prefix area-specific helpers (`medicRouteLength`). Job restarts
  (`retryMission`, `chooseMission`, new game) move the player with `teleportPlayer`. Mission stage texts that embed
  a key name put it right after "·" or "HOLD" (`missionSummary` keeps it upper case only there); a hint naming the
  walk action reads `keyName('walk')` or the touch label, never a literal "WALK".
- `frame()` books the next frame whatever `runFrame` does (frame-guard.js: each distinct error logged once, `frameFaults()`);
  a caught fault is still a bug. A lost WebGL context pauses, then saves and reloads on restore (gpu-context.js).
- `node tools/bot.mjs --seed N --minutes M` is the random-walk bot (console `integrity()`): run it after changes to
  input, modes, carriers or saving (docs/areas/testing-and-console.md).
- A tier or shadow change goes through `litStateFor` / `applyLitState` (lighting3d-look.js LIT STATE) and is staged
  where the prewarm runs, so anything else a tier flips that is part of a lit program's key joins that record. Post
  targets are sized lazily: use `postSceneTarget()` outside `renderFrame`. Start-up stages are marked with
  `bootMark(name)` (`DeadEndCity.bootTimings()`); a canvas texture painted once and uploaded once goes on
  `bakedCanvases`, never one that is cloned or repainted.
- Hot paths use `hypot2()` (game-state.js; bit-identical to Math.hypot, which allocates); a rectangle list asked
  by `solid()` goes through `rectListBlocked` (cell-indexed), never a per-call walk of a world-spanning list.
  Anything new that grows is capped and listed in `soakReport()`; `node tools/soak.mjs` (30 game min) shows
  growth and `node tools/ab.mjs A.html B.html` A/Bs two builds on one browser slot.
- Open sea: `updateWorldEdge()` (world-edge.js) is the only rule for the player heading out to sea: nothing over land or
  within `WORLD_EDGE_OPEN_SEA` of it; `worldEdge.out` counts seconds moving away from the nearest land
  (`worldEdgeLandDistance`); at `WORLD_EDGE_AWAY` a RETURN TO THE CITY countdown (never naming the map's edge), heading
  back winds it up; at zero `worldEdge.missile` homes in and kills the player in any vehicle (god mode only warned).
  Only `worldEdgeCanReach` players count (never aboard a ship); `teleportPlayer` calls `resetWorldEdge()`;
  `worldEdgeLine` must stay outside all land (`worldEdge().landGap`); the renderers only draw the missile.
- The TO LOSE POLICE countdown shows only through `searchClockShown()` (citylife-civic.js SEARCH CLOCK: on screen
  only while it runs at full speed; hidden, with the panel saying why, while holding for a 911 response or creeping
  inside the search circle). Police sight is debounced there; `PURSUIT_SEARCH_SECONDS` sets the times.
- Cheat codes: `CHEAT_CODES` (game-input.js; GODMODE runs `godModeCheat` (+`GOD_MODE_CASH`), HELICOPTER `helicopterCheat`;
  AAAAXBBBBYXXXXAYYYYB is switched off for now). A code
  whose first letters are driving keys sets `CHEAT_SWALLOW_FROM` so it never eats a steering tap.
  Each toggle plays `showGodSplash(on)` (god-splash.js: CSS-run card at z-index 100 over Settings); its sound
  (god-splash-audio.js) lands on `GOD_SPLASH_IMPACT` / `GOD_SPLASH_POWER_OFF`: retime the CSS and those together.
- Road vehicles on terrain ride `rideStep` (terrain-suspension.js): pitch, roll and lift come from four tyre
  springs; `rideLift` is drawn only, never part of `entityElevation`; grip and slope push go through
  `rideLoadShare`/`rideGroundPush`; no random hops (new ground features go into `rideTyreGround`/`rideRelief`);
  `settleIsTrivial` checks `rideActive`. Trail set pieces (`ford`, `camber`, `steep`, `summitLift`) and
  `OFFROAD_SECTIONS` are fractions of the path: moving a trail means re-deriving them (`trailProfile`) and keeping
  tools/tests/hillclimb-physics.mjs green. Trail rock is one source: `rideRelief` is what the tyres climb and what
  offroad3d-trail.js draws (never add trail rocks the ride can't feel); `offroadFords`/`offroadFordWater`
  (offroad-trails.js) are the only water on a trail (county3d-forest.js draws it, `tyreEmission` 'ford' sprays).
- Trees near the 4x4 trails: every placer asks `trailTreeClear()` (trail-trees.js: the street camera's ground-plane
  corridor, 2 m verge, 12 m hairpin run-off); forest trunks are vehicle obstacles in forest-trunks.js, built from the
  same `terrainFieldScenery` lists the renderer plants; `trailTreeAudit()` `covering`/`verge` stay 0
  (tools/tests/trail-trees.mjs). Tree size bounds (`forestTreeBounds`) follow `forestSpecies`/`TREE_SPECIES`.
- The Meridian Star sails `LINER_VOYAGE` (marina-voyage.js); `linerVoyageCheck()` must report no problems (land,
  bridges, docks, ships, Monarch Harbour, hull `LINER_EDGE_MARGIN` inside the world-edge line); she never passes
  under a bridge. Moving scenery registers its cull entry with `moving: true` (render3d-statics.js), never in a
  static cell. Ship decks are landing surfaces only through `deckSurfaceAt()` / `deckLandingStep()`
  (deck-landing.js); a new walkable ship joins there (a liner's roofs are `linerLevels`).
- Wrecks and abandoned cars are retired by `retireWrecks` (livingcity-wrecks.js, `WRECK_LIMITS`): 50 s and 180 s
  unseen, world caps 16 and 24, never on screen, near the player or protected (`wreckProtected`). A vehicle that
  must outlive its wreck gets a flag there; a new field holding a vehicle long-term needs clean-up in
  `retireVehicle`. Console `wreckReport()`.
- The street camera's follow is a critically damped spring (`cameraSpring`, camera-drive.js: smoothed look-ahead
  that turns at most ~52 deg/s, smoothed camera height); vehicle framing is `CAMERA_CONTEXT` × `speedZoomTarget`
  (world-view.js; `vehicleCameraFactor()` is Settings · Driving · Vehicle camera distance). Below 30 km/h a road vehicle or boat frames like
  walking (`slowFramingOn()`, world-view.js SLOW FRAMING: out at 31 km/h, back after 1 s under 30; Motion comfort
  too; the chase view follows it, chase-camera.js `slowShare`/`CHASE_SLOW`: close behind the vehicle's back with the
  whole vehicle in frame and the HUD clear; a carjack never zooms); with no lead the follow's axis turns with the travel (look-ahead 0 % = centred); the on-foot share is `walkCameraFactor()` (Settings · Driving · Walking camera distance); the driving lead's
  frame share stops where the vehicle's far end reaches `leadShareTop` 0.7 of the half frame (look-ahead 0-300 %,
  default 200 %). Renderers read only
  `streetCameraAltitude()` and `cameraShakeLevel()`. `motionComfortOn()` (settings.js MOTION COMFORT) is the one
  switch for the steady camera (fixed vehicle zoom, short slow lead, no kicks/tremor/aim lean/flight bank): a new
  camera motion checks it. Check `cameraComfort()` / tools/tests/camera-comfort.mjs after any camera change.
- **Chase view** (V; docs/areas/chase-view.md): `chaseCam` (chase-camera.js) is game state with its own pinhole
  (`chaseProject`, `chaseRay`, `chaseSees`, `chaseAimPoint`); chase-view3d.js only copies it into `chaseCamera`.
  `setViewMode` is the only switch (saved). While `chaseCameraLive()`, every "is it on screen" rule asks the chase
  camera through chase-rules.js (`crowdInView` = the frustum within `CHASE_SIGHT_REACH`; spawn spots through
  `spotUnseen(x, y, margin, SPOT_*)`, exactly `!crowdInView` in the street view; `shooterInView` = in frame within
  `CHASE_FIRE_REACH` or within `CHASE_FIRE_NEAR` of the player, never through a building), never a `cameraTarget`
  box; `viewPopAudit()` stays at 0 (tools/tests/chase-streams.mjs). The reticle (the cursor without pointer lock)
  is the aim for every device: aim code reads `aim()`, `chaseAimScreen()` or `chaseGroundPoint()`, never
  `mouse.x/y` with `city3D.groundPoint` alone. Movement keys go through `playerMoveHeading()` (chase heading `chaseMoveYaw`, primed
  behind the player on a switch, teleport or reload; the on-foot camera follows a run only within `CHASE_FOLLOW_ARC`); the street view's
  paths stay bit-identical when the chase view is off. Its HUD layout is `body.chase-view` (chase-view.css).
  Sweep both the shoulder and boom against walls; no minimum boom may override collision clearance.
- Chase view budget (rendering-chase-budget.md): a static group's small parts and glows, scene signs, small batches,
  vehicles' unlit small parts and effect sprites step out by size against distance and haze (`chasePropShown`); hide
  only by layer mask or castShadow (never `visible`, never a light); a part that moves sits in a `userData.dynamic`
  branch; a `farHidden` mesh's castShadow belongs to the far copy (`farOwned`); `lookSwitches({ chaseBudget: false })`
  is the in-page A/B.
- Building frontage (cityscape3d-frontage.js STREET FRONTAGE): a new shopfront part takes a FRONT PAINT colour
  (`facePaint`/`paintBox`), never a new `staticMat`; nothing in the building loop draws from `cityRandom` (its stream
  places roof plant and bus stops); nothing on a north side stands more than 3 units off the wall and no awning goes
  east, west or south (the street camera's cutaway and overhead cover).
- Roofs and ground (rendering-buildings.md, rendering-weather.md): city roof finishes (`roofMaterial`) are drawn by
  the ROOF SKIN (roofskin3d.js, one `cityRoof` program); a roof cap comes from `roofCapGeometry`, its 8-bit tint is the
  roof's seed and age, and the far copy carries it (`farTint`). New roof plant is decoration in FRONT PAINT from its own
  stream (`roofPlantRandom`): never `place()` into `roofPlantPools`, never `b.roofKeepOuts`, never `cityRandom`, and no
  change in how many numbers the `ROOF_TEXTURES` painters draw (tools/tests/roof-skin.mjs holds the recorded plant).
  The city ground sheet is read by colour class: anything painted over it after the fills (`paintWallGrime`) is
  translucent dark and keeps each class's hue; ground tones read the lane grid bilinearly, never `gLaneW` nearest.
  Compare looks and cost with `lookSwitches({ roofSkin, groundWear })`.
- Wall skin (cityscape3d-wallskin.js; rendering-buildings.md): real CC0 facade and roof-tile materials are layers of
  assets/wall-skin.webp (tools/wall_skin.py LAYERS = `WALL_SKIN_LAYERS`, keep them in step), picked per material by the
  `cityWallLayer` uniform (`userData.wallSkin`), never a new material or define; A/B `lookSwitches({ wallSkin })`.
- Character rig (people-and-crowd-rig.md): every body set lofts the same key rings (`RIG_*_RINGS`, `rig*Rings`), so
  outline changes go there; lofts face outwards whichever way their rings run (tools/tests/rig-geometry.mjs). Slot D
  of every body part's paint is the skin; paint bits from 32 belong to the near set (`rigNearBits`). Near hands take
  their side from instance order: pack hands in pairs, left then right (`drawCrowdPerson`). `chooseNearPeople`
  (crowd3d-frame.js) is the only place a person joins the chase view's near set, at most `CROWD_NEAR_CAP`.
- NPC avatars (people-and-crowd-avatars.md): `npcAvatarPick` (npc-avatar-cast.js, from compileLook's `lookFemale`) is the
  only rule for which Rocketbox avatar a look is; `npcAvatarChoose` is the only place a person gets a level (near slot or
  mid batch, `NPC_REACH`/`NPC_KEEP` band, tier caps; the rig beyond). drawCrowdPerson hands an avatar's 15 joints to
  `skinBone` and must pose all 15. Up close every role is an avatar (the rig only beyond the
  caps, for severed limbs, the wounded at mid and the rider's helmet); tools/tests/npc-avatars.mjs. Story characters are cast by name (`NPC_STORY_CAST`); a top garment's colour is
  only the TINT (`npcAvatarTint`, mask in the atlas alpha, tools/npc_paint.py); a new uniform or outfit gets a downloaded
  avatar or a painted variant in tools/npc_models.py CAST, never the rig up close; the player in a disguise is
  `npcPlayerSlot` (`playerAvatarOn`); people drawn after `npcAvatarChoose` take late slots in `npcAvatarTake`.
- The player's body is the shipped model when the build carries it (player-body3d-asset.js fits
  assets/player-model.bin from tools/player_model.py, Microsoft Rocketbox, MIT) and the field body otherwise; `PB_WIDTH`
  1.04 is the model's shoulders.
- The player in his own clothes is drawn from his own body (player-body3d*.js; people-and-crowd-player.md):
  drawCrowdPerson hands his joints to `playerBodyBone` (in `PB_BONE_NAMES` order) and his hands to `playerBodyGrip`;
  `playerBodyFlush` shows him only on a frame that posed all 15 bones, so a new early return or way of drawing him
  must still pose every bone. His bind skeleton is the rig's joints at `PB_WIDTH` (the 'player' outfit's
  `widthAbsolute`: change them together). A vertex's part (`pbSkin.w`, a bone index) is the one rule for telling
  his body parts apart (wounds, severed limbs); tools/tests/player-body.mjs holds proportions and the pose sweep.
  A weapon's hand placement on his body is `PB_GRIPS` (player-body3d-grips.js): a new weapon adds its grip there.
- Car cabins (cars3d-interior.js): civilian and police glass is see-through (`carGlassMaterial`, premultiplied; the
  tint closes past `CAR_GLASS_CLEAR`); the cabin merges at the end of each kit's trim (impostors draw `kit.trimOuter`,
  so exterior trim goes before the cabin); `carSeatPlan` (`m.seats`) is the one seat rule; crowd3d-driveby.js SEATED
  OCCUPANTS seats people only within `OCCUPANT_REACH` (at or beyond the glass's clear reach); see-through glass never
  casts a shadow (the paint panels do).
  Broken or lowered panes use the non-drawing `missingGlass` material, never an opaque cabin stand-in.
  Seated and drive-by feet both use the seat plan's `pedalY`, keeping ankles and shoes above the cabin floor.
- Car seats (cars3d-headroom.js CABIN HEADROOM; vehicles-and-driving-cabins.md): `carSeatPlan` fits every closed cabin's
  seat round the head the rig draws (tallest man and woman with hair and caps, `cabinHeadPose` = drawCrowdPerson's chain
  at `seatTorsoLean`/`seatHeadPitch`); seated occupants and the drive-by pose take `plan.lean`: change the riding pose and
  `cabinHeadPose` together. `cabinHeadroom().through` stays 0; a roof too low is a body fix, never a smaller margin; a
  body's glass change keeps damage-vehicles.js `CAR_GLASS_BANDS` in step. Rear badges (`CAR_BADGES`, cars3d-badges.js)
  are glyph quads in the trim atlas's lower half merged into the kit's trim before the cabin (no draw call); the trim
  material alpha-tests the atlas, so other atlas cells stay opaque, addressed only through `trimCellRect` (512x1024).
  Police and club trims read the atlas through `policeSolidUv`; military stencils share the star material
  (`militaryMarks`); club badges stay clear of a tailgate spare wheel, ladder or carrier and the plate. `DRIVEBY_SEATS`
  (driveby-seats.js) is the game's copy of `carSeatPlan`: re-record it when a seat moves (the rendered cabin-headroom
  test prints the lines); `policeLookChoice` is the only rule for police body and livery.
- Chase view level of detail (rendering-chase.md): anything new the far copy stands for hides with its cell
  (`cell.full` / `cell.blocks`); shadow-pass-only hiding goes through `chaseShadowCasters` (restored after the
  pass); its shadow box is `placeChaseSun` (the depth fade `cityShadowReach`); never toggle a light.
- Downloaded vehicle models (vehicle-assets3d.js ASSET CARS; vehicles-and-driving-models.md): `tools/vehicle_models.py`
  makes assets/vehicle-models.bin + vehicle-atlas.webp; `makeAssetCar` keeps civKit's contract (shell, panels, hood,
  5-pane glass, trim with the cabin last, lamps, wheels with the tyre first); a type is replaced only where the model
  clearly looks better and loses nothing (rally, hotrod, helicopters, the bicycle, four motorbikes and the workboat,
  held by `ASSET_BOATS_HELD`, stay procedural); the police 'crownvic' body is police3d-asset.js (the game's livery
  projected through the crownvic's section ring), motorbikes motorbike-assets3d.js, boats boat-assets3d.js; a model change re-records
  DRIVEBY_SEATS (`test.mjs cabin-headroom --render`) and CAR_GLASS_BANDS; `assetCarsOn(false)` gives before/after.
  Round three (vehicles-and-driving-models-heavy.md): every patrol body but the SWAT Bearcat is a model
  (`POLICE_ASSET_TYPES`, police3d-asset.js); box truck, bus and ambulance ride `makeAssetCar`; Vinny's flatbed is the
  downloaded cab with vinnytruck3d.js's deck (`vinnyKit(true)`, VINNY_CARGO unchanged); Fort Sentinel's HMMWV and M35
  are `kind: 'special'` models (military-assets3d.js; the gun jeep's mount keeps MOUNTED_GUNS' numbers); atlas
  4096x2048, earlier models keep their density (`texFloor`); regenerate the bin from every MODELS list, never pick a side.
  Burnt or worn downloaded models (atlas parts) char only through vehicle-char3d.js ASSET CHAR
  (`assetCharSwap`/`assetCharRelease` from paintVehicle); never set a map on the shared `vaMaterials`.
  The military matte/vertex-finish materials tag `userData.assetAtlas`; all four char kinds, including finish,
  prewarm and pool at most 12 each. Shared military kits are immutable (models-military.md).
- Downloaded motorbikes: a source posed with its bars turned is straightened by `unsteer` (vehicle_models_moto.py); a wheel
  turns only whole round pieces (spokes, hub, rim); car wheels stop at the tyre's inner wall; four-wheeled models' wheels
  follow their springs (`ride.d`) through ride-wheels3d.js. The KR 500 is a CC-BY model (credits).
  Recorded `wheelAxes` preserve the source pose with a constant carrier while rolling about the actual axle.
  Measured `grips` are two raw body-space contacts (negative-Z, positive-Z), preserving source asymmetry;
  never infer them from mirror tips or rear grab bars. Riders use the cached fork inverse/current steering
  frame; legacy `grip` keeps its compensated wrist convention. Apply chassis slopes before `finishCrowd3D`.
  A bike has one tyre per axle: either side puncture flag affects it, never two counts or opposite side pull.
- Fort Sentinel models (vehicles-and-driving-models-heavy.md): never `cluster` a body seen up close (the atlas material is
  single-sided: an inward face is a hole); a heavy special body gets a `far` level (`bodyFar`, `militaryLod`, chase view only);
  the tank is procedural (`makeAssetTank` kept for a future model).
  The HMMWV's packed wheel bounds include fixed running gear: `militaryAssetWheelPartition` validates the dominant
  tyre ring once per kit, restores its true centres/radii, and joins fixed pieces into the body without deleting
  triangles. Preserve the original rest pose/UVs/normals. Lamps reuse original lenses with indexed bounds.
- Downloaded aircraft and dog (vehicles-and-driving-models-aircraft.md): `tools/aircraft_models.py` makes
  assets/aircraft-models.bin + aircraft-skin.webp (SKYRANGER 429 airframe `bell429`, flyable SKYLARK 172 airframe
  `skyhawk`, `fixedGear`) on the makeHelicopter / buildAircraft contracts; `rotorStrikes` uses an airframe's
  `rotorRadius`/`rotorX`; civil helicopters are parked only by `populateCivilHelicopters()`; `tools/dog_model.py` bakes
  assets/dog-model.bin, drawn by dog3d.js as one instanced vertex-blend draw (`dogPose`); `aircraftAssetsOn(false)` /
  `dogModelOn(false)` give before/after.
- Front doors (damage, carjack, getting in and out) come only from `vehicleDoor` (damage3d-bodies.js DOORS): cut from the
  body's own paint with an inside panel and window; swings are carjack3d.js DOOR SWING; no dark box over an opening.
- Car crash damage (vehicles-and-driving-damage.md): `crumpleField(dents, limits, ...)` / `crumpleLimits(vehicle)`
  (damage-crumple.js) is the only crumple rule; damage3d-crumple.js bends every mesh under a car body with it,
  time-sliced (`crumpleSlices`), and bumps `m.shapeVersion` when a body is done. A part that animates its own matrix or
  swings on a hinge registers as a moved point (`crumpleCollect` / `crumpleAdopt`). Marks on vehicles
  (damage3d-marks.js) are pinned to a triangle of the part they hit, so a part holding marks keeps its vertex order when
  bent; a mark with no surface is not drawn; holes never on glass or the cabin, stars only on their own pane
  (`crumpleAudit()`, tools/tests/vehicle-damage-shape.mjs).
- Gunfire on road vehicles goes only through `vehicleRoundDamage` (vehicle-gunfire.js): calibre × hit zone; pistols, shotguns
  and rifles never take a car past the engine-fire line (the fire's countdown does the rest); a new heavy gun sets `heavyRound`
  or goreCal 'heavy', a new machine gun `mg`; tools/tests/vehicle-gunfire.mjs. Handbrake slides are friction, not a glide
  (`tyreSideShare` falls off past the peak slip); reverse engages only from a stop (`reverseTest()`).
- `carStainSeverity(kph, fatal)` (car-stains.js) is the only rule for how much bonnet blood a hit leaves (none under
  14 km/h); further hits add to a car's 3 stain records (`adds`, painted by `cbTopUpJob`), never replace one.
- Military mounted guns the player fires (LAV-8 25 mm + coax, gun jeep M2, Black Hawk door guns) live in
  `mounted-guns.js` (`mountedGunKind`, `MOUNTED_GUNS`); its muzzle offsets match base3d-vehicles.js and
  helicopter3d-equipment.js, so move them together. The tank stays in armor.js, the Apache in apache.js.
- Ride head-look (Sunset Eye, Falcon) lives in ride-look.js: `updateRideLook` (from `updateCoaster`) owns the input
  (pointer place on screen, touch drag, right stick) and the smoothing; the ride camera only reads `rideLookAngles(out)`
  after its own smoothing; any change of `player.coaster` or its `view` resets the head. Console `rideLook()`.
- Sound that is off is said on screen: M and the start of play post `soundOffText()` (audio.js; mute and master
  volume are saved). `MIX_MAKEUP` sits after the limiter; `wakeAudio` resumes a suspended context on any gesture.
- Graphics defaults: player outline and ring are off; preserve explicit saved choices. Motion blur is temporarily withdrawn: no menu row, no saved/console enablement, `chaseMotionBlurAllowed()` always false.
- `kickCamera(heading, units)` / `shake` (camera-feel.js) are the only camera jolts; renderers
  only read `cameraKick` and `cameraShakeOffset`.
- Roomy one-shots (shots, blasts, crashes, near thunder) connect to `reverbSend`
  (acoustics-audio.js), never `reverb`; audio randomness uses `sfxRandom`, not `randomBetween`.
- Trail mud (rendering-effects-mud.md): the 4x4 mud draws from `trailMud` (assets/trail-mud.webp; tools/trail_mud.py `CELLS` =
  `MUD_SPRITE_CELLS`); drops and mist go to the effect pool under `MUD_TIER` caps; mud randomness is `mudRandom`; rut and
  splat decals multiply when they overlap, so their brightening stays capped. A renderer setup error drops to REDUCED
  GRAPHICS with only a `console.warn` (not in `dev.mjs errors`): after renderer edits check `status().renderer` is '3d'.
- Trees: every tree, palm, shrub and grass clump uses `treeMaterial`, which carries the foliage cutaway
  (`FOLIAGE_HOLE_CUT`; uniforms from `updateFoliageCutaway` / `foliageCutawayPlan()`, foliage-cutaway.js; the same
  Settings switch as the building cutaway). A new plant must use it to be see-through; keep `foliageHoleCut()` in
  step with the GLSL; never add a define for it and never run it in `treeDepthMaterial`.
- Effect sprites (smoke, dust, fire, sparks, muzzle flashes, glass, blood drops) are slots in the EFFECT POOL
  (rendering-effects.md): spawn them with `fxAdd` or the fx3d-recipes.js helpers (`fxPuff`, `fxBit`, `fxSpark`,
  `fxFlames`, `fxSmoke`), never a `Three.Sprite` per particle; effect randomness is `fxRandom()`, never Math.random.
  The pool draws in its own pass after the scene (`renderFxPass`), soft against walls only on HIGH/ULTRA; other
  see-through effects keep `FX_SPRITE_ORDER` (above floor decals 2-3, tyre smoke 4, the car blood skin 6). A game
  `particle()` that only stands in for a 3D effect passes `standIn`.
- **Renderer never changes game rules**: `*3d.js` files (inside `createCityRenderer()`) only
  read state.
- All vehicle light on a surface shares one budget (VEHICLE LIGHT BUDGET; headlight-beam.js
  `lowBeamIntensity`/`headlightRoadLight` mirror CITY_LIGHT_APPLY: keep them in step); a new
  vehicle light source fills that budget rather than adding on top.
- Sky and haze (rendering-sky.md): `cityHazeColor(dir)` (aerial-haze3d.js) is the one sky colour: the dome, the
  environment map and the chase view's haze all draw it; its `cityHaze*` uniforms are written only by `updateHaze`
  (lighting3d-look.js), and a custom fog shader gets them by building its uniforms from `UniformsLib.fog`.
  `skySunDirection` is the sun the sky draws (it sets); `sunDirection` (the light) stays above ~15° for readable
  shadows: sky visuals, glare and clouds from below use the first, shadows the second. The dome draws at
  renderOrder 50 after the opaque city: an opaque thing that writes no depth and must show against the sky needs more.
- Rain and wet streets at street level (rendering-weather.md): `updateStreetRain`, `chaseRainAir` and the SSR's
  `uStreet` switch on `chaseViewActive` (uniforms, no new programs); the street view keeps `uStreet` (0,1,0,0),
  `uNear.w` 0, splash `uSize` 1 / `uUpright` 0 and a non-zero `citySheenDir`. Darken `cityHaze*` only after
  `refreshEnvironment` (`weatherGrade`).
- Wet roads (rendering-weather-wet.md): WET LAMP GLINTS (wet-glints3d.js) are the only way a lamp shows in wet ground; a
  new lamp or lit sign joins through `addWetGlint` / `addWetGlintIn` (lighting3d-sky.js), never `addStreak` or a light-map read; uniforms only (`cityGlintA/B/Count`,
  `WET_GLINT_SLOTS`); the reflections pass compresses hits above 1.0 so a lamp is not mirrored twice (`wetGlints()`).
  Chimney and wood smoke: `fxWoodSmoke` / `updateChimneySmoke` (chimney-smoke3d.js); the pool's `thin` field thins a
  spreading plume; emitters keep the pool's clock and seed plumes whole; every `fxSmoke` caller passes an opacity and a
  floor (`chimneySmoke()`).
- Sun path (sun-path.js): `sunPathAt` is the only sun/moon light path (the twilight handover slerps over
  `SUN_HANDOVER` with `shade` dimming); renderers draw the light clock `litMinutes()`/`litDaylight()`, never
  `worldMinutes`/`daylight()` for the look; any clock jump in play is blended by `stepSunClock`, a load, new game or
  console `setClock` calls `snapSunClock()` (`sunReport()`, tools/tests/sun-gradual.mjs).
- `cloudBaseAt(x, y)` / `cloudTopAt(x, y)` (clouds.js) are the only source of the cloud
  altitude (by weather and area); the renderer draws from the same maps
  (docs/areas/rendering-clouds.md). Console `cloudJump(metres, kind)` drops the player over
  a cloud.
- Clouds from the street (chase view; rendering-clouds.md): the march from below is `cloudMarchBelow` (`uBelow` 1 only,
  its own coarse/fine loop to 20 km, the half-float `cloudNoiseSky`) averaged by SKY CLOUD HISTORY
  (clouds3d-sky-history.js); the layer seen from below is hazed only by `skyCloudHaze()` (the air's visibility), never
  the street haze; the street and flight views' clouds (`uBelow` 0) stay pixel-identical.
- Vehicle beams run in `headlightFrame()` (terrain-headlights.js: body pitch/roll, lamp
  height); the CAR LAMPS uniform and the horizon strip in `cityBeamShadow` must stay in step
  with `headlightHorizonLit`, and every reader of the lamp slots (lit materials, beam haze,
  the rain's `rainCarLight`) takes the frame and mode.
- **Dev console** `window.DeadEndCity` has explicit named methods only. **Never** add an
  eval-style hook (eval, `Function`, run-a-string, generic get/set): a security rule.
- **Assets are downloaded, not made** (the owner's rule): any new model, texture or sound starts from a ready-made
  asset with a clean licence (CC0/MIT/BSD/CC-BY; only GitHub reaches through the cloud proxy); a new collection is shown to
  the owner as preview sheets before it is integrated; hand-built assets only when nothing usable exists.
- **Third-party assets** must be credited in `docs/THIRD_PARTY_CREDITS.txt` (the build embeds
  it; never delete it). Media goes in `assets/` + `assets/manifest.json`.
- Never hand-edit or commit `dead-end-city.html`; `dist/` is scratch.
- No gameplay change without being asked; docs/tooling tasks leave `src/` alone.

## Finding code (don't read to search)

- `grep -i <word> docs/FILEMAP.md` first: every file with line count and purpose, grouped by
  include tree. Then `grep -n` the symbol in `src/`.
- Naming: `<area>.js` = game logic, `<area>3d.js` = its meshes (renderer closure),
  `<area>-audio.js` = its sound, `<parent>-<part>.js` = a piece split out of `<parent>.js`,
  whose file is then just its banner and an ordered include list. No src file is over
  1,000 lines; keep it that way (split by pure moves when one grows past ~800).
- Pieces only valid together, in order: `signkit3d-emblems-a/b` (case blocks of one
  `switch`), `signdesigns3d-families-a/b` (one object literal), `cars3d-bodies-a/b` (one
  `CAR_BODIES` literal), `render3d-api.js`/`render3d-frame.js` (one `api` literal).
- Page markup and CSS: `src/shell.html` is a ~70-line skeleton; CSS lives in `src/ui/*.css`
  (included inside `<style>` as `/* @include src/ui/x.css */`, include order = cascade order)
  and markup in `src/ui/*.html` (`<!-- @include src/ui/x.html -->`). Find an id:
  `grep -rn 'id="x"' src/ui/`.
- Area docs (why, contracts, gotchas): `docs/README.md` indexes them; open one, not all.

## Token-saving working rules (you and every subagent)

- Grep before reading; read line ranges (`Read` with offset/limit, `sed -n 'a,bp'`), never
  whole 1,000+ line files or the built HTML (38 MB).
- Pipe long command output through `tail`/`head`/`grep`; don't cat logs or tables.
- Browsers are the scarce resource (slots, above); prefer `node tools/dev.mjs call <report>`
  and tests over screenshots; take small `dev.mjs shot`s only to prove a visual point.
- Give subagents a precise brief: files/symbols to touch, the check to run, the output wanted.
- **Pure-move refactors must keep the build byte-identical**:
  ```sh
  python3 tools/build.py --out dist/before.html          # before editing (or from a clean
                                                         # worktree of the base commit)
  # ... move code, replace it with `// @include src/<new>.js` ...
  python3 tools/build.py --out dist/after.html && cmp dist/before.html dist/after.html && echo identical
  python3 tools/filemap.py                               # new files need FILEMAP lines
  ```
  The include line's own indentation is ignored; the moved lines keep theirs. A non-empty
  `cmp` means it was not a pure move.

## Adding things

- Source file: create `src/<name>.js` opening with a 1–3 line header saying what it holds
  (FILEMAP reads it), add `// @include src/<name>.js` to the right include list (game logic
  in `src/game.js` or its area parent; meshes in `render3d.js`'s list). Top-level
  `const`/`let` read during setup must come before their readers. Run `python3 tools/filemap.py`.
- UI panel: markup in the matching `src/ui/*.html` (or a new file + include line), CSS in a
  `src/ui/*.css` (a new file goes before `reduced-motion.css`). Details: docs/areas/ui-and-settings.md.
- Console method: add a named method to the area's `src/game-console-<group>.js` (core,
  missions, police, vehicles, world, rides, leisure, crowd, graphics, settings); each is one
  `addConsoleMethods('<group>', {...})` call and game-console.js freezes them all into
  `window.DeadEndCity`. A feature can return methods from `<feature>Console()` and register
  them from its group. Duplicate names log a console error. Document it in `docs/console/<group>.md`.
- Media: `assets/` file + manifest entry (+ `"stream": true` for large music played by URL)
  + credit. Mission: docs/areas/missions-and-demo.md.

## Agent workflow (parallel sessions)

- **Codex continuity (owner instruction, October 13; renamed October 15)**: all future Codex development stays on
  `codex-reviews`, renamed from `codex/chase-clouds-polish-2026-10-12` with its history preserved. Fetch and merge newer approved `origin/main` into that
  branch when reviewing Claude's changes; commit and push improvements there. Do not create a
  new branch for each prompt. Claude can track this one permanent GitHub branch.
- **Branches and `main`**: develop on the session's working branch. `main` holds the owner's
  approved game. When the owner says they are satisfied with a version **and** approves
  moving it to main in the current conversation, merge the working branch into `main`
  directly (no pull request needed) and push `main`; never push to `main` without that
  explicit approval. CI builds the downloadable zip for whatever branch is pushed.
- **How many at once**: the cloud machine has 4 cores and 16 GB; run at most 3-4 agents in
  parallel (in waves), since every one of them needs browsers and slots only queue the
  work. On a bigger machine (or `DEC_GPU=1`) raise `DEC_BROWSER_SLOTS` and the agent count.
- Work in your own git worktree/branch. Before finishing: merge the lead session's working
  branch (the lead names it in your brief), resolve conflicts, `grep -rn '^<<<<<<<' .`
  (excluding node_modules), run `sh tools/quick-check.sh <tag>`, commit.
- Commit in logical steps, ending each message with the attribution lines your session's
  instructions give (the lead passes them on in agent briefs).
- Never use bare `git stash` (the stash is shared between worktrees); use a WIP commit.
- `docs/FILEMAP.md` conflict: take either side, rerun `python3 tools/filemap.py`.
- Shared docs are small and per-area, so agents rarely touch the same file; edit the
  section you changed, don't rewrap others.

## Docs and changelog

- `docs/BACKLOG.md`: known issues and loose ends per feature; check it before polishing an area,
  delete a line when you fix it.
- `docs/console/README.md`: console rules and the per-group table index. An area doc that outgrows
  ~8 KB splits as `<area>-<topic>.md` and gets a row in docs/README.md.
- `docs/README.md` (index) · `docs/FILEMAP.md` (generated) · `docs/areas/*.md` (≤ ~8 KB each;
  update the one your change affects: contracts and gotchas, not what code says) ·
  `docs/audit/` (QA logs) · `docs/CHANGELOG.md` (latest release only) ·
  `docs/archive/CHANGELOG-archive.md` (older).
- **Never edit docs/CHANGELOG.md for a change.** Add `docs/changes/<yyyy-mm-dd>-<topic>.md`:
  a `# Title` line and a few bullets (player-visible first, then internals and new console
  methods; under ~15 lines). At release, `python3 tools/changelog.py --release <ver> "<Title>"`
  folds fragments into a new section and archives the previous one; `python3
  tools/changelog.py` previews it.
- **Version numbers**: 0.9.0 is the public demo (the old 1.0-30.0.0 numbers were pre-alpha
  build counts). Each release adds 0.0.1 (0.9.1, 0.9.2 ...), only when the owner asks for a
  release: `GAME_VERSION` (src/game-state.js), `src/ui/build-header.html`, README.md, then
  `--release`.
