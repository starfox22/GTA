# Rendering: first-use hitches and the prewarm

A hiccup is a frame that does work the steady state does not: a shader program linked, a texture
or buffer uploaded, a model built the first time it is seen, a long collection. The renderer's
answer is to do that work behind the title, a few milliseconds at a time (render3d-resources.js
`prewarmShaders`), and to log what is left (render3d-hiccups.js).

## Finding hiccups

- `DeadEndCity.renderHiccups(reset)`: programs, textures and geometries created in play since the
  log began, the 8 slowest frames (renderer CPU without the GPU submit, split by lap) and the last
  40 first-use events. A program is named `Type:uniforms @owner ~variant[...]`: the owner is the
  nearest named object using it, and `~variant` lists the cache-key fields that differ from an
  older program of the same shader (light counts, shadows, `mapUv`, instancing, side...), which is
  how a program "compiled twice" shows. `lights` is what three.js keys programs by (see below).
  `gpu` and `cells` say how much geometry the scene could draw against what is uploaded.
- `node tools/dev.mjs profile 30 [--allocations]` is a CPU (or allocation) profile of the live page.
- Software GL has no `KHR_parallel_shader_compile`, so the prewarm does not run there: start or
  reload the dev page with `--prewarm` (`?prewarm`) to run it compile-only. Programs and buffers
  created are what transfers to a real GPU; link and GPU times under SwiftShader do not.

## What is warmed (in order)

1. The scene's objects, 40 top-level objects per slice, **never its lights**: `renderer.compile`
   counts the lights of the object it is given as well as the scene's, so a slice holding a light
   compiled its programs for one light too many and the real ones compiled again on first sight
   (the sky dome, vehicle halos and the cloud passes at the first flight).
2. Off-screen passes with a scene, camera and target of their own: register one with
   `registerPrewarmPass(scene, camera, target)` (render3d.js) next to its definition: the drive
   map, the beam shadows, the cloud march and veil, sea life and wakes are. The target is bound
   while it compiles because its colour space is part of the program. The wet-reflection passes
   (HIGH and ULTRA) are `postWarmPasses()`. Every `Points` material is compiled with
   `sizeAttenuation` both ways (the flight camera flips it).
3. While the title is up: one stand-in vehicle per model (`prewarmModelList`, render3d-prewarm-
   models.js: every type in `VEHICLE_DEFINITIONS`, each police look, helicopter look and airframe)
   is built, compiled and taken out of the scene again, materials not disposed so the programs stay
   cached and the kits stay in their caches. It also builds each type's body-impostor pool (flight-
   view3d.js) and warms the burnt-car paint (soot map, no clear coat). A new vehicle type is picked
   up from the table; a new model builder must work on a bare `{id, type, color, x, y, a}` record.
4. While the title is up: the far copy of the city (42 MB in ~500 meshes) and sample shadow casters
   are drawn once into a 1 x 1 target (`uploadMeshes`) so their buffers and shadow-depth programs
   (side, alpha cut-out, instancing) are on the GPU before the first flight.

Steps 3 and 4 stop when the game starts (they cost a build each); the rest continues at 2.5 ms a step.

## Rules for new code

- Light and shadow counts are part of every lit program's key: keep every light in the scene for
  good (intensity 0 when idle) and never toggle `castShadow`, `visible` or layers on a light in
  play. A change at a tier switch is fine (shadows on or off relinks the lit programs once).
- A material whose `map`, `clearcoat`, `side`, `sizeAttenuation` or defines change at run time makes
  a new program the first time it flips: compile the flipped state in the prewarm (the burnt car
  is the example) or accept the hitch where it happens.
- Never create a mesh or material that first draws mid-frame without registering its pass or
  adding it to the scene before `prewarmShaders` runs.
- Shadow depth programs are made when a caster kind first enters the shadow map: HIGH and ULTRA
  show them as `MeshDepth` lines in the log.

## Cheaper lit pixels and passes

- DORMANT LIGHTS (lighting3d-cutaway.js): `RE_Direct` for point and spot lights runs only where
  the light's `visible` flag is set (colour not zero after falloff), so the muzzle, fire and
  searchlight lights cost nothing at intensity 0 or out of reach; same image, nine BRDFs a pixel
  down to the two sun and fill lights plus whichever light is near.
- The helicopter's spot light has a shadow map from MEDIUM up and three.js redraws it every frame
  whatever the intensity: `updateHelicopterSearchlight` stops its updates while no helicopter is up.
- Empty body-impostor pools are hidden instead of drawn with no instances.

## Numbers

Headless SwiftShader, prewarm on (`--prewarm`), a fresh page per tier and build, scripted scenarios
after settling (`renderHiccups`); before = the lead branch at 7045d9b with its old prewarm run the
same way. First-use programs created in play (before -> after):

| scenario | LOW | MEDIUM | HIGH | ULTRA |
| --- | --- | --- | --- | --- |
| night | 2 -> 0 | 2 -> 0 | 2 -> 0 | |
| rain | 0 -> 0 | 1 -> 0 | 4 -> 0 | 7 -> 0 |
| explosion | 1 -> 0 | 1 -> 0 | 2 -> 0 | |
| helicopter flight | 14 -> 0 | 18 -> 1 | 16 -> 2 | 18 -> 1 |
| plane, parachute | 6 -> 0 | | 4 -> 0 | |
| chase, drive, tour | 0 -> 0 | | 1 -> 0 | |
| **total** | **23 -> 0** | **22 -> 1** | **29 -> 2** | **25 -> 1** |

At the first flight 72-79 textures and 408-486 geometries upload in one frame before, 38-45 and
296-352 after (the far copy is on the GPU behind the title). The slowest frames' renderer CPU
(without the GPU submit, noisy on a shared machine): chase 33 -> 16 ms, drive 43 -> 17, plane
361 -> 19, tour 98 -> 24 at LOW; rain 33 -> 13, drive 53 -> 24, plane 1246 -> 28, tour 137 -> 17 at HIGH.

Steady state, a Midtown view: at HIGH the shadow pass drew 262 calls / 2.12 M triangles a frame and
draws 175 / 1.58 M (the idle helicopter spot light was drawing all the city's instanced props into
its own map), and the GPU process spends 6% (day) to 8% (night) less CPU a frame. At LOW nothing
changes there (3992 -> 4003 ms a frame: under software GL the cost is the triangles, so the
dormant-light saving does not show). The JS heap after the prewarm is 10 MB larger (the stand-in
models' kits). Hiding every instanced prop pool saves 13% of the GPU process's CPU at LOW, an upper
bound for tiling them (it would trade vertex work for draw calls; not done).

Not measurable here: link times (software GL), real GPU pixel cost (the dormant lights), the
parallel-compile path itself. Known gaps: a tier change that turns shadows on or off relinks every
lit program (~45 on the first change); a first visit to a map cell uploads its 0.2-0.6 MB (batch
cells) to 13 MB (the largest static cell); AUTO's resolution steps reallocate the post targets.
