# Backlog: known issues and loose ends

Known, unfixed issues reported by the agents that built each feature (as of v30). Pick from
here when polishing; delete a line when it is fixed. Newest features first.

## Free roam and HUD (docs/audit/freeroam-sweep.md)
- Phone (390 px): the car radio unfolds mid-screen for 4 s on getting in, and a toast can sit over it.
- Touch: toasts and the radio chips name keyboard keys (`keyName` has no touch labels).
- The demo's mission card counts MISSION 01 / 11 with two jobs open (design question).
- MIDTOWN, SOUTH BANK, IRONWORKS DOCKS and PALM KEYS · ART DECO have no label on the city map.

## Missions 1 and 2 (harbor*.js, chase.js, roofmission*.js, campaign.js)
- At a fresh boot a double-parked delivery van (crowd-scenes.js) often holds the truck's first kerb spot: the truck then waits further east along the same kerb (x ≈ 1950), still in view.

## Clouds (clouds*.js, clouds3d-*.js)
- The flight camera never looks above ~30 degrees below the horizon: under the base the underside is never in view, only the shadows and the dimmer light.
- The veil is capped so the subject stays readable, so the ground shows through it once a jumper is within ~30 m of the base (the far march covers only beyond the jumper).
- Tower stops are boxes (lot + 0.5 m): a twisted crown (EVOLUTION) is approximated; only the six tallest towers stop rays.
- `cloudAmountAt` (sound, lens, LOW's veil, grey-out) is a likelihood from the coverage map: in a gap the GPU carves it can still say "in cloud".
- Headless: the eased in-cloud values (grey-out, lens) creep because render steps are capped at 0.04 s; judge them in a real browser.
- No shafts on LOW/MEDIUM; no lens on LOW; the cloud sound has no test.

## North Point Key (skyline*.js, skyline3d-*.js)
- East of the city frame: the night lamp map (and signSpill pools) does not reach its ground; it is lit by glows only.
- City traffic never drives onto the Key (the street ends at the circle); no valet cars circle it.
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
- The Blue Hour terrace canopy landing is kept but has no test.

## Driving (driving.js, physics-*.js)
- 50–0 km/h stops are slightly longer than before (the 0.2 s pedal build-up).
- Soaked roads add 43–58 % to ABS stops (target 30–50 %).
- AI traffic and police use the simple ABS-equivalent brake, not the per-axle tyre model.
- Drifts need TCS and ESC off (or a classic): with ESC on a handbrake-started slide is damped
  0.8 s after the handbrake. A 'sport' ESC mode that allows ~15 degrees would open drifting up.
- Traffic and police smoke only from `c.sliding` (no tyre slip of their own); a shoved parked
  car lays rubber but no smoke.

## Camera and combat feel (camera-feel.js, tyresmoke3d.js)
- With both a mouse and the touch aim stick used on one page, `playerShotTarget` still snaps to
  whoever is near the (stale) cursor; the camera leans along the stick.
- Rain spray and dust were checked only in stills (headless frames are seconds apart); worth a
  look on a real GPU at speed in the rain and on the beach.

## Mountain island (mountain-village*.js, mountain-club3d.js)
- Windows glow only faintly at night from the default camera height; lamp pools still strong.
- Northridge metal roofs (rescue barn, general store) were lightened but not re-shot.
- The Last Witness now lands at the Northridge ranger station pad: play the mission through once.

## Drawbridge (drawbridge*.js)
- Counterweights leave the top-down view after sinking ~10 m.
- The ALBATROSS's fore-and-aft sails are nearly edge-on from above.
- About half the onlookers wander off before the leaves are fully up.

## Helicopters (helicopter3d*.js)
- "POLICE" on the tail boom is partly hidden from low side angles; the door seal is small.
- Tinted canopy glass looks very dark in daylight close-ups.

## Ground and trees (ground-*.js, surfaces3d.js, vegetation3d*.js)
- The beach keeps the old painted speckle under the ripples.
- District paving is chosen on a 64-unit grid, so the style can switch mid-pavement at a boundary.
- Sunset Pier and Fort Sentinel have no kerb distance field (no kerb stones or lane wear).
- Sea sun glitter looked very speckled in headless shots: check on a real GPU.

## Scenic mountain roads (terrain-roads.js, terrain-grading.js, county3d-roads.js)
- Junction mouths between two graded roads keep a small ripple where the surfaces blend (up to ~6 g at 100 km/h at Eagle Pass's start; `mountainRoad()` junctionBumpG100).
- No tunnel or stone bridge yet; the lay-by signs are small at street zoom.
- Grading and carving add about half a second to the range's first build (`terrain()` buildMs roadJunctions..roadCarve).

## Rendering (postfx3d.js, lighting3d-*.js)
- Only the player's beams are shadowed (BEAM SHADOWS); other CAR LAMPS light through people and cars.
- The ground's crisp-edge rebuild still uses 2x2-quad derivatives: each 1-pixel scroll flips the edge AA on some kerbs and markings (~1% of pixels).
- Tree cut-outs would antialias better with alpha-to-coverage on MSAA tiers (vegetation3d-material.js; r160 forces alpha 1 on opaque materials).
- Headlight strength, beam haze and night bloom were tuned on SwiftShader: check on a real GPU and a HiDPI screen.
- On the range, traffic beyond the CAR LAMPS slots (drive light map) tilts with its car but has no terrain horizon: its light only fades a few metres off the tilted plane.
- On the range rain splashes lie on a flat plane at the street height under the view's subject (sunk uphill, floating downhill) and read the car light at city street level (y 1), so they never catch the beams there (weather3d.js).
- A rain streak takes its head's light along its whole length (weather3d.js), so a drop just inside a beam's top edge draws a lit line up to ~6 m above it (lighting each vertex at its own point costs nothing more but changes the city look).
- The terrain horizon sees the height field only: boulders, trees and buildings on the range do not shadow the beams; the mountain haze level and the light bar's strength were tuned on SwiftShader.

## Unicorn (unicorn3d.js)
- Bright sky-reflection patch under the chest in daylight (lacquer material); little muscle definition.

## Witnesses and 911 (witnesses.js, crowd-witnesses.js)
- Dealership staff (MONARCH MOTORS) and North Point Key guests have their own alarms and never call 911; a crashed driver's call (crowd-traffic.js) is not counted among the incident's witnesses, so a second caller may be sent.
- A call from inside a shop (hidden off-stage call) has no bubble; the 911 bubble keeps the street's 10 px font: check it reads on a HiDPI screen.

