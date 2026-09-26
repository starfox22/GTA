# Audit report: graphics review and performance pass

An art-direction review of the whole map on the HIGH tier (`DeadEndCity.graphics('high')`),
followed by fixes to the weakest points and a performance pass on the heaviest scenes. Run
on the build before version 30 (lead branch at `b6f9735` plus the rounds merged after it).

## How it was run

- One headless page kept open and driven with console calls (a small Playwright server
  with `page.evaluate`, as `docs/DEVELOPMENT.md` suggests), 1280 x 800, SwiftShader. Each
  view waits three rendered frames after `look()` so the shadow map and the camera have
  caught up (a screenshot of the first frame after a teleport shows the previous place's
  shadows).
- Noon in clear sky: Midtown, Old Quarter / Palm Square, North Point at zoom 0.5, Central
  Garden, the stadium, Battery Park, Harbor Point marina and the superyacht, the Ironworks
  docks, Palm Keys Beach, Marea Beach Club, Ocean Drive, Sunset Pier, Stonecreek, Fort
  Sentinel. Golden hour (18.3 and 19.0), night (23.0) and rain at night (22.0) in Midtown,
  North Point, the beach club, Sunset Pier and Central Garden. The helicopter at 150, 400 and
  900 m over North Point and the Reclamation.
- `stats()` and `drawProfile()` at the heavy spots, before and after, each on a freshly
  booted page (see the table below), and a CPU profile of the page load (Chrome DevTools
  protocol) for the boot time.

Headless SwiftShader draws a frame in 3 to 10 seconds on the shared test machine, so its
CPU milliseconds are inflated many times over and only comparable with each other; draw
calls and triangles are exact and are what the tables compare.

## Critique (before)

What already worked: night in the financial cluster (LED crowns, lit floors, lamp pools on
the plazas) is genuinely striking; rain at night (wet streets, neon streaks, halos) is moody
and readable; the sea (deep blue, turquoise shallows off the Keys, breakers on the beach),
the marina and the superyacht read well; the beach with its umbrellas is lively; the towers
and their shadows from the helicopter are convincing.

The weakest points, in order of how much of the screen they cost:

| Where | What was wrong |
| --- | --- |
| Every daytime view | Washed out. The pale pavements, roofs and plazas sat on the shoulder of the tone curve, so the city read as a pale grey sheet with little contrast; the sky fill was so strong against the sun that shadows were a faint grey (1 : 2.5 lit to shade). |
| Financial towers at noon | Curtain walls read as flat grey. Both cameras look down on the facades, so a true mirror reflection off a vertical pane points below the horizon and every tower mirrored the environment's dim "ground" colour. |
| Golden hour | Not golden: the low sun was a weak key (1.4) with lamps already on, so 19:00 read as a mauve dusk. Roofs facing away from the sun went black. |
| Central Garden, Battery Park, county towns | Large flat, empty lawns in a pale pastel green; Battery Park a bare 1.3 km strip of lawn; the Great Lawn an empty square. |
| Park ground | Map labels painted into the 3D ground ("GREAT LAWN", "GARDEN LAKE", "PALM SQUARE", park names): they belong on the map, not on the grass. |
| Garden Lake, fountain basins | A flat pale-cyan disc: no depth, no surface, read as plastic. |
| Garages (Eastside Customs, Palm Auto Paint) | A flat grey-blue slab of a roof that read as a hole in the block. |
| The sea from 400-900 m | Fine ripples a few units across could not be resolved: white sub-pixel glints flickered over the whole sea (shimmer); the sun path widened into a blown-out streaky patch. |
| HUD | The district name shown three times on entering one: permanently in the location block top left, as a gold caption bottom right, and (at the start) as the centre headline card. |
| County ground | Paler, more pastel greens than the city sheet: the land changed colour across the bridges. |

Not changed (judged fine or out of scope): night readability (moonlight plus lamp pools
keep every street legible), bloom (restrained by day, generous but not smeary at night),
the HUD's legibility over bright scenes once the image was darker, the sky dome when flying
(the camera looks down; the horizon only shows when climbing).

## Fixes

| Area | Change | Where |
| --- | --- | --- |
| Daylight | Sun and sky light scaled into the tone curve's range at noon (sun 3.95 -> 2.9, sky fill 2.2 -> 0.95, about 1 : 3 lit to shade) with the exposure unchanged, so display-referred shaders (water, signs, sky) look as designed; grade saturation 1.06 -> 1.16, contrast 1.05 -> 1.14. Mean brightness of a Midtown frame at noon 145 -> 122 (of 255), with deeper, bluer shadows. | civic3d.js, lighting3d.js |
| Golden hour | A strong warm key at low sun (+0.9 at the dusk peak) and more sky fill through twilight so roofs facing away from it keep their shape. | civic3d.js |
| Glass | Facade glass (skyline glazing, curtain walls, office windows, shop glass, lobbies) folds its reflection up into the sky, darkens towards the street canyon (a pane low down mirrors the street, not the sky) and carries a slow world-space variation standing in for neighbouring towers and clouds. Towers now read as blue glass with a gradient up the shaft. | lighting3d.js (GLASS REFLECTIONS), skyline3d.js, cityscape3d.js |
| Lawns | The ground shader's grass is deeper and slightly bluer (less lime); county sheets toned down to match the city. | surfaces3d.js, county3d.js |
| Landscaping | New landscape3d.js: a tree either side of every Battery Park bay and a raised flower bed with a box hedge between them; picnic blankets and baskets on the Great Lawn. Renderer-only (no collision, not in the plan). | landscape3d.js |
| Park labels | Kept off the 3D ground (the 2D and minimap sheets keep them). | render3d.js |
| Still water | Garden Lake and fountain basins deeper and darker with a tiling ripple normal map that drifts with the wind. | renewal3d.js, surfaces3d.js |
| Sea shimmer | Fine ripples, the tight sun highlight and the night sparkle fade with the pixel footprint (`fwidth`); the highlight widens and dims instead. | world3d.js |
| Garage roofs | Ribbed steel roof sheet. | garage3d.js |
| District name | One presentation: the location block top left plays a short gold reveal when the district changes; the bottom-right caption is gone and the opening card reads DEAD END CITY instead of repeating the district. | story.js, shell.html, game.js |

## Performance

### Changes

- **Shared facades** (cityscape3d.js SHARED FACADES): every building had its own facade
  material (texture repeat, tint and window-light schedule), so every building's walls
  were a draw call the static batcher could not merge. Facades are now a handful of shared
  materials; the repeat is baked into each building's wall UVs, the tint is a vertex colour
  and the window light (strength, phase) a vertex attribute that the facade shader applies
  with the street power (the blackout job). The batcher copies the extra attributes, the
  far copy reads the tint.
- **Building blocks** are walls plus a roof cap in one of the shared roof finishes (the
  six-material box was three draws per building that could not be merged); trims, plinths,
  fins, bulkhead doors, helipad decks and shopfront frames share one material per finish.
- **Theme park rides** (carousel horses, swing seats, teacups, flume boats, the Falcon's
  cars) are drawn as instances fed from the animated groups: ~150 fewer draws (and as many
  shadow draws) whenever Sunset Pier is in view.
- **Match day**: the 22 players and officials cast shadows from their torsos only, as the
  crowd's people do, and the ball's panels not at all (~500 fewer shadow draws).
- **Adaptive quality** (quality.js ADAPTIVE QUALITY), AUTO only: the scene, AO and bloom
  passes are drawn at a lower resolution when frames average under ~52 FPS while the CPU
  work fits the frame (10% steps down to 60%), the composite pass upsamples to the full
  canvas (HUD, grade and FXAA stay sharp), and the resolution creeps back when there is
  headroom; still slow at 60% or CPU-bound, one tier down (at most twice). Chosen tiers are
  never touched. `graphics()` reports `renderScale` and the adaptive state.
- **Memory**: the baked ground canvases are released once their textures are on the GPU
  (city sheet ~29 MP, the county, Sunset Pier and Fort Sentinel sheets: ~180 MB of bitmaps),
  and the 2D fallback's ground bitmap (~21 MP) is painted at a quarter of the resolution
  when WebGL 2 is available and freed when the 3D renderer starts. The city sheet stays one
  29 MP texture on the GPU (~155 MB with mipmaps; 15 MP on touch devices): tiling it would
  not save GPU memory without streaming, and its resolution is what keeps the painted
  markings legible.
- **Shader stalls**: three.js read back every shader's info log after compiling it, which
  forces the driver to finish compiling on the spot (the lead's runtime profile showed it
  as 68% of sampled CPU). It is off unless the URL has `?shadercheck`. While the title
  screen is up, the scene's programs are compiled a slice at a time (`prewarmShaders`, with
  the HDR target bound so they match the scene pass), so with KHR_parallel_shader_compile
  they link in the background instead of hitching when a district first comes into view.
- **Instrumentation**: `stats()` splits the renderer's CPU time into `r:` parts (camera,
  sky, scenery, LOD, crowd, vehicles, damage, people and effects, submit with and without a
  shadow refresh) and reports linked programs and the render scale; `drawProfile()` lists
  programs by kind and names the unbatched parts of anonymous groups with their colour.

### Before / after

HIGH tier, 1280 x 800, each scene on a freshly booted page, stats() over six frames after
four settling frames. "Before" is the lead branch at `b6f9735`; "after" is this pass.
`view` = camera-pass draw calls, `shadow` = shadow-map draw calls on its last refresh, `draw`
= CPU ms per frame for the renderer (SwiftShader: comparable only with each other).

| Scene | view before | view after | shadow before | shadow after | triangles before | after | draw ms before | after |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| North Point towers, zoom 0.5, noon | 397 | 394 | 400 | 400 | 1.53 M | 0.97 M | 57.3 | 37.2 |
| Marea Beach Club, 23:30 | 284 | 223 | 265 | 179 | 1.45 M | 1.42 M | 47.2 | 33.7 |
| Stadium, match in play | 902 | 857 | 1077 | 484 | 2.05 M | 1.87 M | 52.4 | 32.5 |
| Sunset Pier, zoom 0.5 | 459 | 279 | 366 | 232 | 1.82 M | 1.83 M | 36.9 | 28.9 |
| Midtown, rain at 22:00, zoom 0.8 | 382 | 320 | 502 | 441 | 1.33 M | 1.44 M | 48.0 | 31.7 |
| Midtown, 5-star chase (`wanted(5)`) | 212 | 210 | 380 | 330 | 1.23 M | 1.29 M | 39.1 | 30.8 |
| Helicopter 400 m over North Point | 959 | 637 | 433 | 433 | 2.24 M | 1.43 M | 58.4 | 37.4 |
| Helicopter 900 m over North Point | 568 | 592 | 755 | 622 | 2.68 M | 1.28 M | 42.1 | 41.9 |

Where the counts did not move much (North Point at street zoom, the chase) the view is
dominated by vehicles and the crowd, not scenery (see Known issues). Simulation CPU
(`updateMs`) is unchanged within noise (22-35 ms headless in both builds): the crowd,
traffic and physics loops already had distance LOD and staggered updates, and they belong
to the combat and streets work running in parallel. The adaptive resolution is the lever
for GPU-bound machines; on a mid-range laptop GPU the HIGH tier at 1080p is fill-bound in
the scene pass (MSAA 4x at pixel ratio 1.5), which AUTO now scales down before it drops a
tier.

### Boot

CPU profile of the page load, split publish build (`dist/publish/index.html`, 9.6 MB),
headless with `--disable-accelerated-2d-canvas`, machine load 7-8:

| Build | Title screen ready | Start clicked -> playing |
| --- | --- | --- |
| Lead branch (`13d11de`, fetched as an archive) | 46.8 s | 9.4 s |
| This pass | 32.0 s | 2.5 s |

The ~804 s the lead measured was on a machine at load ~13 and could not be reproduced (the
lead build took 47 s here); the hot spots in both profiles were the same: three.js's
shader info-log read-back and program linking on the first frame (30.6 s self time in the
lead build, 13.3 s now), the 2D fallback's ground bitmap (the `rect` and tree painting of
`buildWorld`, ~4 s, now painted at a sixteenth of the pixels) and `paintPromenades`
(2.7 s, now one path per coast segment). What remains of the first frame is linking the
programs actually in view, which a real GPU with KHR_parallel_shader_compile does in the
background during the title screen (`prewarmShaders`); on SwiftShader, without the
extension, forcing every material's link up front cost ~90 s of main-thread time and was
dropped there.

The split build's `index.html` is 9.6 MB (limit 15.5 MB) and boots with no console
errors or warnings other than three.js's own deprecation notice.

## Known issues

- Vehicles are now the largest share of street-level draws: a car is still ~30 meshes
  after its wheel rims were merged (~80 draws in a busy Midtown view). Instanced body
  shells take over below zoom 0.62; merging each car's static trim into one mesh per
  material would roughly halve the rest, but vehicle damage re-poses bumpers, doors, lamps
  and glass individually, so it needs care.
- Match-day players are still ~22 draws each in the camera pass (person models belong to
  the animation work going on in parallel; only their shadows were trimmed).
- The first frame still links every program in view at once where the browser lacks
  KHR_parallel_shader_compile (13 s of the headless boot on SwiftShader; typically well
  under a second on a real GPU). About 140 programs are linked in a city view; custom
  ShaderMaterials (glows, water, sky, clouds, wakes, the park's point lights) are a third
  of them.
- The helicopter at 900 m draws slightly more than before in the camera pass (the far
  copy now carries the facades' tint and window light, one class per shared facade).
- The beach club's white sails and flat roof slabs are very bright at noon.
- The Garden Lake has no reflection at night beyond the dark sky.
- The lead branch (`claude/compassionate-wright-cu2e1q`) could not be merged into this
  worktree from here; the numbers above are for this branch.

## Screenshots

Scratch paths from the tour (not committed): before `b-*.png`, after `c-*.png`, `a2-*.png`,
`d-*.png`, `e-*.png`, `f-*.png` in the session scratchpad `shots/` directory.

## Follow-up: night readability, shadows, ULTRA lines, see-through

Owner feedback after version 30, handled on the lighting branch:

| Request | Cause | Change |
| --- | --- | --- |
| Night too dark to see; remove the light circle round the player | Moonlight and sky fill were weak against the tone curve; a pool of light followed the player | `NIGHT_LOOK` (lighting3d.js) and the civic3d.js night keyframes give a readable blue-hour night (moon +0.75, sky fill +1.5, exposure +30%, lifted blue blacks, less contrast loss); the foot pool is gone, only a faint moonlit rim on the model's silhouette remains |
| Street and vehicle lighting should reach farther and look real | Lamp pools were 62 units with a hard fall-off; headlights were a flat additive glow on the ground | Lamp pools ~100 units with a long soft tail, lighting facades, tinted by district; head and tail lamps drawn into a per-frame HDR light map (DRIVE LIGHT MAP) that every lit material adds as light |
| Shadows lag behind the character on LOW / MEDIUM | The shadow map was refreshed every 4th (LOW), 3rd (MEDIUM) or 2nd (HIGH) frame while the shadow box and the casters moved every frame | Redrawn every frame whenever on; LOW defaults to no shadow map with contact blobs under cars and people; Settings · Graphics · Shadows (AUTO / OFF / LOW / HIGH) |
| Horizontal lines on ULTRA | Not reproduced under headless SwiftShader (day, dusk, night, zoom 0.55 and 1, helicopter, 2x pixel ratio). Two ULTRA-only defects found and fixed: the AO spiral degenerated to one line per pixel at 14 samples, and the composite dither's sin() hash loses precision at 2x pixel ratio | Golden-angle AO spiral; sin-free dither hash |
| Character see-through did nothing behind buildings | The cutaway only opened under a roof | Rays from the player to the camera find buildings and decks in the way (`findOccluders`); a player-sized dithered hole opens in that structure only |

Cost: with shadows on, the shadow pass (`stats().shadowCalls`, typically 250-650 draws in the
city) now runs every frame on MEDIUM and HIGH instead of every third or second; LOW skips it
entirely. The drive light map is two instanced draws into a 1024-texel target at night.

## Follow-up: the ULTRA band found, wet streets, phantom shadows, outline toggle

| Request | Cause | Change |
| --- | --- | --- |
| "Slight horizontal gradient below the main character" (ULTRA) | Reproduced headless at 1280 x 720 and 1920 x 1080 (pixel ratio 1) on HIGH and ULTRA; MEDIUM and LOW (no AO) were clean. The half-resolution AO pass read the full-resolution depth texture (nearest) at its own pixel centres, which fall exactly on the corner of four depth texels, and so did the one-texel neighbours it rebuilds the normal from. Which texel came back flipped with sub-ULP rounding of the interpolated UV: one way above the middle row of the frame (uv.y = 0.5, a float exponent step) and on one side of the full-screen quad's diagonal, the other way elsewhere. Where a pixel and its neighbour read the same texel the normal faced the camera, flat ground occluded itself, and the AO printed rows of faint stripes and a darker region with a hard horizontal edge through the middle of the frame, which is where the camera keeps the player. Which half is hit depends on the resolution and the GPU (below the centre at 720p, above it at 1080p here, below it in the owner's shot) | AO, its blur and the new wet reflections read depth at texel centres from `gl_FragCoord`. Flat road either side of the centre line, row-averaged luminance: 720p ULTRA 96.4 above / 91.9 below before, 96.4 / 96.4 after; 1080p ULTRA 88.2 / 97.3 before, 97.1 / 97.3 after (MEDIUM, no AO: 97.1 / 97.4). 2560 x 1440 showed no band on SwiftShader before or after |
| Wet streets should look noticeably wet, AAA | Rain only darkened the ground 30%, lowered its roughness and put noise puddles in the tarmac | WET ROADS (see SOURCE_GUIDE 6c): a shared wet pattern (dips, gutters, a per-spot drying order), soaked and saturated albedo, a glossy film, standing water in dips and gutters with three layers of rain rings, lamp / window / neon streaks down the wet road from the night light map, and on HIGH / ULTRA a half-resolution screen-space reflection pass (negative-alpha wet mask, jittered glossy rays, blur along the reflection). Drying is patchy from the edges in; puddles shrink to their middles. Tiers: LOW darkens, MEDIUM adds the film and streaks, HIGH / ULTRA puddles, ripples and reflections |
| "Random shadows ... elongated shadows on the street coming from nowhere" | Not shadows: 330 dark ellipses (25-95 units long, random angles, 12-24% black) painted on the roads of the ground sheet as "patches" (render3d.js). They stay put whatever the sun does (checked at 07:24 and 17:48: same place and angle, and `shadowProbe` finds nothing between them and the sun). No see-through or hidden caster was found (`shadowCasters(…, true)`: only the Old Quarter station's 0.55-opacity glass) | Removed; the ground shader's tar patches, cracks and grain carry the tarmac. New console methods `shadowProbe(x, y)` and `shadowCasters(limit, everywhere)` for the next report of this kind |
| Toggle for the night outline | - | Settings · Graphics · Player outline at night (on by default, saved in `dead-end-city-settings`, read every frame; `settings({ playerOutline })`) |

Cost of the wet look (HIGH, 1280 x 720, Old Quarter crossroads at 22:30): camera-pass draw calls 508 dry -> 513 in the rain (the reflection pass and its blur, the rain and splashes), shadow pass 572 -> 574, linked programs 59 -> 68 (rain, splashes, reflection, blur). Nothing runs on dry streets. Estimated GPU time on a mid-range card at 1080p HIGH: the reflection pass ~0.4-0.7 ms (1440 x 810 half-resolution pixels, 20 steps + 5 refinement depth reads, only on wet ground pixels), its blur ~0.1 ms, the ground's gutter and streak reads ~0.2 ms; ULTRA (28 steps, pixel ratio 2) about twice that. SwiftShader milliseconds are not meaningful for this.

Screenshots (session scratchpad `gfx/shots/`): `cmp-u1080.png` (the band before / after, contrast-stretched below), `e-aoview-enh.png` / `f-aoview-enh.png` (the AO buffer before / after), `cmp-phantom.png`, `cmp-night-tiers.png`, `cmp-day-tiers.png`, `cmp-final.png`, `cmp-outline.png`.

Known issues: the reflection pass sees only what is on screen (reflections fade out towards the top of the frame, and a lamp above the frame has no reflected head, only its streak); lamp pools on wet pavements under a lamp still bloom brightly at night; bridge decks keep their own wet shader and are not mirrored by the reflection pass.
