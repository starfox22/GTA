# Rendering: image pipeline and light

The HDR pipeline and film grade, sun and time of day, night light, searchlights and the
cutaway, inside `createCityRenderer()` like the rest of rendering.md (cameras, draw calls,
buildings, ground). Vehicle lights: rendering-vehicle-lights.md.

## Image pipeline (postfx3d.js, lighting3d.js)

- The scene renders into a half-float HDR target (MSAA on HIGH/ULTRA), then SAO, wet
  reflections, bloom, one composite (exposure, ACES, grade + vibrance, vignette, dither) and
  FXAA on **every** tier (MSAA resolves light before the tone curve: bright edges, leaf
  cut-outs and glints stayed stepped and flickering on HIGH/ULTRA without it). The half-res AO
  is upsampled depth-aware (`compositeAo`), not bilinearly (shade fringes at silhouettes).
  `renderFrame()` replaces `renderer.render()`.
- CAMERA MOTION BLUR (postfx3d-motion.js, before bloom and composite; Settings · Graphics · Motion
  blur): the chase view only, HIGH/ULTRA, never with Motion comfort or in the air
  (`chaseMotionBlurAllowed()` is the game's half). Depth reprojection with last frame's camera, a
  fixed 1/90 s shutter, capped at 3.5% of the screen; anything within 12 m (the player, their car)
  stays sharp and is never smeared over what is behind it; a cut (teleport, look behind, view switch)
  skips a frame. Report: `chaseCamera().view.motionBlur`.
- Custom `ShaderMaterial`s that compute final screen colours (the water) end with
  `#include <city_hdr_output>` (and include `<city_hdr_pars>`) to invert the tone curve;
  unlit `MeshBasicMaterial`s with `toneMapped: false` (signs) get this automatically.
- Half-resolution passes that read full-resolution depth fetch at texel centres from
  `gl_FragCoord` (a nearest fetch at the corner of four texels flipped with rounding and
  printed horizontal stripes through the frame).
- Shaders needing the scene buffer's pixel size use `sceneBufferSize()`, not the canvas
  (adaptive quality renders at a share of the canvas, `setRenderScale`).
- Bloom sanitises NaN and half-float overflow before the mip chain (they became black or
  white squares) and weights taps by 1 / (1 + brightness).
- FILM GRADE (composite): contrast and lift work on a gamma-2.2 scale. Contrast is an
  S-curve about mid grey that never clips (`postLook.contrast` = the slope at mid grey);
  the lift tints the darks, the gain only the lights (weighted by display luminance);
  vibrance judges saturation (chroma over value). The old linear `(c - 0.18) * k + 0.18`
  cut the bottom ~20% of the display range to black and the lift painted it flat navy
  (shade and night streets had no texture): never clip in the grade.

## Light

- Sun and sky (lighting3d.js): `sunDirection` follows the clock; the shadow box is fitted to
  the view and texel-snapped (`placeSun`); the sky is PMREM-filtered into
  `scene.environment` (the sky, the chase view's haze and the sun glare: rendering-sky.md).
  Shadows are redrawn every frame when on (kept maps trailed moving objects); with shadows
  off, contact blobs (CONTACT SHADOWS).
- Time of day: `daylight()` sets the sun's strength; `skyDarkness(light)`
  (lighting3d-look.js: 0 until the last half hour of sun) sets the sky keys, the fill's and
  the sun's colour mix and the NIGHT_LOOK (moon and sky fill, exposure, blue grade). The
  lights (`nightAmount`, the lamp map's power, glows, windows) come on earlier, from
  ~1.5 h before sunset. Laying the night look over the low sun turned the golden hour
  magenta; its keys are `SUN_DUSK`, `HEMI_*_DUSK` (civic3d.js) and `SKY_KEYS.dusk` (the
  environment's sky: a violet zenith over an orange horizon filters to mauve).
- Night light: lamp, window and neon pools painted once into a city-wide light map;
  `cityMaterialPatch` (MeshStandardMaterial's default `onBeforeCompile`) adds it to lit
  surfaces. **A material with its own `onBeforeCompile` must call
  `cityMaterialPatch(shader)` first.** A knocked-down lamp removes its pool
  (`lampLightSwitch`). Street lamp pools reach `STREET_LAMP_RADIUS` (18 m: the core of the
  old 12 m pool, a long tail across the road); lanterns `LAMP_POOL_RADIUS`. The island map
  (`ISLE_LAMP_BOUNDS`, from the city frame's east edge) lights Monarch Isle and North
  Point Key (its lanterns, gate, fountain and lobby spill).
  CITY WALL LIGHT (`cityWallLight`, lighting3d-sky.js): a wall also takes the map 3.5, 9 and
  17.5 m out along its normal (weights 0.42, 0.22, 0.12, fading by ~12 m up), as the brighter of
  the two, so lamps across the street light the lower floors and side-street facades are not
  black at eye level; a wall standing in a pool is lit as before.
- Glow field at street level (signage3d.js): a glow is never wider than `GLOW_STREET_ANGLE`
  (0.07 rad) of a perspective view (a lamp's 3.5 m halo filled the frame up close); the street
  view's orthographic camera is untouched (the projection's w column tells them apart).
- Vehicle lights (CAR LAMPS, the drive light map, beam shadows, lamps on slopes, the
  terrain horizon): rendering-vehicle-lights.md.
- Sign emissive is multiplied by `cityPower()` so the blackout job darkens districts.
- `NIGHT_LOOK`: a readable blue-hour night; no light follows the player (only an optional
  rim, Settings · Graphics · Player outline).
- Glass: `useCityGlass(material)` for facade glass reflections.

## Searchlights and cutaway

- Searchlight shafts (searchlight3d.js) march the view ray through a cone analytically.
- The police helicopter's light is a real SpotLight (always in the scene, intensity 0 when
  idle, so no program switches) with a cookie; its brightness is set as exposed light so
  pale paving does not clip. The shaft is a HIGH/ULTRA garnish cleared round the target.
  Under overhead cover the light lands on the roof (`searchlightLanding`, via
  `overheadCoverHeight` / `overheadCover`), with a shadow-only stand-in box on the roof. The
  beam starts at `helicopterSearchlightMount(h, out)`. Console `searchlight()`.
- Cutaway (`updateCutaway`): a player-sized dithered hole through the structure between
  camera and player, or through a roof directly over them (`airCoverVolumes()`, buildings,
  roofs registered with `registerCutawayRoof`). Vehicles, people and props are never cut.
  Settings switch: `city3D.setCharacterCutaway(on)`, saved as `dead-end-city-cutaway`.
- Foliage cutaway (same switch): every tree, palm, shrub and grass clump shares `treeMaterial`, whose fragment
  shader drops pixels (4x4 screen door, `FOLIAGE_HOLE_CUT` in vegetation3d-material.js) inside the subject's
  outline on screen plus a fade, nearer the camera than its middle, above 1.5 m over its base (grass and trunk
  feet stay). The plan (who, how big) is game logic, `foliageCutawayPlan()` (foliage-cutaway.js); the renderer
  only sets three uniforms a frame and eases them (`updateFoliageCutaway`, vegetation3d-cutaway.js). No define,
  no program variant, no per-tree JS: draw calls and programs are unchanged and the prewarm covers it. The shadow
  pass (`treeDepthMaterial`) never runs it. `foliageHoleCut()` is the shader's test in JS: change both together.
  Console `foliageCutaway()` (the line of sight, and with a renderer the crowns it crosses and what is left).
