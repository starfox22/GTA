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

PERF_TABLE

### Boot

BOOT_TABLE

## Known issues

- Vehicles are now the largest share of street-level draws (each car model is a dozen or
  more meshes; ~120 draws in a busy Midtown view). Instanced body shells take over below
  zoom 0.62; merging each car's static parts into one mesh per material would roughly
  halve the rest. Left alone here (vehicle damage re-poses the panels individually).
- Match-day players are still ~22 draws each in the camera pass (person models belong to
  the animation work going on in parallel; only their shadows were trimmed).
- `paintPromenades` (streets.js) is ~2.6 s of the headless boot: a coastline clip plus a
  separate stroke per hatch tick on the 29 MP sheet. Batching the ticks into one path per
  segment would halve it; streets.js was left to the streets review.
- The first frame still links every visible program at once (18 s of the headless boot on
  SwiftShader, typically well under a second on a real GPU).
- The beach club's white sails and flat roof slabs are very bright at noon.
- The Garden Lake has no reflection at night beyond the dark sky.
