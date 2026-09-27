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
