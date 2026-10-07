# Rendering: effect particles (smoke, fire, sparks, flashes, glass, drops)

Every effect sprite the renderer throws goes through one pool: fx3d-particles.js (the store, the mesh and its
shader, the pass), fx3d-recipes.js (blasts, muzzle flashes, bullet strikes, flames, smoke) and fx3d-atlas.js (the
texture). Both views draw it from one instanced quad in one draw call; it used to be one `Three.Sprite` (one draw
call) per particle, flat-lit. Renderer only: nothing here changes the game. Separate systems: tyre smoke and spray
(tyresmoke3d.js, `tyreEmission`), the 4x4 mud (offroad3d-mud.js), blood decals (blood3d.js: every pool, spatter,
drop, track and wall splash in one instanced draw) and car blood, and debris chunks (damage3d-decals.js: real lit,
shadowed meshes; blasts throw them too). A fresh cut (gore.js `goreEvents`) adds bone chips (`fxBit`) and a dark
mist (`fxPuff`) to the pool (crowd3d-gore.js `goreEffects`).

## The pool (fx3d-particles.js)

- `fxs` is a struct of typed arrays (FX_CAPACITY 1024 slots): position, velocity, life, size and growth, colour
  and opacity, `heat`/`cool` (fire), `glow` (light added), `twinkle`, rotation and spin, atlas `frame`, the
  ground height under it (`floor`), `rise` (buoyancy), `drag` (towards the wind for `wind` > 0), `gravity` and
  `bounce`, `streak` (seconds of motion blur), `delay`, `fadeIn` and `thin` (opacity times (first size / size) ^ thin:
  a plume that spreads thins as it grows). Spawn with `fxAdd`, or the recipes'
  `fxPuff`, `fxBit`, `fxSpark`, `fxLegacy` (the old `{x, y, z, vx, ..., case, glow, smoke, glass}` record).
  Nothing allocates per particle or per frame; a dead slot is swap-removed; a full pool drops the new particle.
  Randomness is `fxRandom()`: effects never draw from the game's Math.random stream.
- `drawFxParticles` (render3d-frame.js, once a frame after the vehicles and the damage pass) steps the store, adds
  the game's own `particles` (blood mist and drops, the dust `particle()` throws) except a fire's flame particles
  (the renderer draws each fire from `fires`) and `standIn` ones (the 2D view's picture of a muzzle flash, a
  strike, a blast or a rocket trail, which the recipes draw here), culls what is behind the camera, sorts far to
  near (a Float64Array of keys, fixed views, no allocation) and uploads only the used part of four vec4 instance
  attributes (FX_DRAW_CAPACITY 1536).
- FX PASS (`renderFxPass`, from postfx3d.js `renderFrame` right after the scene): the pool is a scene of its
  own drawn into the scene's target with its depth, no clear (depth-tested as before), premultiplied blend (ONE,
  ONE_MINUS_SRC_ALPHA): smoke composites over smoke in depth order and `glow` (sparks, flashes) is light added
  with no coverage. Its program, buffers and atlas are warmed behind the title (registerPrewarmPass, one
  invisible quad).

## The look (the shader)

- LIT: a puff frame carries the normals of its billows (atlas RG), lit per pixel by the scene's own lights each
  frame (sun `sunDirection`, wrapped as light soaks into a translucent volume; the hemisphere sky and ground; the
  fill; each over pi, as three.js lights a Lambert surface); per corner (interpolated: smoke is soft, and a loop in
  every pixel of a big cloud was most of its cost) the sun scattered forward through thin smoke toward the sky's
  sun (`skySunDirection`) and the muzzle/blast and fire lights (FX_TIER_LIGHTS: LOW 1, MEDIUM 2, HIGH/ULTRA 4).
- FIRE: `heat` 0..1 cools as exp(-age / `cool`). A hot puff is a dense glowing gas: a black-body colour (hotter in
  the thick core, brightest where a billow faces the camera) in place of its lit soot, opacity 0.86, so stacked
  flame saturates to the fire's colour instead of adding up to white; it thins to the smoke's opacity and turns
  to soot as it cools. Peak ~4.4 scene-linear: it blooms (threshold ~3.3 by day).
- SOFT: into the ground under it over a quarter of its size (`floor`; every tier); in the chase view a particle the
  lens is inside, or nearly, fades out; on HIGH and ULTRA (a multisampled target, so the scene's depth texture is
  a resolved copy, not the attachment being drawn into) it also thins over a third of its size (up to 3 m) as it
  nears whatever stands behind it: walls, cars, people. LOW and MEDIUM draw into the depth texture itself, which
  the shader may not read (a feedback loop): ground fade only.
- STREAKS: `streak` stretches a spark, an ember or a flame along its velocity as the camera sees it.
- FOG: the chase haze (aerial-haze3d.js fog chunks) on the lit colour; glow fades by the same factor.

## The atlas (fx3d-atlas.js)

512 x 256, eight 128-pixel frames: four PUFFS (soft spheres in a cluster: A opacity, RG the front surface's normal,
B thickness), GLOW, FLASH (a muzzle flash star), GLASS (the broken-glass glints, as the sprite was) and DROP.
`fxBakeAtlas` is a generator: `fxAtlasStep` runs it for a few per cent of each frame's time (more behind the
title) and uploads the texture once, when it is done (~10 ms of work warm, several times that cold).

## Recipes (fx3d-recipes.js)

- BLAST (`explosion()`; power 1 a rocket, 0.65 a car's tank): a 0.1 s flash and star; a fireball of 22 puffs
  thrown out at 6-15 m/s that the air stops within a few metres, the furthest (its skin) cooling first; a column of
  20 dark puffs over the first second, rising for 6-10 s with the wind; 14 dust puffs along the ground; 28 sparks;
  10 road chunks (the debris pool); the muzzle light as the flash and fireball glow for ~0.8 s (`fxFlashLight`,
  reach 42 m). No flat ring on the street. A burst 5 m or more above the terrain (the side jobs' fireworks, a
  shell in the air) throws no dust or road, and its sparks fall to the ground below.
- MUZZLE (`fire()`): a star turned at random, a plume along the barrel, a hot core, a faint wisp, the case; a
  rocket's backblast.
- STRIKES (`impact()`): masonry throws dust and chips out of the hole along the wall's normal at its height
  (bulletHole() notes it, `fxNoteHole`); the ground a spurt of dirt; metal streaking sparks; glass a glitter;
  water a splash. Rockets in flight trail smoke (render3d-frame.js; the Apache's lay their own).
- FLAMES (`fxFlames`): short-lived flame puffs that rise, streak and cool into smoke, and embers: ground fires
  after a blast (`fxGroundFire` from `fires`, with their lights), a burning engine bay, a wreck (damage3d-bodies.js).
- WOOD SMOKE (chimney-smoke3d.js `fxWoodSmoke`, `CHIMNEY_SMOKE`): the mountain chimneys and the 4x4 club's
  chimney, grill and fire ring. Small blue-grey puffs (0.4 m at the pot, ~3.6 m at the top, 7.5 s) with `thin` 0.8,
  so the plume keeps one faint optical depth as it widens; they leave the pot at 1.25 m/s, settle to 0.5 m/s and
  take the wind (`drag` 0.45: the plume bends over), each emitter wandering sideways on two slow sines. The rate
  follows the plume's speed (puffs ~3.6 units apart, 1.6-6 a second), so a calm night does not stack them into a
  post. Fires burn by a fixed hash per chimney (30 % by day, 60 % at night, dimmer and darker then; the club's
  always); at most 3/5/7/8 plumes by tier, the nearest the view's centre. A plume that starts (comes into reach,
  a teleport) is seeded whole (`chimneyPlumeSeed`: puffs at their ages, moved by fxStep's motion in closed form),
  and the emitters keep the pool's clock (at most 0.04 s a frame). Console `chimneySmoke()`. (Before:
  `engineSmoke` without an opacity or a floor wrote NaN into the slot, drawn as hard flat cards.)
- The blast, fire and smoke counts follow the tier (FX_TIER_SHARE: LOW 0.55, MEDIUM 0.8).

## Numbers (headless SwiftShader, HIGH, render scale 0.5, shadows off, a power-1 blast 30 m ahead)

Before -> after: the chase view's camera pass 3 s after the blast drew 83 sprite calls (977 in all) -> 9 sprites
(lamp halos and the like) plus the pool's one call (916 in all); the blast linked 2 programs in play (the shock
ring's MeshBasic variants) -> 0; the blast adds ~94 slots (22 fireball, 20 column on delays, 14 dust, 28 sparks,
the flash, the road chunks are debris). The atlas bake was ~80-110 ms of CPU in all on that machine, in slices.
Two rounds then the blast, 1 s from a settled `renderHiccups(true)`: 2 programs, 16 textures, 56 geometries in 7
frames (worst 72 ms) -> 0 programs, 10 textures, 47 geometries in 5 frames (worst 25 ms); what is left is wrecks
and decals, not the pool.

## Console and checks

`DeadEndCity.effectParticles()`: live, waiting, drawn (and of them the game's), capacity, peak, emitted, dropped,
tier share, draw calls, the atlas (baked, CPU ms) and the last blast's age. tools/tests/render-effects.mjs (on a
rendered page: a blast fills the pool, one draw call, nothing dropped).
