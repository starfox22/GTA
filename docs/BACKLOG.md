# Backlog: known issues and loose ends

Known, unfixed issues reported by the agents that built each feature (as of v30). Pick from
here when polishing; delete a line when it is fixed. Newest features first.

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
- The beach keeps the old painted speckle under the ripples; county verges read as pale gravel.
- District paving is chosen on a 64-unit grid, so the style can switch mid-pavement at a boundary.
- Sunset Pier and Fort Sentinel have no kerb distance field (no kerb stones or lane wear).
- Italian cypress looks stacked from the side; Bradford pear is small and dark at street zoom.
- The mountain far LOD uses the spruce cone for pines too.
- Sea sun glitter looked very speckled in headless shots: check on a real GPU.

## Unicorn (unicorn3d.js)
- Bright sky-reflection patch under the chest in daylight (lacquer material); little muscle definition.

## Missions and demo (harbor.js, campaign.js)
- A POLICE LOST banner can sit over the PAYDAY line of the MISSION COMPLETE card.
- A downed (crawling) officer counts as eliminated in mission 1's warehouse stage.
- The demo card also appears when a player replays mission 2.

## Other
- `src/marina.js` calls the superyacht 105 m; its deck spans about 66 m at the current scale.
- `GAME_VERSION` is still 30.0.0; fold `docs/changes/` with `python3 tools/changelog.py --release` at the next version.
