# Rendering: sky, haze and sun glare

What the chase view sees above and beyond the city: the sky dome and the environment map drawn from one sky, the
aerial perspective that melts the far city into it, and the sun's glare in the lens. The image pipeline and the
rest of the light: rendering-lighting.md; the clouds (from below too): rendering-clouds.md.

## Sky, haze and sun glare (lighting3d-sky-dome.js, aerial-haze3d.js, postfx3d-sun.js)

- One sky: `cityHazeColor(dir)` (`CITY_HAZE_GLSL`) is the dome's body, the environment map's upper half
  and the chase haze's colour, so far buildings melt into the sky. Its six `cityHaze*` uniforms are shared
  Float32Arrays put into `UniformsLib.fog` and every fog-enabled `ShaderLib` entry (three.js clones uniforms
  per material but keeps typed arrays by reference); `updateHaze` (lighting3d-look.js) writes them once a
  frame from SKY_KEYS. A custom fog shader whose uniforms lack them reads zeros: the old fog.
- The sky's sun (`skySunDirection`, lighting3d-sky.js) has the light's bearing but really sets; the light
  stays above ~15 degrees for shadows. Disc, glow, haze, glare, the chase view's water glitter and the
  clouds from below (`skyLightDirection`: that sun handing over to the moon) use it.
- SUN PATH (sun-path.js, game-side math; lighting3d-sky.js `updateSunPath` only copies it): `sunPathAt(minutes)`
  gives the shadow light, the sky's sun and the sky light. The light hands over to the moon as a slerp over
  `SUN_HANDOVER` (20 game min before sunset to 70 after, mirrored at dawn) while its strength dips (`shade`, by
  `SUN_HANDOVER_DIM`; `updateLighting` scales `sun.intensity`, the sky fill takes 30 % of the loss): the old
  handover swung the shadows ~100 degrees in 16 game minutes at dawn. Keep `sunReport().dayMaxDegPerMin` under
  2.5 and `minElevationDeg` >= 15 (tools/tests/sun-gradual.mjs).
- The renderer draws the light clock, never `worldMinutes` straight: `litMinutes()` / `litDaylight()` (every
  `*3d.js` look that followed `daylight()`). `stepSunClock(dt)` (game-loop.js runFrame, behind menus too) takes a
  clock change beyond a minute a second as a skip (sleep, meals, god panel, `setClock(h, true)`, missions, ride skips,
  console `simulate`) and eases it in over 2-6 s (Hermite, carrying its speed into a new skip); a load or new game
  calls `snapSunClock()`, as do console `setClock(h)` and `matchDay` (shots and tours see the hour at once).
  Gameplay keeps `daylight()` on the world clock. The shadow map is redrawn every frame.
- The environment's light was tuned against the old gradient: irradiance within ~5 % up and sideways by
  day, night and overcast (dusk roofs -7 %, walls facing the sun +12 %). Re-check after changing a share.
  The dome alone takes some light out of the zenith (`uDomeZenith`, DOME_ZENITH_*): a deep blue through
  the warm grade, darker at night; none at the horizon, where the haze meets it. At night the chase
  view swaps in `SKY_KEYS.chaseNight` (a deeper navy; CHASE NIGHT in rendering-lighting.md): the one
  sky still, so the environment rebuilds once on a switch of view after dark (`refreshEnvironment`).
- The dome draws at renderOrder 50, after the opaque city, depth-tested at the far plane: only visible
  sky is shaded. An opaque-queue object that writes no depth and must show against the sky needs a
  higher renderOrder (the objective arrow is 99).
- Chase haze (`cityHazeSun.w` 1 only while the chase view draws; the street view keeps the old curve and
  `fogColor` exactly): thinner with height (scale height 150 m above sea level), the sky's colour towards
  each pixel, closed over the last fifth before the far clip. Display-referred shaders (the water) are
  hazed again after `city_hdr_output` undoes their curve (`fogBase`), so the sea meets the sky.
- Night: steady stars, the moon with maria and halo, the city's sodium glow low over the horizon
  (`uCityGlow`, dome only; a luminance-neutral share in the haze).
- Sun glare (chase view, the sky's sun in front and up): a 1 x 1 visibility pass (depth and brightness over
  the disc, eased), shafts on HIGH/ULTRA (a quarter-size mask of the bright sky round the sun smeared towards
  it twice; geometry blocks them), glare on MEDIUM up and the flare's ghosts on HIGH/ULTRA in the composite.
  Warmed through `postWarmPasses`. Console: `cloudLayer().view.sky`.

## Numbers (headless SwiftShader, HIGH, 1280 x 720, one page, base build then this one)

- Chase view at noon (fair, looking over the city): view calls 2043 -> 2035, shadow calls 752 -> 755 (scene noise);
  the new work is off the scene pass: the march from below (half size), the cloud shadows (quarter size) and, with
  the sun in frame, the visibility (1 x 1), the shafts' mask and two smears (quarter size).
- First-use programs in the chase view (noon, then golden hour into the sun) after a `--prewarm` boot at HIGH: 1,
  a shadow-depth variant that was there before; every new program (dome, march, shadow pass, sun passes) is warmed.
- SwiftShader frame times swing with the machine's load (15.5 -> 9.5 s a frame at noon, 18.3 -> 14.4 s at dusk):
  judge the real cost on a GPU.
