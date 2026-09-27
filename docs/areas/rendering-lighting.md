# Rendering: image pipeline and light

The HDR pipeline, sun, night and vehicle light, searchlights and the cutaway, inside
`createCityRenderer()` like the rest of rendering.md (cameras, draw calls, buildings, ground).

## Image pipeline (postfx3d.js, lighting3d.js)

- The scene renders into a half-float HDR target (MSAA on HIGH/ULTRA), then SAO, wet
  reflections, bloom, one composite (exposure, ACES, grade + vibrance, vignette, dither) and
  FXAA on **every** tier (MSAA resolves light before the tone curve: bright edges, leaf
  cut-outs and glints stayed stepped and flickering on HIGH/ULTRA without it). The half-res AO
  is upsampled depth-aware (`compositeAo`), not bilinearly (shade fringes at silhouettes).
  `renderFrame()` replaces `renderer.render()`.
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

## Light

- Sun and sky (lighting3d.js): `sunDirection` follows the clock; the shadow box is fitted to
  the view and texel-snapped (`placeSun`); the sky is PMREM-filtered into
  `scene.environment`. Shadows are redrawn every frame when on (kept maps trailed moving
  objects); with shadows off, contact blobs (CONTACT SHADOWS).
- Night light: lamp, window and neon pools painted once into a city-wide light map;
  `cityMaterialPatch` (MeshStandardMaterial's default `onBeforeCompile`) adds it to lit
  surfaces. **A material with its own `onBeforeCompile` must call
  `cityMaterialPatch(shader)` first.** A knocked-down lamp removes its pool
  (`lampLightSwitch`). Monarch Isle has its own map.
- Vehicle lights (lighting3d-vehicle-lights.js): the player's car, then the cars nearest the
  view (`carLamps` 1/4/8/12 by tier) are CAR LAMPS, real lights in `CITY_LIGHT_APPLY` from
  fixed-size uniform arrays (`cityCarLampA/B` + count: no recompiles), with the LOW BEAM pattern
  (`cityLowBeam` GLSL = `lowBeamIntensity` JS, keep in step) through `RE_Direct` with the
  **unbumped** normal (grazing light on the ground bump turned to salt and pepper) and a soft
  cap. Other cars: the same beam in the DRIVE LIGHT MAP, with tail/brake/reversing washes. The
  player's beams are shadowed by people and cars (BEAM SHADOWS mask). Halos glow HDR-bright
  facing the camera (`queueVehicleHalo(sprite, opacity, facing, gain, tint, size)`). Console
  `headlights()`, A/B `lookSwitches()`.
- Vehicle lights on slopes (terrain-headlights.js, game side so `headlightAim()` works on
  the no-render test page): every beam runs in the car's **body frame**
  (`headlightFrame(c, out, mount, level)`: yaw, then `slopePitch`/`slopeRoll`, not the
  suspension's `loadPitch`, which would pump the beam's far end), from the lamps' real
  height (club trucks: their model's head lamps). Slot uniforms: A = lamp point + strength,
  B = heading, half span, lamp height (layout kept: the rain in weather3d.js reads A/B
  level), **C = sin pitch, sin roll, cos roll, mode** (bit 1 terrain horizon, bit 2 light
  bar). GLSL `cityLampFrame` rebuilds the axes; a level car gives exactly the old numbers.
  Drive-map quads, tail/brake/reversing washes and haze sheets are laid with
  `setBodyMatrix` in the same frame, so the map's road level follows the grade.
- TERRAIN HORIZON: a slot with terrain in reach (`terrainWithin`) samples the ground on 24
  rays × 48 points (`headlightHorizon`, recomputed when its car moves, ≤ 6 kept-slot
  refreshes a frame) and lit materials hide its light below that line (`cityHorizonShade`;
  `headlightHorizonLit` is the JS mirror: keep in step). The tables live in a strip under
  the BEAM SHADOWS mask of the **same** texture (512 × 410, half float), so lit materials
  take no extra sampler (the city ground already uses 14 of the 16 guaranteed). The mask's
  clear is scissored; `cityBeamShade` scales its v by 384/410. No float target
  (`!hdrCapable`): no horizon.
- On the range (horizon slots only, the city look is untouched) the soft cap falls off
  with distance: a far hillside square to the beam otherwise filled the cap like a wall at
  the bumper and read as a flat slab. Haze there is the lit air, not the road pattern: a
  fan from the lamps fading with distance times the air under the sheet down to the
  ground or the crest's shadow line (the low beam's vertical profile, integrated), so it
  fades where the ground rises into it (no clipping seam) and lifts off over a crest;
  `MOUNTAIN_AIR` shows it on a clear night. LIGHT BAR: the player's club truck on the
  range takes a second slot (MEDIUM+) with `cityFloodBeam`. Reflector posts (`CITY_RETRO`
  define) flare in CAR LAMPS. A/B `lookSwitches({ terrainBeams, lightBar })`.
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
  roofs registered with `registerCutawayRoof`). Vehicles, people, trees and props are never
  cut. Settings switch: `city3D.setCharacterCutaway(on)`, saved as `dead-end-city-cutaway`.
