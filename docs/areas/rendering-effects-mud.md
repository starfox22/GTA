# Rendering: the 4x4 trail mud (thrown mud, spray, mist, ruts, splats, mud on bodies)

What a tyre throws on the Ridgeline trails and what it leaves (offroad3d-mud.js TRAIL MUD; mud on bodies in
offroad3d-models.js). Renderer only: `tyreEmission(c)` (tyre-effects.js) stays the one rule for what the tyres
throw (mud, dust, the ford's water); this file only draws it. Before: a 20-face flat-shaded ball per clod (two a
throw), untextured soft discs for mist and dust, decals multiplied from canvas blobs and a chevron strip, value
noise on the bodies.

## The sheet (assets/trail-mud.webp, tools/trail_mud.py)

1024 x 1024 RGB, from ready-made CC0 downloads (docs/THIRD_PARTY_CREDITS.txt TRAIL MUD; preview sheet in
docs/audit/trail-mud/): Poly Haven's Brown Mud 03 colour (top left) and its OpenGL normal X/Y with roughness (top
right), and eight 256-pixel cells of Kenney's Particle Pack below (`MUD_SPRITE_CELLS`: three dirt clusters, a
splash, mist, a soft drop, a burst, a cloud; R the coverage, G/B a domed normal from it). `trailMud`
(offroad3d-models.js) cuts it into three textures (colour sRGB tiling, detail linear tiling, sprites linear),
uploads them at build (`initTexture`, then `bakedCanvases`) and keeps the colour map's linear `mean`: shaders use
colour / mean as a detail ratio, so a build without the sheet (1-pixel neutral stand-ins, `textures: false`) keeps
the plain tints. Re-run the packer with `python3 -I tools/trail_mud.py <downloads> assets/trail-mud.webp`; cell
order is `CELLS` there and `MUD_SPRITE_CELLS` in the renderer: keep them in step.

## The layers (offroad3d-mud.js)

- CLODS: one InstancedMesh (cap `MUD_TIER.clumps`, at most 640), a dented, welded, smooth-shaded ball (icosahedron
  detail `MUD_TIER.detail`: 80 faces on LOW and MEDIUM, 320 above), the mud photo triplanar in its own space (`iMud.y` the seed shifts it), a derivative bump from the
  photo, roughness 0.9 dry to 0.2 wet (`iMud.x`); each stretched along its velocity at speed and tumbling about it,
  its colour jittered by its seed. A landing clod lays a splat (a dirt cell or the splash).
- SPRAY: `mudSpray`, one instanced quad program (360): sprite clusters of droplets thrown with the clods, lit through
  the cell's normal by the effect pool's light (`mudLight`, copied from `fxUniforms` a frame late), a wet sun
  highlight and sky sheen, streaked along the motion across the view (the quad turns to the motion as it
  stretches). A ford's water is the same sprites with `water` 1 (pale, glossier, thinner).
- DROPS: the effect pool's `fxBit` drops (`FX_DROP`, `streak` 0.035, no bounce), `MUD_TIER.drops` a throw.
- MIST and DUST: the effect pool's lit `fxPuff`s (soft into the ground, the chase haze), at most `MUD_TIER.puffs`
  alive (`mudPuffEnds`, a ring of end times); mist lingers `MUD_TIER.linger` times longer in the chase view.
- RUTS and SPLATS: `decalPool` (ruts 1800, splats 700; one program for both: `iLife.w` the cell, -1 a rut), laid on
  the ground's slope. A rut is a basin across with raised lips and chevron lugs every ~0.4 m (`vLength` keeps the
  pitch whatever the segment's length), edges ragged by the photo, ends feathered; a splat is its cell's coverage and
  domes. Both take the mud photo's normal map in world space (~2.75 m a repeat) and are lit against the bare ground
  (sun and sky luminance), drawn as a 2x MODULATE (`DstColor`/`SrcColor`: 0.5 leaves the ground as it is), so the
  ground's own light and shadow stay under the mud; a wet decal adds the sun's highlight and the sky's sheen as a
  ratio of the ground's light, pooled in a rut's basin. GOTCHA: overlapping decals multiply, so a decal never
  brightens past 1.3x (its diffuse part never past 0.9x): wet splats piled behind a wheel otherwise burn white.
- Mud on bodies (`vehicleMudPatch`): the photo triplanar in the body's own space (~2.8 m a repeat, its relief fading once minified) for the colour
  and the relief, the ragged line from the wheels up plus streaks (noise stretched up the body) and flecks above it,
  a derivative bump (`mudPerturb`, three.js perturbNormalArb) under a uniform `mudAmount` branch, roughness from
  the relief when wet. The line's rag and the flecks come from smooth noise (the photo only a quarter of the rag:
  thresholding the photo itself speckles a roof like salt and pepper). Same contract (`mudUniforms`, `applyVehicleMud`).
- `billboardPool` (the old flat mist program) stays in this file for tyresmoke3d.js only.

## Budgets and rules

- `MUD_TIER` (per graphics tier): LOW 200 clods in flight, 1 clod and 1 drop a throw, 35 % spray, 24 puffs, the
  80-face clod (LOW throws less than before: one clod a throw where there were two); MEDIUM 360 / 1 / 2 / 60 % / 48,
  80 faces; HIGH and ULTRA 640 / 2 / 3-4 / all / 96-128, 320 faces.
- Chase view: a throw that `chaseSpriteHidden` (chase-view3d-props.js) leaves out is not spawned at all.
- Randomness is `mudRandom()` (its own xorshift); never Math.random, never the effect pool's `fxRandom` stream.
- The programs (clods, spray, decals) are in the scene from the start and the textures are uploaded at build, so the
  prewarm covers them; nothing is created in play.

## Console and checks

`offroad().effects` (clods, spray, splats, ruts, drops and puffs thrown, the tier's caps, `textures`);
`trailMud(seconds, keys)` stages a scene without drawing (the game and the mud in 1/30 s steps, the effect pool
too). tools/tests/trail-mud.mjs (rendered: HIGH and LOW caps, everything thrown, the sheet loaded).
