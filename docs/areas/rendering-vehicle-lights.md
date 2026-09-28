# Rendering: vehicle lights

Head, tail and brake light in `createCityRenderer()` (lighting3d-vehicle-lights.js,
lighting3d-vehicle-shadows.js) and the game-side beam frame (terrain-headlights.js). The
rest of the light and the image pipeline: rendering-lighting.md.

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
  B = heading, half span, lamp height, **C = sin pitch, sin roll, cos roll, mode** (bit 1
  terrain horizon, bit 2 light bar). GLSL `cityLampFrame` rebuilds the axes; a level car
  gives exactly the old numbers. Every reader of the slots takes the frame and the mode:
  lit materials, the beam haze and the rain (`rainCarLight` in weather3d.js: body frame,
  flood for a light bar, `cityHorizonShade` for horizon slots, its vertex shaders sample
  `cityBeamShadow` too).
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
