# Audit report: visual QA tour

A systematic screenshot tour of the whole map after the graphics overhaul (post pipeline,
lighting, surfaces, flight camera and clouds, railway, beach, marina, damage, crowd), on
the HIGH tier (`DeadEndCity.graphics('high')`; headless SwiftShader auto-detects LOW).

## How the tour was run

- Northbank on a 1200 x 700 grid at zoom 0.6 (x 400..3450, y -3900..5700), Palm Keys
  (x 4300 / 5200, y 300..5200), Sunset Pier, both airports, Oceanview, Palmshore, Eastgate,
  Northridge, Stonecreek, the Ridgeline peaks and Fort Sentinel, all at noon in clear sky.
- Close-ups at zoom 1.2: the 13 stations, Harbor Point marina gate and superyacht, the
  cruise terminal, the stadium, the theme park, the Ironworks cranes and freighter, the
  depot, the police and riverside helipads, the bridges, the beach and pier.
- Golden hour (19:00), night (23:00), rain at 14:00 and 22:00.
- Helicopter at 80, 150, 250, 400, 700, 800 and 900 m in clear, fair and cloudy weather;
  a plane at 60, 150 and 900 m; the AO and bloom buffers (`postView`).
- `node tools/layout-audit.mjs` before and after the layout change (lamps): no overlaps,
  the same 27 oblique road contacts, all county and airport junctions.

Draw calls (`stats()`, Midtown at zoom 0.6): day 435 view / 625 shadow before, 417 / 619
after; night 437 / 641 before, 450 / 408 after (every lamp drawn, halos hidden by day).

## Found and fixed

| Where | Symptom | Cause | Fix |
| --- | --- | --- | --- |
| West sea, x < 0 (visible from any west-shore view) | Turquoise shallows, foam blotches and long horizontal foam streaks far out at sea | The distance-to-shore texture clamps at the world box, so its edge column was smeared to the horizon | world3d.js: distance past the field's edge is added to the shore distance and the beach channel fades out there |
| Whole city from ~150 to ~500 m up | Buildings cast no shadows at all (flat, lifeless city from the helicopter) | three.js tests layers against the *view* camera in the shadow pass; the far-city shadow proxy was put on a layer enabled only on the sun's shadow camera, so it never rendered, while the real casters had their shadows switched off | flight-view3d.js: the proxy layer is enabled on the view camera for the shadow-map pass only |
| From the helicopter in fair weather | Cloud shadows as hard-edged dark blotches, a camouflage pattern | Four crisp samples of the carved cloud-cell density at strength 0.5 in a navy tone | clouds3d.js: soft-threshold density, two heights, a ring of taps (~60 m penumbra), strength 0.34, slate tone |
| From the air crossing cloud edges | The whole city's light pumped up and down | The sun was dimmed for the cloud over the view centre however wide the view | clouds3d.js: that dimming fades out once the view is wider than a cloud |
| Overcast and rain | Dark blotches over wet streets and roofs, read as dirt | Cloud shadows kept 15-35% strength under a closed deck | clouds3d.js: they fade out completely between cloud 0.72 and 0.9 |
| Shore Line viaduct from the air | A white streak along every curve of the rails | Rails at 0.25 roughness / 0.8 metalness caught the sun and bloomed | transit3d.js: worn steel (0.42 / 0.7) |
| Every view | Dark bars at the top and bottom of the frame | The CSS `#vignette` (dusk edition) stacked a heavy gradient on the graded image's own vignette | shell.html: only enough to seat the HUD |
| After `look()` / a teleport from the water | Swimmer's pose, wake and a stale SWIMMING toast over dry land for a frame or more | `teleportPlayer` did not clear `swimming` / `wading` | game.js: cleared along with the altitude and toast; an airborne aircraft (which cannot be left) comes along instead of hanging where it was |
| Every Ridgeline peak | A pale stepped ring round the foot of each mountain | The hill mesh (10-unit grid) started pale green-grey while the ground round it is dark green, so its jagged outline showed | county3d.js: the foot takes the region's ground colour, rock comes in with height and slope |
| Snow caps | A grid over the snowfield and a staircase along the snow line; the cap sat on the hill like icing | Overlapping 9-px squares on an 8-px grid doubled alpha along every seam | terrain.js: a smoothed coarse snow mask; gullies carry tongues of snow down the slope |
| County (Oceanview, Ridgeline, Coral Coast) | Flat, textureless pastel ground | County ground tiles had no procedural detail | surfaces3d.js / county3d.js: the city ground detail (grain, dry patches, broad meadow swathes) on county tiles and hills (no paving/tarmac branches on hills) |
| Parks and county grass at street zoom | Pixel mosaic of blades, square yellow patches | One value-noise octave shows its lattice | surfaces3d.js: two octaves on rotated, offset lattices |
| Night, every district | Avenues and landmark blocks dark; only one lamp in two lit | The renderer and light map took every second entry of `lamps`, all on cross-street kerbs | render3d.js / lighting3d.js / game.js: every lamp drawn and lit, three lamps down each avenue kerb (landmark blocks too), lamps pruned off carriageways, service roads and rail piers like trees |
| Standing south of a tower | Tower drawn as a ghost at 28% with its glass bands, roof plant and trim solid and floating, tiers showing through each other; materials recompiled at each switch | Only the building's own three materials faded | lighting3d.js / render3d.js: a dithered cutaway disc round the player in the shared material patch (above head height, well in front of the player); trees and viaduct decks clear too |
| Ironworks terminal | IRONWORKS CARGO sign hung from below ground to 49 with the loading canopy and lamps across the lettering | 210-wide board at the default height | harbor3d.js: 150 wide on the facade above the canopy; `sign()` keeps any wide board above ground |
| Vinny's depot | MORETTI FREIGHT sign hung across the vehicle doorway, clipped by the door posts | Default height in front of the shutter | harbor3d.js: over the shutter header, proud of the roof line |
| Harbor Point and other quays | Rings of foam 45 units apart round the whole reclamation | The rolling wash lines ran along every shore | world3d.js: full strength only off beaches |

Before / after screenshots (scratch paths from the tour): west sea `n06-400_300` / `w1`;
helicopter shadows `alt150`, `alt250` (after); cloud shadows `cf4` / `cf4b`, `cf6` / `cf6b`;
mountains `mt-9760_1230` / `mt3-9760`, `mtair` / `mtair3`; night `n23-midtown06` /
`lampn1`, `n23-palmkeys` / `lampn2`; cutaway `fade1` / `cut5`; teleport `sw3` / `swfix`.

## Checked, no change needed

- Marina: sixteen boats sit in their berths between the fingers, none clip the pontoons;
  the superyacht lies clear of the quay with her tender alongside.
- Stations, rail curves and piers: no columns in buildings or carriageways (layout audit).
- Stadium, theme park, beach, pier, both airports, Fort Sentinel, harbour cranes and the
  freighter: nothing floating, sunk or overlapping.
- Night: lamp pools, shop spill and neon read clearly; wet streets at night keep the pools.
- Golden hour: warm, long shadows towards the east; no banding.
- AO buffer: nothing on sky or water; bloom: no halos at noon.

## Known, not changed

- Inside the cloud layer (700-800 m, fair or cloudy) much of the frame is a flat grey
  wall; that is what flying in cloud looks like, but the wall has little structure.
- The helicopter's rotor disc is quite visible from above at dusk.
- Rail deck and tunnel roof fades (transit3d.js, air-cover3d.js) still run alongside the
  new cutaway; both agree, but the fades could be retired in favour of it.
- The water's fine ripple normal uses value noise and shows faint axis-aligned streaks
  close up.
