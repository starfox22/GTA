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
- Damage direction: only gunfire shows the red arc (pursuit-officers.js playerHitFeedback); blasts and melee do not.
- Gamepad: tested with a virtual pad only (`gamepadFeed`); no rumble; the settings screen cannot rebind pad buttons.
- The 2D fallback renderer's speech bubbles keep the old 10 px text.

## Missions 1 and 2 (harbor*.js, chase.js, roofmission*.js, campaign.js)
- Vinny's truck (vinnytruck3d.js) has no crumple shell or pane-by-pane glass damage (tyres, burn and lamps only), and a respray keeps its MORETTI & SONS door lettering.
- The payphone's and newspaper boxes' foot obstacles are registered by the renderer (like the bus shelters), so a `?norender` page walks through them.
- At night the white faces round the payphone (newspaper pages, placards) sit in the street lamp's pool and read bright.
- The Blue Hour's limousines have no chauffeurs and never leave; the doormen and valet keep their posts (no door opened, no car taken). The forecourt fixtures are foot obstacles, which stop only the player: a street walker straying to the wall or the kerb can pass through a planter or bollard.
- At a fresh boot a double-parked delivery van (crowd-scenes.js) often holds the truck's first kerb spot: the truck then waits further east along the same kerb (x ≈ 1950), still in view.
- `missionIndex` doubles as the job a replay picked: with one job done (before the demo's end) a replay of job 1 that is hung up on or failed leaves the payphone offering job 1 again, not job 2 (job 2 is still "CURRENT" in the picker); `settleDemoStoryIndex` only covers a finished demo. RESTART CURRENT JOB right after winning job 1 starts job 2 without its payphone call.
- Bug pass 2026-10-02 (docs/changes/2026-10-02-missions-bug-pass.md) found no soft-lock: death, busting and retry at every stage, saving and reloading mid-job, the respray route with the truck, the truck rolled to the quay edge (it stops at the kerb, never in the sea), spiking the glass and leaving before he drinks, a parachute onto the hotel roof (not landable), 70-step random-action runs on both jobs, and `settleAudit()` at every parked truck, limousine and ambulance moment (0 changes). Not covered: a real chase with the police in play on the way to Vinny's warehouse (the tests use god mode for the harbor police), a gamepad-only run, and the story subtitle (Vinny's line) touching the minimap's corner at a 960x600 window.

## Clouds (clouds*.js, clouds3d-*.js)
- The flight camera never looks above ~30 degrees below the horizon: under the base the underside is never in view, only the shadows and the dimmer light.
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

## Driving (driving.js, physics-*.js)
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

## Drive-bys (driveby.js, crowd3d-driveby.js)
- Only the pistol fires from a vehicle, so the SMG one-hand and two-handed lean-out poses are not
  drawn; the rear, windscreen and passenger-side shots fire from inside the cabin, which the
  opaque roof hides from the street camera (only the flash, the burst screen and the tracers show).
- Trucks, the hypercars and other special bodies have no per-pane glass: their driver's window
  does not show wound down and a burst windscreen or rear screen shows only as the crumbs.
- A boat's helmsman and an aircraft's pilot are not drawn during a drive-by (the shot still
  follows the arcs and leaves from `driveByGrip`).

## Mountain island (mountain-village*.js, mountain-club3d.js)
- Northridge metal roofs (rescue barn, general store) were lightened but not re-shot.
- The Last Witness now lands at the Northridge ranger station pad: play the mission through once.

## Drawbridge (drawbridge*.js)
- Counterweights leave the top-down view after sinking ~10 m.
- The ALBATROSS's fore-and-aft sails are nearly edge-on from above.
- About half the onlookers wander off before the leaves are fully up.

## Helicopters (helicopter3d*.js)
- "POLICE" on the tail boom is partly hidden from low side angles; the door seal is small.
- Canopy glass was made less metallic (0.55) so the sky shines in it: re-check daylight close-ups on a real GPU.

## Ground and trees (ground-*.js, surfaces3d.js, vegetation3d*.js)
- District paving is chosen on a 64-unit grid, so the style can switch mid-pavement at a boundary.
- Sea sun glitter looked very speckled in headless shots: check on a real GPU.

## Scenic mountain roads (terrain-roads.js, terrain-grading.js, county3d-roads.js)
- Junction mouths between two graded roads keep a small ripple where the surfaces blend (up to ~6 g at 100 km/h at Eagle Pass's start; `mountainRoad()` junctionBumpG100).
- No tunnel or stone bridge yet; the lay-by signs are small at street zoom.
- Grading and carving add about half a second to the range's first build (`terrain()` buildMs roadJunctions..roadCarve).

## Rendering (postfx3d.js, lighting3d-*.js)
- Beam shadows cover the first 2/6/8 CAR LAMPS slots (MEDIUM/HIGH/ULTRA): drive-map traffic and later slots light through people and cars; buildings never shadow a beam (a corner block lets a kerb-side spill reach the cross street).
- The ground's screen-space bump (GROUND_NORMAL) still takes 2x2-quad derivatives: a 1-pixel scroll changes the shading of the asphalt aggregate and slab joints on ~3% of pixels (Old Quarter on MEDIUM, 1 px against 2 px shifts; the crisp-edge rebuild no longer does).
- The film grade and the golden hour (skyDarkness, the dusk keys) were tuned on SwiftShader: check on a real GPU; dark asphalt in the low sun still leans slightly mauve.
- Headlight strength, the vehicle light budget (road cap 1.5), beam haze and night bloom (threshold 2.6) were tuned on SwiftShader: check on a real GPU and a HiDPI screen.
- On the range, traffic beyond the CAR LAMPS slots (drive light map) tilts with its car but has no terrain horizon: its light only fades a few metres off the tilted plane.
- On the range rain splashes lie on a flat plane at the street height under the view's subject (sunk uphill, floating downhill) and read the car light at city street level (y 1), so they never catch the beams there (weather3d.js).
- A rain streak takes its head's light along its whole length (weather3d.js), so a drop just inside a beam's top edge draws a lit line up to ~6 m above it (lighting each vertex at its own point costs nothing more but changes the city look).
- The terrain horizon sees the height field only: boulders, trees and buildings on the range do not shadow the beams; the mountain haze level and the light bar's strength were tuned on SwiftShader.

## Unicorn (unicorn3d.js)
- Little muscle definition. The sky reflection now fades on surfaces facing the ground (the bright patch under the chest): not re-shot.

## Witnesses and 911 (witnesses.js, crowd-witnesses.js)
- A call from inside a shop (hidden off-stage call) has no bubble; the 911 bubble keeps the street's 10 px font: check it reads on a HiDPI screen.


## Pedestrians and cars (crowd-awareness.js, runover.js)
- Only the player's car is watched from 16 km/h; traffic keeps the old 31 km/h floor so a queue at a crossing does not become leaping crowds. Night and glare do not change what people see, and music (other than earbuds) does not mask a car.
- A second pass needs 4 km/h and 2 s since the same car's first: a car that creeps over someone it bumped (under 20 km/h) for 2+ s counts as running them over. People outside the four crowd lists (athletes) die at once from a mortal second pass, with no dying second.

## Simulation performance (docs/audit/performance.md, second pass)
- Every parked vehicle (~230 of ~280) is still visited by the broadphase, contact and control loops 120 times a second, about a microsecond each. An active list with the parked ones tracked by the cells they occupy would remove most of the physics cost; contact results must stay exact (`settleIsTrivial` already skips the settle for them).
- `updateCars` (physics-update.js) makes a closure and a four-element array per vehicle near the player every frame for the pedestrian contact test.
- The remaining garbage (~1.2 MB a frame headless) is boxed doubles passed to helpers V8 does not inline (`solid()` and its twenty `*Blocked` helpers, `rectListBlocked`, `distanceBetween`).
- A third of the crowd sits in V8 dictionary mode (after `Object.assign` in `resetWalkerState`); it measured faster than fast mode. Re-measure before changing the people's object layout.
- `carjack-traffic` is flaky: when the traffic car it picks stands beside a bike-share dock, E rents a bike instead (about one run in four).

## Random-walk bot pass (tools/bot.mjs, October 2026)
- A plane flies on past the edge of the world box (WORLD_LEFT..WORLD_SIZE, WORLD_TOP..WORLD_SIZE: 13 km west of it was reached in one run) and a boat sails on over the open sea: nothing turns either back, and what the renderer draws out there was not looked at (no rendered bot run yet).
- The hospital's GET TREATMENT ($150), the armory's BODY ARMOR ($350) and the bar and diner meals charge full price at full health or full armour (a gun shop says "Ammunition is already full" and charges nothing); serviceAction (citylife-police.js). A diner's time skip may be the point of its plate: a design question.
- Not done in that pass: the bot only ran on the no-render page (graphics tier switches mid-game, the rendered HUD, the map labels and the touch layout at phone size were not driven by it); no HUD-overlap check (two toasts or the police timer over the mission card) beyond the text sweep for NaN / undefined in `integrity()`.
- The bot's trapped-vehicle probe fired once in 58 game minutes of seeds 2 and 3 (a luxury car near the Police HQ, not reproducible from a fresh spawn: a cruiser box-in or a wedge); `steerTo` can leave a car nose to wall.
