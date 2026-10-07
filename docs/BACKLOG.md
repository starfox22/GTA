# Backlog: known issues and loose ends

Known, unfixed issues reported by the agents that built each feature (as of v30). Pick from
here when polishing; delete a line when it is fixed. Newest features first.

## The living city (livingcity*.js)
- Traffic streams only on the city grid: Monarch Isle and the county keep their own fixed traffic; North Point Key gets only its few visitors (livingcity-key.js: one lane each way, no overtaking, no sirens pull-over on the Key).
- Signals cycle every 24 s on a 64 m grid, so about half the traffic in the ring stands at a light or in its queue at any moment (`trafficReport().held`).
- Paramedics walk straight at the victim (with a sidestep); round a building corner they may work from up to 30 units off. The revive is a mercy of the game (GTA's paramedics did it too), not a medical outcome.
- No stretcher or sheet: a lost victim stays where they fell until the crowd streamer clears the dead out of view.
- The bag snatch's tackle is proximity only (no tackle animation); punching or shooting the thief is still an assault.
- Performance (headless): physics +0.1-0.7 ms per 60 fps frame with ~40 more cars moving round the player (`trafficBenchmark`).

## Soundscape (acoustics-audio.js, ambience-beds.js, footsteps-audio.js, vehicle-foley-audio.js, bullets-audio.js)
- The room's returns (reverb, slap, echo) are on the effects bus: a tunnel's engine boom and footsteps' reflections follow the Effects slider, not Engines.
- Ambience events are not placed by occlusion or sent to the room (a ship's horn has no echo); zones are coarse (districts, park rectangles, terrain height).
- Only runners' steps are heard (walkers are silent); a person moving 2.4-9 m/s on something other than a car (a cyclist on the pavement) would step.
- Drivers getting out after a crash make no door sound; traffic has no indicator ticks; the drawbridge's steel deck does not sing under tyres.
- The listener is the player, not the camera: in the zoomed-out views pan and distance are from the player.
- Headless, the reports read Web Audio automation in audio time: after a simulated `wait` the gliding gains lag the probe (they glide in real time); judge levels in a real browser.

## Free roam and HUD (docs/audit/freeroam-sweep.md)
- HUD clearance (hud-clearance.js, 2026-10-04 pass): at 960x600 a bus heading up the screen at 60 km/h reaches
  ~470 px, where a mission dialogue line sits low over the folded card: the line then fades to 30 % (last resort,
  no room left); O opens the card over the player on purpose. Repro: `drive('bus', 0, -Math.PI / 2)` at (420, 5600),
  `launch(20)`, a dialogue line up, `hudClearance()`.
- Touch on a tablet: a tapped radio opens over the GAS / BRAKE column for its 6 s (`.touch-mode #carRadio`, 180 px
  top, 250 px wide); getting in no longer opens it by itself.
- 960 px wide: a three-note notice feed (116 px down) can reach a headline card's words at 27 % height (two notes
  clear it by ~5 px); `hudOverlaps()` measures the headline by its words.
- Damage direction: only gunfire shows the red arc (pursuit-officers.js playerHitFeedback); blasts and melee do not.
- Gamepad: tested with a virtual pad only (`gamepadFeed`); no rumble; the settings screen cannot rebind pad buttons.
- The 2D fallback renderer's speech bubbles keep the old 10 px text.
- tools/tests/hud-layout.mjs failed once in three runs (2026-10-04, god-splash round, unrelated code; again in the
  full suite of the armour/trail round, passing alone): "the top card
  covered the bus" with `folded: false`, `readLeft` 5.5 (open card 64-152 px over the bus at 93 px). Timing of the
  fold against the bus's climb; not reproduced on two reruns.
- tools/tests/car-blood.mjs failed once run straight after vehicle-layouts on the same page (2026-10-05): "a flank
  hit did not stain the flank" (the stains read `right` and `front`); it passed in the full suite and alone. The
  side hit's face depends on the struck car's pose after the earlier test.
- tools/tests/vehicle-layouts.mjs showed 4 layouts once (2026-10-05): `threat`, `bankHit`, `fareUntil`,
  `curbCooldown` were set on vehicles without a makeCar declaration (only when those events happen during the
  run); now declared.
- bot seed 5 (2026-10-05) once respawned the player with 1 star after `die(blasted)` on land, just after running people
  over (a witness call finishing after WASTED?); it did not repeat on two later runs (seeds 5 and 7).

## Missions 1 and 2 (harbor*.js, chase.js, roofmission*.js, campaign.js)
- Vinny's truck (vinnytruck3d.js) has no crumple shell or pane-by-pane glass damage (tyres, burn and lamps only), and a respray keeps its MORETTI & SONS door lettering.
- The payphone's and newspaper boxes' foot obstacles are registered by the renderer (like the bus shelters), so a `?norender` page walks through them.
- At night the white faces round the payphone (newspaper pages, placards) sit in the street lamp's pool and read bright.
- The Blue Hour's limousines have no chauffeurs and never leave; the doormen and valet keep their posts (no door opened, no car taken). The forecourt fixtures are foot obstacles, which stop only the player: a street walker straying to the wall or the kerb can pass through a planter or bollard.
- At a fresh boot a double-parked delivery van (crowd-scenes.js) often holds the truck's first kerb spot: the truck then waits further east along the same kerb (x ≈ 1950), still in view.
- Bug pass 2026-10-02 (docs/changes/2026-10-02-missions-bug-pass.md) found no soft-lock: death, busting and retry at every stage, saving and reloading mid-job, the respray route with the truck, the truck rolled to the quay edge (it stops at the kerb, never in the sea), spiking the glass and leaving before he drinks, a parachute onto the hotel roof (not landable), 70-step random-action runs on both jobs, and `settleAudit()` at every parked truck, limousine and ambulance moment (0 changes). Not covered: a gamepad-only run.
- Bug pass 2026-10-04 (docs/changes/2026-10-04-missions-bug-pass-2.md), no god mode: the cargo chase keeps `searchClock` 'off' (no countdown) as designed; a truck wedged by the console pilot near (290, 1739) on the GPS route was BUSTED, failing the job with the payphone line. A truck driven fast at the east quay edge (x ≈ 3390) goes into the sea ("THE CAR IS GOING UNDER · E to get out"); one rolled slowly stops at the kerb. A player who loads and then sits in the bay keeps the truck at 8 % once the crew's 45 s alert runs out (the cage share and the fire floor): the police chase then finishes a truck that weak unless it is resprayed.
- Mission 1's chase end to end (no god mode), driven by the console's `followRoute` (the GPS road route with steering keys): from the harbour with three stars, 11-12 cruisers, the helicopter and two roadblocks the truck crossed the Keys bridge and reached Palm Keys (x -1408, y ~3600-4000) in 5 of 7 runs (66-106 s), but the last two turns and the 90 degree turn in at the warehouse door with a dozen officers converging defeated the pilot every time: an overshoot past y 4224, then wedged and BUSTED, or the truck shot down while boxed in (police rounds 45 %, ~6 hp/s). Not stable enough for the suite (tools/tests has no mission1-chase); the drop is covered by mission1-depot. Owner's call: the surrender rule (pursuit-officers.js `trackSurrender`, 1.5 s within 6 units) counts a wedged vehicle whose driver holds the throttle as giving up, so a truck pushing against a cruiser is pulled out at three stars.

## Clouds (clouds*.js, clouds3d-*.js)
- The flight camera never looks above ~30 degrees below the horizon: under the base the underside is never in view, only the shadows and the dimmer light (the chase view shows it: clouds3d-sky.js).
- Chase view: the sky, haze, sun glare, shafts and the per-pixel cloud shadows were tuned on SwiftShader: check on a real GPU (and the cost of the march from below at ULTRA). The cloud shadows darken shade too (as the plane always did: a blend, not a light term); the half-size march still shows some stair-stepping on cumulus walls.
- The veil is capped so the subject stays readable, so the ground shows through it once a jumper is within ~30 m of the base (the far march covers only beyond the jumper).
- Tower stops are boxes (lot + 0.5 m): a twisted crown (EVOLUTION) is approximated; only the six tallest towers stop rays.
- `cloudAmountAt` (sound, lens, LOW's veil, grey-out) is a likelihood from the coverage map: in a gap the GPU carves it can still say "in cloud".
- Headless: the eased in-cloud values (grey-out, lens) creep because render steps are capped at 0.04 s; judge them in a real browser.
- No shafts on LOW/MEDIUM; no lens on LOW; the cloud sound has no test.

## North Point Key (skyline*.js, skyline3d-*.js)
- Key visitors pause by the valet but nobody gets out (no guest walks in, no valet takes the car).
- A Key visitor, and city traffic, creeps round a person who holds it (3.5 s / 4 s) but never round the player on foot, who still holds the ring; crowd-traffic's honk only moves people whose reaction is `watch`.
- Grid walkers treat the Key's row (-3456) as an ordinary street: their pavement line and "kerbs" run across the drop-off ring, where they stand waiting for a signal in the carriageway; and at the bridge's west end (x 3270-3340) walkers pause or stall in the road for many seconds (the traffic creep now gets past them).
- The 2D fallback draws its ground tile and towers but not its palms or furniture.
- CIRRUS guests are spawned per visit; the sky bar has no pool (the oval deck is 23 x 15 m).

## Sea life (sealife*.js)
- The shark's breach reads small from the top-down camera (mostly a splash column).
- Gulls are true size (1.4 m) and hard to see over dark marina water.
- The death timer runs in real seconds: on slow machines the hospital respawn can cut off the breach.
- First sighting compiles the life-map shaders (small one-off hitch on a real GPU).
- The beach-alarm shark pass runs ~39 m off the waterline: the fin is small in view.
- A shark encounter starting on its own (not from the console) was never tested in real time.

## Dealership (dealership*.js, hypercars*.js)
- Headless only: the first frame after a bought car appears can be black; check in a real browser.
- Measured top speeds a little under the card: Wayron 417/431, Tourbillon 435/445, Jasko 457/480 km/h.
- The salesman walks at most ~9 km/h, so he lags a running player.

## Falls and parachute (falls*.js, parachute.js)
- NPCs knocked off drops do not fall; the splat pool is a flat decal and sinks into steep slopes.
- AI cars cannot fly into the sea (the footprint check stops them at the edge).
- A canopy landing on an ordinary roof still glides past the building; only freefall (or a canopy still opening) onto a roof is an impact.
- The freefall cue measures the height opening needs against the floor straight below: a roof or hill drifted over while it opens is not forecast.
- The deployment stages are only seen from above (the flight camera looks down): the body swinging upright at line stretch barely reads.
- The canopy's pendulum and surge run on drawn frames (parachute3d-pose.js): no test covers them (headless runs a few fps); the slider is mostly hidden under the canopy from the flight camera.
- The freefall cue panel sits just under the frame's centre; while the camera catches up after the snap the canopy can pass behind it.
- The Blue Hour terrace canopy landing is kept but has no test.
- Ships (deck-landing.js): a liner's roof levels have no drawn stairs (E takes "the stairs aft" at once, to the aft deck); no blood decal on a deck (`addBloodPool` needs ground); Monarch's superyachts and the marina's moored boats have no walkable deck (a canopy comes down clear of them, in the water); the cue measures the deck straight below, not where a moving ship will be.

## Driving (driving.js, physics-*.js)
- At the quay on Ocean Drive (Palm Keys) a car driven slowly over the edge sometimes hangs there with its bonnet past
  the shore for about a second and is then pushed back ~37 units onto the promenade instead of dropping into Palm
  Sound (other runs drive straight in): `drive('supercar', 0, 0)`, `placeVehicle(-1300, 2299, 0, 0)`, `launch(12)`,
  then `simulate(0.25, ['KeyW'])` steps (2026-10-04 free-roam pass; seen once in two tries).
- The ATLAS CARGO FLATBED reverses at about 0.35 m/s² from rest (5 units in the first 1.6 s of S, 17 in 3.2 s; forward
  ~1.3 m/s²): nose to a wall it barely seems to move, which the bot read as trapped twice (seed 8; its check now waits
  longer). `drive('flatbed', 0, Math.PI / 2)` at (420, 4400), `simulate(1.6, ['KeyS'])`.
- 50–0 km/h stops are slightly longer than before (the 0.2 s pedal build-up).
- Soaked roads add 43–58 % to ABS stops (target 30–50 %).
- AI traffic and police use the simple ABS-equivalent brake, not the per-axle tyre model.
- Drifts need TCS and ESC off (or a classic): with ESC on a handbrake-started slide is damped
  0.8 s after the handbrake. A 'sport' ESC mode that allows ~15 degrees would open drifting up.
- Skid marks come only from the player's vehicle and shoved parked cars: traffic and police
  slides (`c.sliding`) leave none. Rubber on the runways is recognised (`runwayUnder`), but
  footSurfaceAt still calls the taxiways and aprons outside the old airport grass.
- Burnouts are the player's only (a car; not motorbikes or on the trails' tyre model); no
  donut steering (steering does nothing while the car is held).

## Camera and combat feel (camera-feel.js, tyresmoke3d.js)
- With both a mouse and the touch aim stick used on one page, `playerShotTarget` still snaps to
  whoever is near the (stale) cursor; the camera leans along the stick.
- Rain spray and dust were checked only in stills (headless frames are seconds apart); worth a
  look on a real GPU at speed in the rain and on the beach.
- The comfort camera (camera-drive.js) was tuned from `cameraComfort()` numbers and stills, not
  felt at 60 fps on a real screen: worth a drive on a real GPU (lead share 0.25, turn 0.9 rad/s,
  across 1.8). The wider driving view (1.12 at rest since October 6) costs draw calls at city
  speeds; a medium-tier check on a laptop GPU is still to do. The owner reported motion sickness
  twice: if it persists, next candidates are a steeper street pitch (a big change: foliage cutaway,
  trail-tree corridor and HUD clearance all assume STREET_PITCH) and a frame-rate floor.

## Drive-bys (driveby.js, crowd3d-driveby.js)
- Only the pistol fires from a vehicle, so the SMG one-hand and two-handed lean-out poses are not
  drawn; the rear, windscreen and passenger-side shots fire from inside the cabin, which the
  opaque roof hides from the street camera (only the flash, the burst screen and the tracers show).
- Trucks, the hypercars and other special bodies have no per-pane glass: their driver's window
  does not show wound down and a burst windscreen or rear screen shows only as the crumbs.
- A boat's helmsman and an aircraft's pilot are not drawn during a drive-by (the shot still
  follows the arcs and leaves from `driveByGrip`).

## Chase view (chase-camera.js, chase-view3d*.js, chase-rules.js; docs/areas/chase-view.md)

- No cover system (GTA IV's take-cover key): rounds already stop on cars and walls in the map plane, but the
  player's own rounds would hit the car they hide behind (no over-the-top fire) and NPCs have no cover logic.
  A design question for the owner before any work.
- The first press of V after the title prewarm (HIGH): two shadow-depth programs (`MeshDepth` with uv: alpha-tested
  casters only the chase view's shadow pass draws) link on the first chase frame, and the distant cells the street
  view never saw upload their textures and geometry then (~50-100 textures, 150-500 geometries on SwiftShader). The
  motion-blur pass is warmed (postfx3d-motion.js). A chase-view shadow warm-up and a pre-upload of the view down the
  street would remove the rest.
- Motion blur is the camera's own motion only (depth reprojection, no per-object velocity buffer): other cars
  passing fast are sharp, and anything within 12 m of the camera never smears.
- The close-quarters crane (CHASE_CRANE) handles a wall behind the player; the camera can still come close to the
  player's head beside a wall on the right shoulder side (the boom is marched from the shoulder point).

## Car cabins and glass (cars3d-interior.js, crowd3d-driveby.js SEATED OCCUPANTS)
- A burst pane is still damage3d.js's dark `brokenGlass` frame: the cabin behind it does not show through the hole
  (a model hook like `m.glass` for burst panes would let it).
- The model's seat (`carSeatPlan`) and the drive-by's (`driveBySeat`) differ by a few centimetres in the van, the hot
  rod and the police bodies (their game-side glass band is generic): the figure shifts when the gun comes out there.
- The steering wheel is part of the merged trim and does not turn; the hands slide a little on the rim instead.
- The player riding in the back of a taxi, rear passengers and a SWAT or army crew are not seated; trucks, buses and
  the 4x4 club trucks keep opaque glass. Interiors carry no instrument glow at night.
- Seated people are capped at 16 cars a frame (`OCCUPANT_CAP`): in a jam past that the farthest cabins in reach are
  empty behind their tint.

## The player's body (player-body3d*.js; docs/areas/people-and-crowd-player.md)

- On a weapon the hand takes the gun's frame (crowd3d-draw.js `drawHold`), whose long axis runs down the grip:
  the curled fingers wrap a line along the barrel rather than round the grip. A proper grip needs the hand
  turned 90 degrees about its palm normal and the wrist target moved back to match.
- The build is ~1 s of work on a desktop (2-3 s on the cloud box), sliced behind the title; a player who starts
  at once sees the near-set figure until it is done (a one-time switch). Caching the arrays (IndexedDB) or a
  worker would remove it.
- ~92k triangles (46k vertices) and one shadow draw: LOW could mesh at coarser spacings (`PB_SPACING`).
- The face is sculpted from primitives: the cheeks and the corners of the mouth read soft at the closest chase
  zoom; a second pass on the lids and the nasolabial area would help most. No eye movement or blinking.
- Arms raised far over the head stretch the armpit (the A-pose bind); corrective shapes would hold the deltoid.

## Mountain island (mountain-village*.js, mountain-club3d.js)
- Northridge metal roofs (rescue barn, general store) were lightened but not re-shot.
- The Last Witness now lands at the Northridge ranger station pad: play the mission through once.

## Drawbridge (drawbridge*.js)
- Counterweights leave the top-down view after sinking ~10 m.
- The ALBATROSS's fore-and-aft sails are nearly edge-on from above.
- About half the onlookers wander off before the leaves are fully up.
- The three newer drawbridges' ships (LADY GRACE, CORAL QUEEN, WANDERER) are ALBATROSS's hull in other paint with no
  name board (the boat-name atlas is full); the Coronation Bridge's land approaches are painted as deck on the ground
  tiles; the 'deco', 'modern' and 'steel' tender's houses and the Coronation Bridge are checked on SwiftShader only.
- Monarch Isle's traffic turns round on Pier Island Drive: Sunset Pier has no traffic of its own to hand over to.

## Helicopters (helicopter3d*.js)
- "POLICE" on the tail boom is partly hidden from low side angles; the door seal is small.
- Canopy glass was made less metallic (0.55) so the sky shines in it: re-check daylight close-ups on a real GPU.

## Ground and trees (ground-*.js, surfaces3d.js, vegetation3d*.js)
- District paving is chosen on a 64-unit grid, so the style can switch mid-pavement at a boundary.
- The roof skin (roofskin3d.js) covers the city's `roofMaterial` caps only: Monarch Isle (`isleRoofCap`, uv tiled every
  96 units), the mountain villages and the North Point towers keep their own roofs. Its cost and the new asphalt wear's
  (a few hundred ALU per roof or carriageway pixel, MEDIUM up; LOW skips the detail layers) are unmeasured on a real GPU.
- Sea sun glitter looked very speckled in headless shots: check on a real GPU.
- Foliage cutaway (foliage-cutaway.js): its 4x4 screen door is fixed to the screen, so the fade edge crawls a little on a
  moving crown (as the building cutaway's does); its GPU cost (a few ALU per tree pixel, none when shut) is unmeasured on a
  real GPU. Plants not drawn with `treeMaterial` are never cut: Monarch Isle's topiary and hedges, the rooftop olive pots.

## Scenic mountain roads (terrain-roads.js, terrain-grading.js, county3d-roads.js)
- Junction mouths between two graded roads keep a small ripple where the surfaces blend (up to ~6 g at 100 km/h at Eagle Pass's start; `mountainRoad()` junctionBumpG100).
- No tunnel or stone bridge yet; the lay-by signs are small at street zoom.
- Grading and carving add about half a second to the range's first build (`terrain()` buildMs roadJunctions..roadCarve).

## Effect particles (fx3d-*.js; docs/areas/rendering-effects.md)
- Soft edges against walls, cars and people only on HIGH and ULTRA (a multisampled scene target, so the depth
  texture is a resolved copy); LOW and MEDIUM fade into the ground only. A depth copy would extend it.
- Smoke is lit by the sun as if in the open: a column standing in a building's shade is not darkened (no shadow
  lookup); the flash and fire lights reach it per corner.
- Tyre smoke, dust and spray (tyresmoke3d.js) and the 4x4 mud mist still draw their own unlit round billboards:
  they could share the lit atlas (`fxPuff`) for the same look at street level.
- Checked in stills on software GL at half resolution: worth a look at 60 fps on a real GPU (flame tongues in
  motion, a blast's timing, the overdraw of a big smoke column on a laptop GPU at 1080p).

## Rendering (postfx3d.js, lighting3d-*.js)
- Beam shadows cover the first 2/6/8 CAR LAMPS slots (MEDIUM/HIGH/ULTRA): drive-map traffic and later slots light through people and cars; buildings never shadow a beam (a corner block lets a kerb-side spill reach the cross street).
- The ground's screen-space bump (GROUND_NORMAL) still takes 2x2-quad derivatives: a 1-pixel scroll changes the shading of the asphalt aggregate and slab joints on ~3% of pixels (Old Quarter on MEDIUM, 1 px against 2 px shifts; the crisp-edge rebuild no longer does).
- The film grade and the golden hour (skyDarkness, the dusk keys) were tuned on SwiftShader: check on a real GPU; dark asphalt in the low sun still leans slightly mauve.
- Headlight strength, the vehicle light budget (road cap 1.5), beam haze and night bloom (threshold 2.6) were tuned on SwiftShader: check on a real GPU and a HiDPI screen.
- On the range, traffic beyond the CAR LAMPS slots (drive light map) tilts with its car but has no terrain horizon: its light only fades a few metres off the tilted plane.
- On the range rain splashes lie on a flat plane at the street height under the view's subject (sunk uphill, floating downhill) and read the car light at city street level (y 1), so they never catch the beams there (weather3d.js).
- A rain streak takes its head's light along its whole length (weather3d.js), so a drop just inside a beam's top edge draws a lit line up to ~6 m above it (lighting each vertex at its own point costs nothing more but changes the city look).
- The terrain horizon sees the height field only: boulders, trees and buildings on the range do not shadow the beams; the mountain haze level and the light bar's strength were tuned on SwiftShader.

## Street frontage (cityscape3d-frontage.js, cityscape3d-shopwindows.js)
- Shop windows on the north, east and west sides are not `b.shopPanes`: bullets never star them, and the damage code's `wallOffset` puts a bullet hole low on those sides 0.18 off the wall, behind the glass or plinth (both assume the south shopfront).
- Only south-side signs lay a wet-road streak (STREAK_CAPACITY 3400 is shared city-wide); streaks now turn to the chase camera, so other sides could have them with a bigger pool.
- No bins in the yards (they would be walk-through without collision); a stoop's door stands two steps up where the crowd's door point is at street level.
- 32 shop names for every shopfront in the city (the 2048² sign atlas is packed up front and nearly full): names repeat along a street.

## Boot and render memory (docs/areas/boot-and-memory.md)
- Boot is ~6 s of simulation (terrain field 1.7 s, county, bike-share plan) plus the renderer's scene build before the title answers: signs and the neon atlas (~16%), ground fields, airport liveries (a per-pixel loop), the far copy of the city (built at boot, used only from the air or zoomed far out). Each could be built lazily (aircraft must stay in their `statics` group; the far copy needs its prewarm upload moved to the pre-upload timer).
- A tier change stages the scene's programs, the post chain and the shadow-depth samples; a car type not in the scene at the switch still compiles on first sight (stand-in models are only built behind the title).
- The cell pre-upload and the staged switch are measured by counts only (software GL has no parallel compiler and no GPU): check the first-visit upload sizes and a tier change on a real GPU.
- JS heap creeps ~0.1-0.2 MB per teleport stop in quiet play (not attributed); the chaos soak's +17 MB follows the sim's retained vehicles (crash-test cars, police): diff two heap snapshots on a quiet machine.

## Unicorn (unicorn3d.js)
- Little muscle definition. The sky reflection now fades on surfaces facing the ground (the bright patch under the chest): not re-shot.

## Witnesses and 911 (witnesses.js, crowd-witnesses.js)
- A call from inside a shop (hidden off-stage call) has no bubble; the 911 bubble keeps the street's 10 px font: check it reads on a HiDPI screen.


## Pedestrians and cars (crowd-awareness.js, runover.js)
- Only the player's car is watched from 16 km/h; traffic keeps the old 31 km/h floor so a queue at a crossing does not become leaping crowds. Night and glare do not change what people see, and music (other than earbuds) does not mask a car.
- A second pass needs 4 km/h and 2 s since the same car's first: a car that creeps over someone it bumped (under 20 km/h) for 2+ s counts as running them over. People outside the four crowd lists (athletes) die at once from a mortal second pass, with no dying second.

## Simulation performance (docs/audit/performance.md, second and third pass)
- Parked vehicles (170-310 of 280-350, more as a session ages) are still visited by the control, broadphase, contact and settle loops 120 times a second: about 0.2-0.3 ms of a 5-8 ms frame (3-5%). An exact active list is not worth it as it stands: pairs must come out in the same order (made by later index, then cell, then earlier index) because contact resolution is sequential, and a resting car wakes from `blastEffects`, a script's x/y write or a velocity push at any moment, so each one must still be polled every step. Cheaper levers left: cache the cell range and radius of a vehicle whose x/y did not change; one `boat` flag per vehicle per step instead of `isBoat(o)` per candidate pair.
- `solid()` still allocates ~140 B a call (doubles boxed for helpers V8 does not inline: groundAt, sportsBlocked, beachClubBlocked...). The helpers that open with a plain bounds test (park, northPointKey, beach, depot, beachClub, monarch) could be gated by a tiny predicate that `solid()` inlines and the helper reuses.
- The crowd grid (`forEachPedestrianNear`, `buildCrowdGrid`) is still a Map by cell key, as the vehicle grid was: a dense array would cut ~0.15 ms a frame.
- The 100-160 ms `drawPoliceMap` stalls of the earlier headless drive profiles did not reproduce: a 15 s drive at three stars (`--profile 10 --who bursts`) has its longest `updateUI` at 11.5 ms and no map painter among the heaviest calls. They were software-canvas flushes landing on whichever map call came next; only a real-GPU run can say more.
- A third of the crowd sits in V8 dictionary mode (after `Object.assign` in `resetWalkerState`); it measured faster than fast mode. Re-measure before changing the people's object layout.
- `carjack-traffic` is flaky: when the traffic car it picks stands beside a bike-share dock, E rents a bike instead (about one run in four).

## Random-walk bot pass (tools/bot.mjs, October 2026)
- Not done in that pass: the bot only ran on the no-render page (graphics tier switches mid-game, the rendered HUD, the map labels and the touch layout at phone size were not driven by it); no HUD-overlap check (two toasts or the police timer over the mission card) beyond the text sweep for NaN / undefined in `integrity()`.
- The bot's trapped-vehicle probe fired once in 58 game minutes of seeds 2 and 3 (a luxury car near the Police HQ, not reproducible from a fresh spawn: a cruiser box-in or a wedge); `steerTo` can leave a car nose to wall.
