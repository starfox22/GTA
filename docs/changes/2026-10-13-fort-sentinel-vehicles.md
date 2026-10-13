# Fort Sentinel's vehicles: a whole utility truck, the tank back to its own model

- The SENTINEL M4 UTILITY is whole again: its hood, grille, wings and canvas top were lost or turned inside out by the
  conversion (holes up close in the chase view); it is now converted without vertex clustering.
- The SENTINEL M120 tank is the game's own model again: the downloaded tank could only be brought to a game budget by
  clustering, which broke it apart. Its credit is withdrawn.
- Chase view at Fort Sentinel: far away the M4 utility draws a coarse body (MILITARY LOD, military-assets3d.js), and the
  tank costs a few thousand triangles instead of about 21 thousand.
- No shader compile when the first boat, dolphin or shark fin of a quiet spell leaves a wake: the wake programs are
  prewarmed and kept (WAKE KEEPER, wakes3d.js).
- Every other downloaded vehicle's texture gains texels (the atlas no longer holds the tank's textures).
- Converter: a `far` hint for special models writes a coarser `bodyFar` part.
- tools/hitches.mjs: opt-in stages `fort` and `fortChase` (the base at war, street then chase view).
