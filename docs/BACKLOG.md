# Backlog: known issues and loose ends

Known, unfixed issues reported by the agents that built each feature (as of v30). Pick from
here when polishing; delete a line when it is fixed. Newest features first.

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
- A canopy landing on an ordinary roof still glides past the building; only freefall onto a roof is an impact.
- The Blue Hour terrace canopy landing is kept but has no test.

## Driving (driving.js, physics-*.js)
- 50–0 km/h stops are slightly longer than before (the 0.2 s pedal build-up).
- Soaked roads add 43–58 % to ABS stops (target 30–50 %).
- The hot rod (no TCS/ESC) spins under power before lifting off.
- AI traffic and police use the simple ABS-equivalent brake, not the per-axle tyre model.

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
- Monarch Isle traffic turns round at the Regency Road's end, in Eagle Pass's junction: cars coming down the pass can meet it.
- No tunnel or stone bridge yet; the lay-by signs are small at street zoom.
- Grading and carving add about half a second to the range's first build (`terrain()` buildMs roadJunctions..roadCarve).

## Rendering (postfx3d.js, lighting3d-*.js)
- Only the player's beams are shadowed (BEAM SHADOWS); other CAR LAMPS light through people and cars.
- The ground's crisp-edge rebuild still uses 2x2-quad derivatives: each 1-pixel scroll flips the edge AA on some kerbs and markings (~1% of pixels).
- Tree cut-outs would antialias better with alpha-to-coverage on MSAA tiers (vegetation3d-material.js; r160 forces alpha 1 on opaque materials).
- Headlight strength, beam haze and night bloom were tuned on SwiftShader: check on a real GPU and a HiDPI screen.

## Unicorn (unicorn3d.js)
- Bright sky-reflection patch under the chest in daylight (lacquer material); little muscle definition.

## Witnesses and 911 (witnesses.js, crowd-witnesses.js)
- Dealership staff (MONARCH MOTORS) and North Point Key guests have their own alarms and never call 911; a crashed driver's call (crowd-traffic.js) is not counted among the incident's witnesses, so a second caller may be sent.
- A call from inside a shop (hidden off-stage call) has no bubble; the 911 bubble keeps the street's 10 px font: check it reads on a HiDPI screen.

## Other
- `src/marina.js` calls the superyacht 105 m; its deck spans about 66 m at the current scale.
- `GAME_VERSION` is still 30.0.0; fold `docs/changes/` with `python3 tools/changelog.py --release` at the next version.
