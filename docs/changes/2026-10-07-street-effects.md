# Explosions, fire, smoke and gunfire that hold up at street level
- Explosions: a white-hot flash, then a rolling fireball that chars from the outside in, a column of dark smoke that
  climbs and leans with the wind for up to ten seconds, dust rolled out along the street, sparks and embers that arc,
  streak and bounce, and chunks of road; the flash lights the street and dies away. The flat ring on the ground is gone.
- Fire burns: burning cars, wrecks and the fuel a blast leaves are tongues of flame that rise and cool into smoke, with
  embers drifting off; a fire lights its own smoke at night.
- Smoke and dust are lit by the sun, the sky and nearby fires (billowed puffs, bright on the sunny side and shaded
  underneath, glowing at the edges against the sun), fade into the street instead of cutting it with a hard line, and
  on HIGH and ULTRA thin out softly against walls, cars and people.
- Gunfire: a star-shaped muzzle flash with a plume along the barrel and a wisp of smoke; a round into a wall spits
  dust and chips out of the hole, metal throws streaking sparks, the ground kicks up dirt. The player's rockets trail
  smoke.
- Internals: every effect sprite is one sorted, lit, instanced pool drawn in one call, in a pass after the scene
  (fx3d-particles.js, fx3d-recipes.js, fx3d-atlas.js; it was one Sprite and one draw call per particle); effects use
  their own random numbers (`fxRandom`), not the game's; `particle(..., standIn)` marks the 2D view's stand-ins for
  effects the 3D renderer draws itself. Console `effectParticles()`; tools/tests/render-effects.mjs.
