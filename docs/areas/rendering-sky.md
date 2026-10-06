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
- The environment's light was tuned against the old gradient: irradiance within ~5 % up and sideways by
  day, night and overcast (dusk roofs -7 %, walls facing the sun +12 %). Re-check after changing a share.
  The dome alone takes some light out of the zenith (`uDomeZenith`, DOME_ZENITH_*): a deep blue through
  the warm grade, darker at night; none at the horizon, where the haze meets it.
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
